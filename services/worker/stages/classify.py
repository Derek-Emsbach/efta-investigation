"""
Stage 7: Classification

Computes an evidence value score (0-100) based on all prior stage results,
then maps it to classification, severity, and priority. Determines whether
the document needs human review (Tier C gating).
"""

from typing import Any

from db import (
    fetch_document_for_processing,
    update_document,
    update_queue_priority,
)


# Document types that score higher
HIGH_VALUE_TYPES = {"fbi_302", "prosecution_memo"}
MEDIUM_VALUE_TYPES = {"email", "court_filing", "legal_report", "financial"}


def compute_score(
    doc: dict[str, Any],
    entity_results: dict[str, Any],
    redaction_results: dict[str, Any],
    crossref_results: dict[str, Any],
) -> tuple[int, list[str]]:
    """
    Compute the evidence value score (0-100) and a list of reasons.
    """
    score = 0
    reasons: list[str] = []

    # ── Document type ────────────────────────────────────────────

    doc_type = doc.get("document_type") or ""
    if doc_type in HIGH_VALUE_TYPES:
        score += 20
        reasons.append(f"+20 document type: {doc_type}")
    elif doc_type in MEDIUM_VALUE_TYPES:
        score += 10
        reasons.append(f"+10 document type: {doc_type}")

    # ── Entity count ─────────────────────────────────────────────

    entities_found = entity_results.get("entities_found", 0)
    entity_points = min(25, entities_found * 5)
    if entity_points > 0:
        score += entity_points
        reasons.append(f"+{entity_points} entities found: {entities_found}")

    # ── High-tier entities ───────────────────────────────────────

    high_tier = entity_results.get("high_tier_entities", [])
    high_tier_points = min(30, len(high_tier) * 15)
    if high_tier_points > 0:
        score += high_tier_points
        names = ", ".join(high_tier[:3])
        reasons.append(f"+{high_tier_points} Tier 1-2 entities: {names}")

    # ── Redaction level ──────────────────────────────────────────

    redaction_level = redaction_results.get("overall_level", "none")
    redaction_points = {
        "none": 0,
        "low": 0,
        "moderate": 10,
        "heavy": 20,
        "very_heavy": 25,
    }.get(redaction_level, 0)
    if redaction_points > 0:
        score += redaction_points
        reasons.append(f"+{redaction_points} redaction level: {redaction_level}")

    # ── Suspect redaction ────────────────────────────────────────

    if redaction_results.get("is_suspect"):
        score += 15
        reasons.append("+15 suspect redaction (Category C/D)")

    # ── Cross-reference density ──────────────────────────────────

    related_docs = crossref_results.get("related_docs", 0)
    crossref_points = min(15, related_docs * 5)
    if crossref_points > 0:
        score += crossref_points
        reasons.append(f"+{crossref_points} related documents: {related_docs}")

    # ── Timeline match ───────────────────────────────────────────

    timeline_matches = crossref_results.get("timeline_matches", 0)
    if timeline_matches > 0:
        score += 10
        reasons.append(f"+10 timeline matches: {timeline_matches}")

    # ── Text volume ──────────────────────────────────────────────

    text_len = len(doc.get("extracted_text") or "")
    if text_len > 5000:
        score += 5
        reasons.append(f"+5 substantial text ({text_len} chars)")

    # Cap at 100
    score = min(100, score)

    return score, reasons


def run_classify(
    document_id: str,
    r2_key: str,
    queue_id: str,
    entity_results: dict[str, Any],
    redaction_results: dict[str, Any],
    crossref_results: dict[str, Any],
) -> dict[str, Any]:
    """
    Score the document, set classification/severity/priority,
    and determine if human review is needed.
    """
    doc = fetch_document_for_processing(document_id)
    if not doc:
        return {"error": "document not found"}

    score, reasons = compute_score(
        doc, entity_results, redaction_results, crossref_results
    )

    # ── Classification ───────────────────────────────────────────

    if score >= 70:
        classification = "high"
    elif score >= 40:
        classification = "medium"
    else:
        classification = "low"

    # ── Severity ─────────────────────────────────────────────────

    has_high_tier = bool(entity_results.get("high_tier_entities"))
    has_suspect = redaction_results.get("is_suspect", False)

    if score >= 85 and (has_high_tier or has_suspect):
        severity = "extreme_critical"
    elif score >= 70:
        severity = "critical"
    elif score >= 40:
        severity = "high"
    else:
        severity = "routine"

    # ── Priority (1-10, lower = more urgent) ─────────────────────

    priority = max(1, 10 - score // 10)

    # ── Tier C gating — does this need human review? ─────────────

    review_reasons: list[str] = []

    if priority <= 5:
        review_reasons.append(f"priority {priority}")
    if has_high_tier:
        review_reasons.append("Tier 1-2 entity")
    if severity in ("extreme_critical", "critical"):
        review_reasons.append(f"severity: {severity}")
    if has_suspect:
        review_reasons.append("suspect redaction")
    if crossref_results.get("timeline_matches", 0) > 0:
        review_reasons.append("timeline match")

    needs_review = len(review_reasons) > 0

    # ── Update document + queue ──────────────────────────────────

    update_document(document_id, {
        "classification": classification,
        "severity": severity,
    })
    update_queue_priority(queue_id, priority)

    return {
        "score": score,
        "classification": classification,
        "severity": severity,
        "priority": priority,
        "needs_review": needs_review,
        "review_reasons": review_reasons,
        "reasons": reasons,
    }
