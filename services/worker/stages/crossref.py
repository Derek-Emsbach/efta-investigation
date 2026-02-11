"""
Stage 6: Cross-Reference

Finds related documents by entity co-occurrence, matches document dates
against the events timeline, and detects possible duplicate/variant
documents via text similarity.
"""

from collections import Counter
from datetime import date, timedelta
from typing import Any

from db import (
    fetch_document_for_processing,
    fetch_documents_by_entities,
    fetch_entity_documents_for_doc,
    fetch_events_by_date_range,
)


def _ngrams(text: str, n: int = 4) -> set[str]:
    """Generate character n-grams from text."""
    text = text.lower().strip()
    if len(text) < n:
        return {text}
    return {text[i : i + n] for i in range(len(text) - n + 1)}


def _jaccard(a: set[str], b: set[str]) -> float:
    """Compute Jaccard similarity between two sets."""
    if not a or not b:
        return 0.0
    intersection = len(a & b)
    union = len(a | b)
    return intersection / union if union > 0 else 0.0


def run_crossref(document_id: str, r2_key: str) -> dict[str, Any]:
    """
    Cross-reference this document against the existing corpus.
    Returns a summary dict with related documents, timeline matches,
    and possible duplicates.
    """
    # Fetch current document state
    doc = fetch_document_for_processing(document_id)
    if not doc:
        return {"related_docs": 0, "timeline_matches": 0, "possible_duplicates": 0}

    results: dict[str, Any] = {
        "related_documents": [],
        "timeline_matches": [],
        "possible_duplicates": [],
    }

    # ── Entity co-occurrence ─────────────────────────────────────

    entity_links = fetch_entity_documents_for_doc(document_id)
    entity_ids = [link["entity_id"] for link in entity_links]

    if entity_ids:
        other_links = fetch_documents_by_entities(entity_ids)

        # Group by document, count shared entities
        doc_entity_counts: Counter[str] = Counter()
        for link in other_links:
            other_doc_id = link["document_id"]
            if other_doc_id != document_id:
                doc_entity_counts[other_doc_id] += 1

        # Top related documents (sorted by shared entity count)
        for other_id, count in doc_entity_counts.most_common(10):
            results["related_documents"].append({
                "id": other_id,
                "shared_entities": count,
            })

    # ── Timeline matching ────────────────────────────────────────

    doc_date = doc.get("original_date")
    if doc_date:
        try:
            if isinstance(doc_date, str):
                d = date.fromisoformat(doc_date)
            else:
                d = doc_date
            start = (d - timedelta(days=30)).isoformat()
            end = (d + timedelta(days=30)).isoformat()
            events = fetch_events_by_date_range(start, end)
            for event in events:
                results["timeline_matches"].append({
                    "event_id": event["id"],
                    "title": event.get("title", ""),
                    "date": event.get("date", ""),
                    "event_type": event.get("event_type", ""),
                })
        except (ValueError, TypeError):
            pass

    # ── Text similarity (duplicate detection) ────────────────────

    text = (doc.get("extracted_text") or "")[:500]
    if len(text.strip()) > 50:
        doc_ngrams = _ngrams(text)

        # Check other documents in the same dataset
        dataset_id = doc.get("dataset_id")
        if dataset_id:
            from db import get_client

            client = get_client()
            result = (
                client.table("documents")
                .select("id, extracted_text")
                .eq("dataset_id", dataset_id)
                .neq("id", document_id)
                .not_.is_("extracted_text", "null")
                .limit(100)
                .execute()
            )
            candidates = result.data or []

            for candidate in candidates:
                cand_text = (candidate.get("extracted_text") or "")[:500]
                if len(cand_text.strip()) < 50:
                    continue
                cand_ngrams = _ngrams(cand_text)
                similarity = _jaccard(doc_ngrams, cand_ngrams)
                if similarity >= 0.8:
                    results["possible_duplicates"].append({
                        "id": candidate["id"],
                        "similarity": round(similarity, 3),
                    })

    return {
        "related_docs": len(results["related_documents"]),
        "timeline_matches": len(results["timeline_matches"]),
        "possible_duplicates": len(results["possible_duplicates"]),
        "crossref": results,
    }
