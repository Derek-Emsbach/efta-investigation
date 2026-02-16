"""
Stage 3: Text Extraction

Extracts text from each page using PyMuPDF. If a page has minimal text
(< 50 chars), it's flagged as potentially needing OCR (OCR not run in
this stage — just flagged). Also detects document type and date from
content patterns.

For email documents with base64-encoded attachments (PDFs, images),
the extraction stage decodes those attachments and extracts text from
them, replacing the raw base64 noise with useful content.
"""

import base64
import re
from datetime import date

import fitz  # PyMuPDF
from db import update_document, fetch_document_for_processing
from storage import download_file, upload_text


# Date patterns commonly found in EFTA documents
DATE_PATTERNS = [
    # January 15, 2005
    r"(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}",
    # 01/15/2005, 1/15/2005
    r"\d{1,2}/\d{1,2}/\d{4}",
    # 2005-01-15
    r"\d{4}-\d{2}-\d{2}",
    # 15 Jan 2005
    r"\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}",
]

MONTH_MAP = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "jun": 6, "jul": 7, "aug": 8, "sep": 9,
    "oct": 10, "nov": 11, "dec": 12,
}


def detect_date(text: str) -> str | None:
    """Try to extract a date from the document text. Returns ISO date string or None."""
    for pattern in DATE_PATTERNS:
        match = re.search(pattern, text[:5000], re.IGNORECASE)  # Search first 5000 chars
        if match:
            date_str = match.group(0)
            try:
                return _parse_date(date_str)
            except (ValueError, KeyError):
                continue
    return None


def _parse_date(date_str: str) -> str:
    """Parse various date formats into ISO format."""
    # Try YYYY-MM-DD
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", date_str)
    if m:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3))).isoformat()

    # Try MM/DD/YYYY
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", date_str)
    if m:
        return date(int(m.group(3)), int(m.group(1)), int(m.group(2))).isoformat()

    # Try "Month DD, YYYY" or "Month DD YYYY"
    m = re.match(r"(\w+)\s+(\d{1,2}),?\s+(\d{4})", date_str)
    if m:
        month = MONTH_MAP[m.group(1).lower()]
        return date(int(m.group(3)), month, int(m.group(2))).isoformat()

    # Try "DD Mon YYYY"
    m = re.match(r"(\d{1,2})\s+(\w+)\s+(\d{4})", date_str)
    if m:
        month = MONTH_MAP[m.group(2).lower()]
        return date(int(m.group(3)), month, int(m.group(1))).isoformat()

    raise ValueError(f"Cannot parse date: {date_str}")


def detect_document_type(text: str) -> str | None:
    """Classify document type based on content patterns."""
    text_upper = text[:10000].upper()
    text_lower = text[:10000].lower()

    # FBI 302 / interview report
    if "FEDERAL BUREAU OF INVESTIGATION" in text_upper or "FD-302" in text_upper:
        return "fbi_302"

    # Email headers
    if re.search(r"(?:^|\n)\s*(?:From|To|Subject|Date)\s*:", text[:3000], re.MULTILINE):
        email_indicators = sum(1 for h in ["From:", "To:", "Subject:", "Date:"] if h in text[:3000])
        if email_indicators >= 2:
            return "email"

    # Prosecution memo
    if "prosecution memo" in text_lower or "prosecutive memo" in text_lower:
        return "prosecution_memo"

    # Court filing
    if "united states district court" in text_lower or "case no." in text_lower:
        return "court_filing"

    # Financial record
    if re.search(r"\$[\d,]+\.\d{2}", text[:5000]):
        financial_count = len(re.findall(r"\$[\d,]+\.\d{2}", text[:5000]))
        if financial_count >= 3:
            return "financial"

    # Legal memo / report
    if "memorandum" in text_lower[:2000] or "privileged" in text_lower[:1000]:
        return "legal_report"

    # Senate / congressional letter
    if "united states senate" in text_lower or "congress" in text_lower[:2000]:
        return "senate_letter"

    # Photo (minimal text, likely image-only PDF)
    if len(text.strip()) < 50:
        return "photo"

    # Blank
    if len(text.strip()) == 0:
        return "blank"

    return None


# Regex to find MIME base64 sections: captures headers block + base64 body
_MIME_ATTACHMENT_RE = re.compile(
    r"(Content-(?:Type|Disposition)[^\n]*\n"  # Content-Type/Disposition line
    r"(?:[A-Za-z-]+:[^\n]*\n)*?"  # Other MIME headers
    r"Content-Transfer-Encoding:\s*base64\s*\n"  # Must have base64 encoding
    r"(?:[A-Za-z-]+:[^\n]*\n)*?"  # Any remaining headers
    r"\n)"  # Blank line separating headers from body
    r"((?:[A-Za-z0-9+/=]{20,}\s*\n?)+)",  # base64 body lines
    re.MULTILINE | re.IGNORECASE,
)

# Extract filename from MIME headers
_MIME_FILENAME_RE = re.compile(r'name\s*=\s*"?([^"\n;]+)"?', re.IGNORECASE)

# Simpler fallback: just Content-Transfer-Encoding: base64 followed by base64 lines
_SIMPLE_BASE64_RE = re.compile(
    r"(Content-Transfer-Encoding:\s*base64\s*\n\s*\n)"
    r"((?:[A-Za-z0-9+/=]{20,}\s*\n?)+)",
    re.MULTILINE | re.IGNORECASE,
)


def _extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str | None:
    """Try to open decoded bytes as PDF and extract text."""
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pages = []
        for page_num in range(doc.page_count):
            text = doc[page_num].get_text()
            if text.strip():
                pages.append(text.strip())
        doc.close()
        return "\n\n".join(pages) if pages else None
    except Exception:
        return None


def decode_mime_attachments(text: str) -> tuple[str, int]:
    """
    Find base64-encoded MIME attachments in extracted text, decode them,
    and if they're PDFs, extract text and inline it.

    Returns (cleaned_text, attachment_count).
    """
    attachments_decoded = 0

    def _decode_and_replace(match: re.Match) -> str:
        nonlocal attachments_decoded
        headers = match.group(1)
        b64_body = match.group(2)

        # Extract filename from headers
        fn_match = _MIME_FILENAME_RE.search(headers)
        filename = fn_match.group(1).strip() if fn_match else "attachment"

        # Clean base64: remove whitespace/newlines
        b64_clean = re.sub(r"\s+", "", b64_body)

        # Need a minimum amount of base64 to be worth decoding
        if len(b64_clean) < 100:
            return match.group(0)

        try:
            decoded = base64.b64decode(b64_clean)
        except Exception:
            return match.group(0)  # Not valid base64, leave as-is

        # Check if decoded bytes are a PDF (%PDF magic bytes)
        if decoded[:5] == b"%PDF-":
            extracted = _extract_text_from_pdf_bytes(decoded)
            if extracted:
                attachments_decoded += 1
                return (
                    f"\n[Decoded PDF attachment: {filename}]\n"
                    f"{extracted}\n"
                    f"[End of decoded attachment: {filename}]\n"
                )

        # Not a PDF — check if it's readable text (plain text attachment)
        try:
            text_content = decoded.decode("utf-8", errors="strict")
            if text_content.isprintable() or text_content.strip():
                attachments_decoded += 1
                return (
                    f"\n[Decoded text attachment: {filename}]\n"
                    f"{text_content}\n"
                    f"[End of decoded attachment: {filename}]\n"
                )
        except (UnicodeDecodeError, ValueError):
            pass

        # Binary attachment we can't extract text from — strip it with a note
        attachments_decoded += 1
        size_kb = len(decoded) / 1024
        return f"\n[Binary attachment: {filename} ({size_kb:.0f} KB) — not text-extractable]\n"

    # Try the detailed MIME regex first
    result = _MIME_ATTACHMENT_RE.sub(_decode_and_replace, text)

    # If the detailed regex didn't find anything, try the simpler pattern
    if attachments_decoded == 0:
        def _simple_replace(match: re.Match) -> str:
            nonlocal attachments_decoded
            b64_body = match.group(2)
            b64_clean = re.sub(r"\s+", "", b64_body)

            if len(b64_clean) < 100:
                return match.group(0)

            try:
                decoded = base64.b64decode(b64_clean)
            except Exception:
                return match.group(0)

            if decoded[:5] == b"%PDF-":
                extracted = _extract_text_from_pdf_bytes(decoded)
                if extracted:
                    attachments_decoded += 1
                    return (
                        f"\n[Decoded PDF attachment]\n"
                        f"{extracted}\n"
                        f"[End of decoded attachment]\n"
                    )

            # Strip unextractable binary
            if len(b64_clean) > 1000:
                attachments_decoded += 1
                size_kb = len(b64_clean) * 3 / 4 / 1024  # approximate decoded size
                return f"\n[Binary attachment ({size_kb:.0f} KB) — not text-extractable]\n"

            return match.group(0)

        result = _SIMPLE_BASE64_RE.sub(_simple_replace, result)

    # Clean up: collapse runs of blank lines left by removed base64
    result = re.sub(r"\n{4,}", "\n\n\n", result)

    return result, attachments_decoded


def run_extract(document_id: str, r2_key: str) -> dict:
    """
    Extract text from the PDF.
    Returns a summary dict; also updates the document record.
    """
    pdf_bytes = download_file(r2_key)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    pages_text: list[str] = []
    low_text_pages: list[int] = []
    total_chars = 0

    for page_num in range(doc.page_count):
        page = doc[page_num]
        text = page.get_text()
        pages_text.append(text)
        char_count = len(text.strip())
        total_chars += char_count

        if char_count < 50:
            low_text_pages.append(page_num)

    doc.close()

    full_text = "\n\n".join(pages_text)

    # Decode base64-encoded MIME attachments (e.g., PDF CVs in email documents)
    full_text, attachments_decoded = decode_mime_attachments(full_text)

    # Detect document type and date
    doc_type = detect_document_type(full_text)
    doc_date = detect_date(full_text)

    # Build flags
    flags = []
    if low_text_pages:
        flags.append("needs_ocr")
    if len(full_text.strip()) == 0:
        flags.append("no_text")
    if attachments_decoded > 0:
        flags.append("decoded_attachments")

    # Upload full text to R2 and store truncated preview in Supabase
    text_r2_key = None
    if full_text.strip():
        doc_record = fetch_document_for_processing(document_id)
        bates = doc_record.get("bates_number") if doc_record else None
        if bates:
            text_r2_key = upload_text(bates, full_text)

    # Store only first 2000 chars in DB (preview for search/display)
    preview = full_text[:2000] if full_text.strip() else None

    update_fields: dict = {
        "extracted_text": preview,
    }
    if doc_type:
        update_fields["document_type"] = doc_type
    if doc_date:
        update_fields["original_date"] = doc_date
    if flags:
        update_fields["flags"] = flags

    update_document(document_id, update_fields)

    return {
        "total_chars": total_chars,
        "page_count": len(pages_text),
        "low_text_pages": len(low_text_pages),
        "document_type": doc_type,
        "document_date": doc_date,
        "flags": flags,
        "text_r2_key": text_r2_key,
        "attachments_decoded": attachments_decoded,
    }
