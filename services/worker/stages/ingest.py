"""
Stage 1: Ingest

Downloads the PDF from R2, extracts basic metadata (page count, file size),
generates a JPEG thumbnail of the first page, and uploads it back to R2.

Includes retry logic for files still being uploaded via presigned URL.
"""

import time

import fitz  # PyMuPDF
from db import update_document
from storage import download_file, file_exists, upload_file

# Retry config for waiting on uploads in progress
MAX_RETRIES = 5
INITIAL_WAIT = 2  # seconds


def _download_with_retry(r2_key: str) -> bytes:
    """
    Download a file from R2, retrying with backoff if not found yet.
    Handles the race condition where the worker picks up a queue item
    before the browser finishes uploading via presigned URL.
    """
    wait = INITIAL_WAIT
    for attempt in range(MAX_RETRIES):
        try:
            return download_file(r2_key)
        except Exception as e:
            if "NoSuchKey" in str(e) and attempt < MAX_RETRIES - 1:
                print(f"    File not in R2 yet, waiting {wait}s (attempt {attempt + 1}/{MAX_RETRIES})...")
                time.sleep(wait)
                wait *= 2
            else:
                raise
    return download_file(r2_key)  # Final attempt, let it raise


def run_ingest(document_id: str, r2_key: str) -> dict:
    """
    Download PDF, extract metadata, generate thumbnail.
    Returns a summary dict of what was extracted.
    """
    # Download the PDF (with retry for uploads in progress)
    pdf_bytes = _download_with_retry(r2_key)
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
