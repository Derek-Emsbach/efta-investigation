"""
Stage 4: Entity Extraction

Matches extracted text against the known entity catalog (names + aliases).
Two-pass approach:
  1. Exact regex matching (fast, high confidence)
  2. Fuzzy matching for OCR typos and misspellings (slower, uses edit distance)

Creates entity_documents junction records for each match, with role and
excerpt context. Also detects FBI/court case numbers.
"""

import re
from difflib import SequenceMatcher
from typing import Any

from storage import download_text
from db import (
    create_entity_document,
    fetch_all_entities,
    fetch_document_for_processing,
)


# Module-level cache — populated once per worker lifetime
_entity_catalog: list[dict[str, Any]] | None = None


def _get_entity_catalog() -> list[dict[str, Any]]:
    """Load and cache the entity catalog from the database."""
    global _entity_catalog
    if _entity_catalog is None:
        _entity_catalog = fetch_all_entities()
    return _entity_catalog


def _build_search_entries(
    entities: list[dict[str, Any]],
) -> list[tuple[str, re.Pattern[str], dict[str, Any]]]:
    """
    Build (name, compiled_regex, entity_record) tuples for all entities
    and their aliases. Sorted longest-first so "Jeffrey Epstein" matches
    before "Epstein" and we can skip shorter overlapping matches.
    """
    entries: list[tuple[str, re.Pattern[str], dict[str, Any]]] = []
    for entity in entities:
        names = [entity["name"]]
        if entity.get("aliases"):
            names.extend(entity["aliases"])
        for name in names:
            name = name.strip()
            if len(name) < 3:
                continue
            pattern = re.compile(r"\b" + re.escape(name) + r"\b", re.IGNORECASE)
            entries.append((name, pattern, entity))

    # Sort longest name first to prioritize specific matches
    entries.sort(key=lambda e: len(e[0]), reverse=True)
    return entries


# ── Text normalization ───────────────────────────────────────────


def _normalize_whitespace(text: str) -> str:
    """
    Collapse OCR whitespace artifacts.
    "T rump" → "Trump", "Ep stein" → "Epstein"
    Merges single characters separated by spaces back together.
    """
    # Collapse runs of spaces/tabs (keep newlines for page estimation)
    normalized = re.sub(r"[ \t]+", " ", text)
    # Merge isolated single chars: "T r u m p" → "Trump"
    # Run multiple passes to collapse sequences like "D e r s h o w i t z"
    for _ in range(3):
        prev = normalized
        normalized = re.sub(
            r"\b([A-Za-z]) ([A-Za-z])\b",
            lambda m: m.group(1) + m.group(2),
            normalized,
        )
        if normalized == prev:
            break
    # Merge short fragment + word: "Ep stein" → "Epstein" (1-2 char + word)
    normalized = re.sub(
        r"\b([A-Za-z]{1,2}) ([A-Za-z]{2,})\b",
        lambda m: m.group(1) + m.group(2),
        normalized,
    )
    # Merge word + short fragment: "Trum p" → "Trump" (word + 1-2 char)
    normalized = re.sub(
        r"\b([A-Za-z]{2,}) ([A-Za-z]{1,2})\b",
        lambda m: m.group(1) + m.group(2),
        normalized,
    )
    return normalized


# ── Fuzzy matching ───────────────────────────────────────────────


def _tokenize_with_positions(text: str) -> list[tuple[str, int, int]]:
    """Tokenize text into (word, start, end) triples."""
    return [(m.group(), m.start(), m.end()) for m in re.finditer(r"\b\w+\b", text)]


def _fuzzy_ratio(a: str, b: str) -> float:
    """Compute similarity ratio between two strings (0.0 to 1.0)."""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def _fuzzy_threshold(name: str) -> float:
    """
    Dynamic threshold based on name length.
    Shorter names need higher similarity to avoid false positives.
    """
    length = len(name)
    if length <= 5:
        return 0.90  # 1 char diff allowed in 5-char name
    if length <= 10:
        return 0.85  # ~1-2 chars diff
    return 0.80  # 2-3 chars diff in long names


def _fuzzy_search_entity(
    name: str,
    tokens: list[tuple[str, int, int]],
    text: str,
) -> tuple[int, int] | None:
    """
    Try to fuzzy-match an entity name against tokenized text.
    Returns (start, end) of match or None.

    Uses a sliding window of N tokens (where N = word count in name)
    and compares the joined candidate against the entity name.
    """
    if len(name) < 5:
        return None  # Too short for reliable fuzzy matching

    name_words = name.split()
    num_words = len(name_words)
    threshold = _fuzzy_threshold(name)

    for i in range(len(tokens) - num_words + 1):
        window = tokens[i : i + num_words]
        candidate = " ".join(t[0] for t in window)

        # Quick length filter — skip if lengths differ by more than 3
        if abs(len(candidate) - len(name)) > 3:
            continue

        # Quick first-char filter — first char rarely wrong in OCR
        if candidate[0].lower() != name[0].lower():
            continue

        ratio = _fuzzy_ratio(name, candidate)
        if ratio >= threshold:
            return (window[0][1], window[-1][2])

    return None


# ── Page / excerpt / role helpers ────────────────────────────────


def _estimate_page(text: str, match_start: int) -> int:
    """
    Estimate which page a character offset falls on.
    Stage 3 joins pages with double newlines, so we count those
    as page boundaries.
    """
    pages = text.split("\n\n")
    offset = 0
    for page_num, page_text in enumerate(pages):
        offset += len(page_text) + 2  # +2 for the \n\n separator
        if match_start < offset:
            return page_num
    return len(pages) - 1


def _extract_excerpt(text: str, match_start: int, match_end: int, context: int = 100) -> str:
    """Extract a ~200 char excerpt centered on the match."""
    start = max(0, match_start - context)
    end = min(len(text), match_end + context)
    excerpt = text[start:end].strip()
    if start > 0:
        excerpt = "..." + excerpt
    if end < len(text):
        excerpt = excerpt + "..."
    return excerpt


def _detect_role(
    text: str, match_start: int, document_type: str | None, is_first: bool
) -> str:
    """Determine the entity's role in the document based on context."""
    before = text[max(0, match_start - 50) : match_start]

    if document_type == "email":
        if re.search(r"From\s*:\s*$", before, re.IGNORECASE):
            return "author"
        if re.search(r"To\s*:\s*$", before, re.IGNORECASE):
            return "recipient"
        if re.search(r"Cc\s*:\s*$", before, re.IGNORECASE):
            return "recipient"

    if document_type == "fbi_302":
        if is_first:
            return "subject"

    if re.search(r"(?:signed|signature|by)\s*:?\s*$", before, re.IGNORECASE):
        return "author"

    return "mentioned"


# ── Case number patterns ────────────────────────────────────────

FBI_CASE_PATTERN = re.compile(r"\b\d+[A-Z]-[A-Z]{2}-\d{5,}\b")
COURT_CASE_PATTERN = re.compile(
    r"\b(?:Case|No\.?|Docket)\s*(?:No\.?)?\s*:?\s*[\d:-]+[A-Z]*\b", re.IGNORECASE
)


# ── Main entry point ────────────────────────────────────────────


def _record_match(
    entity: dict[str, Any],
    match_start: int,
    match_end: int,
    text: str,
    document_id: str,
    document_type: str | None,
    matched_entities: dict[str, dict[str, Any]],
    entity_ids: list[str],
    high_tier_entities: list[str],
    is_first_entity: bool,
    match_type: str = "exact",
) -> bool:
    """Record a matched entity. Returns new is_first_entity value."""
    entity_id = entity["id"]
    matched_entities[entity_id] = entity
    entity_ids.append(entity_id)

    if entity.get("tier") and entity["tier"] <= 2:
        high_tier_entities.append(entity["name"])

    page_num = _estimate_page(text, match_start)
    excerpt = _extract_excerpt(text, match_start, match_end)
    if match_type == "fuzzy":
        # Annotate excerpt so reviewer knows this was a fuzzy match
        matched_text = text[match_start:match_end]
        excerpt = f"[fuzzy: \"{matched_text}\"] {excerpt}"
    role = _detect_role(text, match_start, document_type, is_first_entity)

    create_entity_document(
        entity_id=entity_id,
        document_id=document_id,
        role=role,
        excerpt=excerpt,
        page_number=page_num,
    )
    return False  # is_first_entity = False after first match


def run_entities(document_id: str, r2_key: str) -> dict[str, Any]:
    """
    Match extracted text against the entity catalog.
    Pass 1: Exact regex match (+ whitespace-normalized text)
    Pass 2: Fuzzy token-based match for remaining entities
    Creates entity_documents records. Returns a summary dict.
    """
    doc = fetch_document_for_processing(document_id)
    if not doc:
        return {"entities_found": 0, "error": "document not found"}

    # Fetch full text from R2 (DB only has 2000-char preview)
    bates = doc.get("bates_number")
    text = download_text(bates) if bates else None
    if not text:
        text = doc.get("extracted_text") or ""  # Fallback to DB preview
    if not text.strip():
        return {"entities_found": 0, "entity_ids": [], "case_numbers": []}

    document_type = doc.get("document_type")
    catalog = _get_entity_catalog()
    search_entries = _build_search_entries(catalog)

    matched_entities: dict[str, dict[str, Any]] = {}
    entity_ids: list[str] = []
    high_tier_entities: list[str] = []
    fuzzy_matches: list[str] = []
    is_first_entity = True

    # ── Pass 1: Exact regex matching ─────────────────────────────

    # Also try matching against whitespace-normalized text
    normalized_text = _normalize_whitespace(text)

    for name, pattern, entity in search_entries:
        entity_id = entity["id"]
        if entity_id in matched_entities:
            continue

        # Try original text first
        match = pattern.search(text)
        if not match and normalized_text != text:
            # Try normalized text (catches "T rump" → "Trump")
            match = pattern.search(normalized_text)

        if not match:
            continue

        is_first_entity = _record_match(
            entity, match.start(), match.end(), text, document_id,
            document_type, matched_entities, entity_ids,
            high_tier_entities, is_first_entity, "exact",
        )

    # ── Pass 2: Fuzzy matching for unmatched entities ────────────
    # Only fuzzy-match against PRIMARY entity names (not aliases).
    # Aliases like "Summers", "Mitchell", "Edwards" are too short and
    # collide with common English words. Full names like "George Mitchell"
    # are long enough for reliable fuzzy matching.

    tokens = _tokenize_with_positions(text)

    for entity in catalog:
        entity_id = entity["id"]
        if entity_id in matched_entities:
            continue

        # Only use the primary name for fuzzy matching
        primary_name = entity["name"]
        if len(primary_name) < 8:
            continue  # Skip very short primary names too

        result = _fuzzy_search_entity(primary_name, tokens, text)
        if result is None:
            continue

        start, end = result
        fuzzy_matches.append(f"{entity['name']} (as \"{text[start:end]}\")")
        is_first_entity = _record_match(
            entity, start, end, text, document_id,
            document_type, matched_entities, entity_ids,
            high_tier_entities, is_first_entity, "fuzzy",
        )

    # ── Case number detection ────────────────────────────────────

    case_numbers = list(set(
        FBI_CASE_PATTERN.findall(text) + COURT_CASE_PATTERN.findall(text)
    ))

    return {
        "entities_found": len(matched_entities),
        "entity_ids": entity_ids,
        "high_tier_entities": high_tier_entities,
        "fuzzy_matches": fuzzy_matches,
        "case_numbers": case_numbers[:20],
    }
