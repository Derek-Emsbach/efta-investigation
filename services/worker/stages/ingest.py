"""
Stage 1: Ingest

Downloads the PDF from R2, extracts basic metadata (page count, file size),
generates a JPEG thumbnail of the first page, and uploads it back to R2.
"""

import fitz  # PyMuPDF
from db import update_document
from storage import download_file, upload_file


def run_ingest(document_id: str, r2_key: str) -> dict:
    """
    Download PDF, extract metadata, generate thumbnail.
    Returns a summary dict of what was extracted.
    """
    # Download the PDF
    pdf_bytes = download_file(r2_key)
    file_size = len(pdf_bytes)

    # Open with PyMuPDF
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page_count = doc.page_count

    # Generate thumbnail from first page (150 DPI)
    thumbnail_url = None
    if page_count > 0:
        page = doc[0]
        # 150 DPI = 150/72 zoom factor
        zoom = 150 / 72
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)
        thumb_bytes = pix.tobytes("jpeg")

        thumb_key = f"thumbnails/{document_id}.jpg"
        thumbnail_url = upload_file(thumb_key, thumb_bytes, "image/jpeg")

    doc.close()

    # Update document record
    update_fields = {
        "page_count": page_count,
        "file_size_bytes": file_size,
    }
    if thumbnail_url:
        update_fields["thumbnail_url"] = thumbnail_url

    update_document(document_id, update_fields)

    return {
        "page_count": page_count,
        "file_size_bytes": file_size,
        "thumbnail_generated": thumbnail_url is not None,
    }
