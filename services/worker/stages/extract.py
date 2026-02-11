"""
Stage 3: Text Extraction

Extracts text from each page using PyMuPDF. If a page has minimal text
(< 50 chars), it's flagged as potentially needing OCR (OCR not run in
this stage — just flagged). Also detects document type and date from
content patterns.
"""

import re
from datetime import date

import fitz  # PyMuPDF
from db import update_document
from storage import download_file


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

    # Detect document type and date
    doc_type = detect_document_type(full_text)
    doc_date = detect_date(full_text)

    # Build flags
    flags = []
    if low_text_pages:
        flags.append("needs_ocr")
    if len(full_text.strip()) == 0:
        flags.append("no_text")

    # Update document
    update_fields: dict = {
        "extracted_text": full_text if full_text.strip() else None,
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
    }
