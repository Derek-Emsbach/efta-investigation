"""
Stage 2: Forensic Analysis

Examines the PDF structure for metadata, pipeline type detection,
embedded objects, permissions, and font catalogs. Results are stored
in the document's forensic_metadata JSONB field.

The EFTA documents follow two known pipelines:
  Standard: PDF 1.5, metadata stripped, 2 EOF markers, multi-page
  Alternate: PDF 1.3, CreationDate retained, 3 EOF markers, single-page photos
"""

import fitz  # PyMuPDF
from db import update_document
from storage import download_file


def run_forensics(document_id: str, r2_key: str) -> dict:
    """
    Run forensic analysis on the PDF.
    Returns a summary dict; also updates the document's forensic_metadata.
    """
    pdf_bytes = download_file(r2_key)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    # PDF version
    # PyMuPDF stores version as a float-like string in metadata or we parse it
    pdf_version = None
    raw = pdf_bytes[:1024].decode("latin-1", errors="replace")
    if "%PDF-" in raw:
        start = raw.index("%PDF-") + 5
        pdf_version = raw[start : start + 3]

    # Metadata
    meta = doc.metadata or {}
    creation_date = meta.get("creationDate")
    mod_date = meta.get("modDate")
    creator = meta.get("creator")
    producer = meta.get("producer")

    metadata_stripped = not any([creation_date, mod_date, creator, producer])

    # EOF marker count (count occurrences of %%EOF in the file)
    eof_count = pdf_bytes.count(b"%%EOF")

    # Pipeline detection
    if pdf_version and pdf_version.startswith("1.5") and eof_count == 2:
        pipeline = "standard"
    elif pdf_version and pdf_version.startswith("1.3") and eof_count >= 3:
        pipeline = "alternate"
    else:
        pipeline = "unknown"

    # Permissions
    permissions = doc.permissions

    # Font catalog
    fonts = set()
    for page_num in range(min(doc.page_count, 10)):  # Scan first 10 pages
        page = doc[page_num]
        for font in page.get_fonts():
            # font tuple: (xref, ext, type, basefont, name, encoding)
            if font[3]:
                fonts.add(font[3])

    # Page sizes
    page_sizes = set()
    for page_num in range(min(doc.page_count, 10)):
        page = doc[page_num]
        rect = page.rect
        page_sizes.add(f"{int(rect.width)}x{int(rect.height)}")

    # Check for special features
    has_xmp = bool(doc.xref_xml_metadata())
    has_javascript = False
    has_forms = False
    has_embedded_files = False

    # Check for JavaScript in the catalog
    try:
        catalog = doc.pdf_catalog()
        if catalog:
            xref_data = doc.xref_object(catalog)
            if "/JavaScript" in xref_data or "/JS" in xref_data:
                has_javascript = True
            if "/AcroForm" in xref_data:
                has_forms = True
            if "/EmbeddedFiles" in xref_data:
                has_embedded_files = True
    except Exception:
        pass

    doc.close()

    forensic_metadata = {
        "pdf_version": pdf_version,
        "pipeline": pipeline,
        "metadata_status": "stripped" if metadata_stripped else "present",
        "eof_markers": eof_count,
        "permissions": permissions,
        "fonts": sorted(fonts),
        "page_sizes": sorted(page_sizes),
        "has_xmp": has_xmp,
        "has_javascript": has_javascript,
        "has_forms": has_forms,
        "has_embedded_files": has_embedded_files,
        "creation_date": creation_date,
        "mod_date": mod_date,
        "creator": creator,
        "producer": producer,
    }

    # Update document
    update_document(document_id, {"forensic_metadata": forensic_metadata})

    return {
        "pipeline": pipeline,
        "pdf_version": pdf_version,
        "eof_markers": eof_count,
        "font_count": len(fonts),
        "metadata_stripped": metadata_stripped,
    }
