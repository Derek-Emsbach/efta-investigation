"""
Stage 5: Redaction Detection

Analyzes PDF pages for redacted regions (black rectangles / redact annotations).
Calculates per-page and overall redaction coverage, classifies redactions into
A-D categories based on surrounding text context, and creates redaction records.
"""

from typing import Any

import fitz  # PyMuPDF

from db import create_redaction, fetch_all_entities, update_document
from storage import download_file


# Keywords used to classify redaction categories
CATEGORY_A_KEYWORDS = {
    "minor", "victim", "age", "school", "recruit", "girl", "child",
    "massage", "underage", "juvenile", "student", "young",
}
CATEGORY_B_KEYWORDS = {
    "privilege", "attorney", "counsel", "work product", "confidential",
    "legal", "representation", "waiver", "immunity",
}
CATEGORY_C_KEYWORDS = {
    "doj", "fbi", "department", "office", "bureau", "decision", "policy",
    "directive", "investigation", "prosecut", "recommend", "supervisor",
    "chief", "agent", "headquarters",
}
CATEGORY_D_KEYWORDS = {
    "payment", "wire", "transfer", "account", "trust", "fund",
    "compensat", "settlement", "flight", "travel", "passport",
}

# Redaction level thresholds (percentage of total page area)
REDACTION_LEVELS = [
    (0.0, "none"),
    (10.0, "low"),
    (30.0, "moderate"),
    (60.0, "heavy"),
    (100.0, "very_heavy"),
]


def _is_black_rect(drawing: dict) -> bool:
    """Check if a drawing is a filled black (or near-black) rectangle."""
    fill = drawing.get("fill")
    if fill is None:
        return False
    # fill is a tuple of (r, g, b) floats 0-1
    if not isinstance(fill, (list, tuple)) or len(fill) < 3:
        return False
    r, g, b = fill[0], fill[1], fill[2]
    # Near-black threshold
    return r < 0.1 and g < 0.1 and b < 0.1


def _rect_area(rect: fitz.Rect) -> float:
    """Calculate rectangle area in square points."""
    return abs(rect.width * rect.height)


def _get_nearby_text(page: fitz.Page, rect: fitz.Rect, margin: float = 50.0) -> str:
    """Extract text from blocks near the redacted rectangle."""
    expanded = fitz.Rect(
        rect.x0 - margin,
        rect.y0 - margin,
        rect.x1 + margin,
        rect.y1 + margin,
    )
    blocks = page.get_text("blocks")
    nearby: list[str] = []
    for block in blocks:
        # block = (x0, y0, x1, y1, text, block_no, block_type)
        if len(block) < 5:
            continue
        block_rect = fitz.Rect(block[0], block[1], block[2], block[3])
        if expanded.intersects(block_rect):
            text = str(block[4]).strip()
            if text:
                nearby.append(text)
    return " ".join(nearby).lower()


def _classify_category(
    nearby_text: str, tier_1_2_names: set[str]
) -> tuple[str | None, bool, list[str]]:
    """
    Classify a redaction into category A-D based on surrounding text.
    Returns (category, is_suspect, red_flags).
    """
    red_flags: list[str] = []

    # Check for Tier 1-2 entity names near the redaction
    for name in tier_1_2_names:
        if name.lower() in nearby_text:
            red_flags.append("near_high_tier_entity")
            return "D", True, red_flags

    # Category D — perpetrator protection keywords
    d_hits = sum(1 for kw in CATEGORY_D_KEYWORDS if kw in nearby_text)
    if d_hits >= 2:
        red_flags.append("perpetrator_context")
        return "D", True, red_flags

    # Category C — institutional protection keywords
    c_hits = sum(1 for kw in CATEGORY_C_KEYWORDS if kw in nearby_text)
    if c_hits >= 2:
        if any(kw in nearby_text for kw in ("decision", "recommend", "prosecut")):
            red_flags.append("decision_text_redacted")
        return "C", True, red_flags

    # Category B — legal privilege
    b_hits = sum(1 for kw in CATEGORY_B_KEYWORDS if kw in nearby_text)
    if b_hits >= 2:
        return "B", False, red_flags

    # Category A — victim protection
    a_hits = sum(1 for kw in CATEGORY_A_KEYWORDS if kw in nearby_text)
    if a_hits >= 2:
        return "A", False, red_flags

    # Unclassified
    return None, False, red_flags


def _get_redaction_level(pct: float) -> str:
    """Map a redaction percentage to a level label."""
    for threshold, label in REDACTION_LEVELS:
        if pct <= threshold:
            return label
    return "very_heavy"


def run_redactions(document_id: str, r2_key: str) -> dict[str, Any]:
    """
    Detect and classify redactions in the PDF.
    Creates redaction records and updates document flags.
    Returns a summary dict.
    """
    pdf_bytes = download_file(r2_key)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    # Build set of Tier 1-2 entity names for Category D detection
    entities = fetch_all_entities()
    tier_1_2_names: set[str] = set()
    for entity in entities:
        if entity.get("tier") and entity["tier"] <= 2:
            tier_1_2_names.add(entity["name"])
            if entity.get("aliases"):
                tier_1_2_names.update(entity["aliases"])

    pages_with_redactions = 0
    total_redaction_pct = 0.0
    category_counts: dict[str, int] = {"A": 0, "B": 0, "C": 0, "D": 0}
    any_suspect = False
    all_flags: list[str] = []

    for page_num in range(doc.page_count):
        page = doc[page_num]
        page_area = _rect_area(page.rect)
        if page_area == 0:
            continue

        redacted_rects: list[fitz.Rect] = []

        # Method 1: Check drawings for filled black rectangles
        try:
            drawings = page.get_drawings()
            for drawing in drawings:
                if _is_black_rect(drawing):
                    rect = drawing.get("rect")
                    if rect and _rect_area(fitz.Rect(rect)) > 100:
                        redacted_rects.append(fitz.Rect(rect))
        except Exception:
            pass

        # Method 2: Check annotations for Redact type
        try:
            annots = page.annots()
            if annots:
                for annot in annots:
                    if annot.type[0] == 12:  # PDF_ANNOT_REDACT
                        rect = annot.rect
                        if _rect_area(rect) > 100:
                            redacted_rects.append(rect)
        except Exception:
            pass

        if not redacted_rects:
            continue

        pages_with_redactions += 1

        # Calculate redaction coverage for this page
        redacted_area = sum(_rect_area(r) for r in redacted_rects)
        page_pct = min(100.0, (redacted_area / page_area) * 100)
        total_redaction_pct += page_pct

        # Classify the most significant redaction on this page
        # Pick the largest redacted rectangle for classification
        largest_rect = max(redacted_rects, key=_rect_area)
        nearby_text = _get_nearby_text(page, largest_rect)
        category, is_suspect, red_flags = _classify_category(nearby_text, tier_1_2_names)

        if category:
            category_counts[category] = category_counts.get(category, 0) + 1
        if is_suspect:
            any_suspect = True
        all_flags.extend(red_flags)

        # Determine assessment
        assessment = None
        if is_suspect and category in ("C", "D"):
            assessment = "suspect"
        elif category == "D":
            assessment = "needs_research"

        # Create redaction record for this page
        desc_parts = [
            f"{len(redacted_rects)} redacted region(s)",
            f"{page_pct:.1f}% coverage",
        ]
        if category:
            desc_parts.append(f"Category {category}")

        create_redaction(
            document_id=document_id,
            page_number=page_num,
            category=category,
            description="; ".join(desc_parts),
            is_suspect=is_suspect,
            red_flags=red_flags if red_flags else None,
            assessment=assessment,
        )

    total_pages = doc.page_count
    doc.close()

    # Calculate overall level
    avg_pct = total_redaction_pct / max(1, total_pages)
    overall_level = _get_redaction_level(avg_pct)

    # Update document flags
    doc_flags: list[str] = []
    if pages_with_redactions > 0:
        doc_flags.append("redacted")
    if overall_level in ("heavy", "very_heavy"):
        doc_flags.append("heavy_redaction")
    if any_suspect:
        doc_flags.append("suspect_redaction")
    if all_flags:
        doc_flags.extend(list(set(all_flags)))

    if doc_flags:
        # Merge with any existing flags from prior stages
        from db import fetch_document_for_processing

        existing = fetch_document_for_processing(document_id)
        existing_flags = existing.get("flags") or [] if existing else []
        merged = list(set(existing_flags + doc_flags))
        update_document(document_id, {"flags": merged})

    return {
        "total_pages_with_redactions": pages_with_redactions,
        "overall_level": overall_level,
        "avg_redaction_pct": round(avg_pct, 1),
        "categories": category_counts,
        "is_suspect": any_suspect,
    }
