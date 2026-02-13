"""
Stage 1.5: Image Extraction

Scans each page for embedded images using PyMuPDF's get_images().
Distinguishes page-scan images (one large image covering the entire page)
from actual embedded photos/graphics. Only extracts and uploads non-scan
images that meet minimum dimension and size thresholds.

Runs after Ingest (Stage 1) and before Forensics (Stage 2) in Tier A.
"""

import fitz  # PyMuPDF

from db import upsert_document_image, delete_document_images
from storage import download_file, upload_file

# ── Thresholds ────────────────────────────────────────────────

MIN_WIDTH = 100            # pixels — skip tiny logos/icons
MIN_HEIGHT = 100           # pixels
MIN_FILE_SIZE = 5 * 1024   # 5 KB
PAGE_COVERAGE_THRESHOLD = 0.85  # 85% = page scan
THUMBNAIL_MAX_WIDTH = 400  # px for gallery thumbnails
MAX_IMAGES_PER_DOC = 50    # safety cap


def _is_page_scan(page: fitz.Page, img_width: int, img_height: int) -> bool:
    """
    Determine if a single image is a full-page scan.
    Compares image aspect ratio to page dimensions — if both width and
    height ratios exceed 90%, the image covers essentially the whole page.
    """
    page_rect = page.rect
    if page_rect.width <= 0 or page_rect.height <= 0:
        return False

    # PyMuPDF page dims are in points (72/inch), image dims are in pixels.
    # We compare proportional coverage (ratio of each axis).
    width_ratio = img_width / page_rect.width
    height_ratio = img_height / page_rect.height

    return width_ratio > 0.9 and height_ratio > 0.9


def _make_thumbnail(img_bytes: bytes, max_width: int = THUMBNAIL_MAX_WIDTH) -> bytes | None:
    """
    Generate a JPEG thumbnail by opening the image as a Pixmap
    and scaling it down if wider than max_width.
    """
    try:
        pix = fitz.Pixmap(img_bytes)

        # Convert CMYK or alpha to RGB
        if pix.n > 3:
            pix = fitz.Pixmap(fitz.csRGB, pix)

        if pix.width <= max_width:
            return pix.tobytes("jpeg")

        # Scale down
        scale = max_width / pix.width
        new_w = int(pix.width * scale)
        new_h = int(pix.height * scale)

        # Create a new pixmap from a scaled identity matrix applied to the image
        # The simplest reliable way is to convert to PDF then render at target size
        # But for speed, we'll use the Pixmap constructor with dimensions
        # fitz.Pixmap(colorspace, irect) then copy — or just use shrink factor
        shrink = int(1 / scale) if scale > 0 else 1
        if shrink > 1:
            pix.shrink(shrink)

        return pix.tobytes("jpeg")
    except Exception:
        return None


CONTENT_TYPE_MAP = {
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "png": "image/png",
    "tiff": "image/tiff",
    "bmp": "image/bmp",
    "jp2": "image/jp2",
    "jbig2": "image/x-jbig2",
}


def run_images(document_id: str, r2_key: str) -> dict:
    """
    Extract non-scan images from a PDF, upload originals + thumbnails
    to R2, and create document_images records in Supabase.
    """
    pdf_bytes = download_file(r2_key)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    stats = {
        "pages_scanned": doc.page_count,
        "page_scan_pages": 0,
        "images_found": 0,
        "images_extracted": 0,
        "images_skipped_scan": 0,
        "images_skipped_small": 0,
        "thumbnails_generated": 0,
    }

    # Clean up previous extractions (for re-processing)
    delete_document_images(document_id)

    extracted_count = 0

    for page_num in range(doc.page_count):
        if extracted_count >= MAX_IMAGES_PER_DOC:
            break

        page = doc[page_num]

        try:
            images = page.get_images(full=True)
        except Exception:
            continue

        if not images:
            continue

        # First pass: filter by dimensions
        valid_images = []
        for img_info in images:
            xref = img_info[0]
            width = img_info[2]
            height = img_info[3]
            stats["images_found"] += 1

            if width < MIN_WIDTH or height < MIN_HEIGHT:
                stats["images_skipped_small"] += 1
                continue

            valid_images.append((xref, width, height))

        if not valid_images:
            continue

        # Page scan detection: single large image = entire scanned page
        if len(valid_images) == 1:
            xref, width, height = valid_images[0]
            if _is_page_scan(page, width, height):
                stats["page_scan_pages"] += 1
                stats["images_skipped_scan"] += 1
                continue

        # Extract each valid image
        for img_idx, (xref, width, height) in enumerate(valid_images):
            if extracted_count >= MAX_IMAGES_PER_DOC:
                break

            try:
                img_data = doc.extract_image(xref)
            except Exception:
                continue

            if not img_data or "image" not in img_data:
                continue

            img_bytes = img_data["image"]
            img_ext = img_data.get("ext", "jpeg").lower()
            img_size = len(img_bytes)

            # File size filter
            if img_size < MIN_FILE_SIZE:
                stats["images_skipped_small"] += 1
                continue

            content_type = CONTENT_TYPE_MAP.get(img_ext, "image/jpeg")

            # Upload original to R2
            r2_img_key = f"images/{document_id}/p{page_num}_i{img_idx}.{img_ext}"
            upload_file(r2_img_key, img_bytes, content_type)

            # Generate and upload thumbnail
            thumb_r2_key = None
            thumb_bytes = _make_thumbnail(img_bytes)
            if thumb_bytes:
                thumb_r2_key = f"images/{document_id}/p{page_num}_i{img_idx}_thumb.jpg"
                upload_file(thumb_r2_key, thumb_bytes, "image/jpeg")
                stats["thumbnails_generated"] += 1

            # Compute page coverage for metadata
            page_area = page.rect.width * page.rect.height
            coverage = round((width * height) / page_area, 3) if page_area > 0 else None

            # Insert database record
            upsert_document_image(
                document_id=document_id,
                page_number=page_num,
                image_index=img_idx,
                r2_key=r2_img_key,
                thumbnail_r2_key=thumb_r2_key,
                file_size_bytes=img_size,
                width=width,
                height=height,
                format=img_ext,
                metadata={
                    "xref": xref,
                    "page_coverage": coverage,
                    "images_on_page": len(valid_images),
                },
            )

            extracted_count += 1
            stats["images_extracted"] += 1

    doc.close()

    if extracted_count >= MAX_IMAGES_PER_DOC:
        stats["capped"] = True

    return stats
