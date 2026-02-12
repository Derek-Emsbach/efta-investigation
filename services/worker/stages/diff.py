"""
Stage 8: Version Diff (conditional)

Runs only for re-processed or re-uploaded documents.
Compares the current processing results against the previous version
snapshot and flags significant changes — especially redaction decreases.
"""

from typing import Any

from db import (
    fetch_document_for_processing,
    fetch_document_version,
    fetch_entity_ids_for_document,
    fetch_redaction_summary,
    update_document,
)


def run_diff(document_id: str, previous_version_id: str) -> dict[str, Any]:
    """
    Compare current document state against the previous version snapshot.
    Returns a structured diff summary with significant findings.
    """
    # Fetch current state
    current = fetch_document_for_processing(document_id)
    if not current:
        return {"error": "document not found"}

    # Fetch previous version snapshot
    previous = fetch_document_version(previous_version_id)
    if not previous:
        return {"error": "previous version not found"}

    diff: dict[str, Any] = {
        "previous_version": previous.get("version_number"),
        "trigger": previous.get("trigger"),
        "redaction_changes": {},
        "entity_changes": {},
        "classification_change": None,
        "severity_change": None,
        "text_length_change": None,
        "significant_findings": [],
    }

    # ── Redaction diff ───────────────────────────────────────────
    old_summary = previous.get("redaction_summary") or {}
    new_summary = fetch_redaction_summary(document_id)

    old_categories = old_summary.get("categories", {})
    new_categories = new_summary.get("categories", {})

    for cat in ("A", "B", "C", "D"):
        old_count = old_categories.get(cat, 0)
        new_count = new_categories.get(cat, 0)
        if old_count != new_count:
            diff["redaction_changes"][cat] = {
                "old": old_count,
                "new": new_count,
                "delta": new_count - old_count,
            }

    old_total = old_summary.get("total_pages_with_redactions", 0)
    new_total = new_summary.get("total_pages_with_redactions", 0)

    # Flag redaction decreases as significant
    if old_total > 0 and new_total < old_total:
        diff["significant_findings"].append({
            "type": "redaction_decrease",
            "description": (
                f"Redacted pages decreased from {old_total} to {new_total}"
            ),
            "severity": "high",
        })

    for cat, change in diff["redaction_changes"].items():
        if change["delta"] < 0:
            severity = "critical" if cat in ("C", "D") else "high"
            label = {
                "A": "victim protection",
                "B": "legal privilege",
                "C": "institutional",
                "D": "perpetrator protection",
            }.get(cat, cat)
            diff["significant_findings"].append({
                "type": "category_redaction_decrease",
                "category": cat,
                "description": (
                    f"Category {cat} ({label}) redactions: "
                    f"{change['old']} → {change['new']} ({abs(change['delta'])} removed)"
                ),
                "severity": severity,
            })

    # ── Entity diff ──────────────────────────────────────────────
    old_entity_ids = set(previous.get("entity_ids") or [])
    new_entity_ids = set(fetch_entity_ids_for_document(document_id))

    added = list(new_entity_ids - old_entity_ids)
    removed = list(old_entity_ids - new_entity_ids)

    if added or removed:
        diff["entity_changes"] = {
            "added": added,
            "removed": removed,
            "added_count": len(added),
            "removed_count": len(removed),
        }

    if added:
        diff["significant_findings"].append({
            "type": "new_entities_found",
            "description": f"{len(added)} new entity link(s) found in re-processed version",
            "severity": "medium",
        })

    # ── Classification / severity diff ───────────────────────────
    old_class = previous.get("classification")
    new_class = current.get("classification")
    if old_class != new_class:
        diff["classification_change"] = {"old": old_class, "new": new_class}

    old_sev = previous.get("severity")
    new_sev = current.get("severity")
    if old_sev != new_sev:
        diff["severity_change"] = {"old": old_sev, "new": new_sev}

    # ── Text length diff ─────────────────────────────────────────
    old_text_len = len(previous.get("extracted_text") or "")
    new_text_len = len(current.get("extracted_text") or "")
    if old_text_len > 0 or new_text_len > 0:
        diff["text_length_change"] = {
            "old": old_text_len,
            "new": new_text_len,
            "delta": new_text_len - old_text_len,
        }

    # ── Store diff in document record ────────────────────────────
    existing_meta = current.get("forensic_metadata") or {}
    existing_meta["version_diff"] = diff

    # Add flags for significant findings
    existing_flags = list(current.get("flags") or [])
    if any(f["type"] == "redaction_decrease" for f in diff["significant_findings"]):
        if "redaction_decrease" not in existing_flags:
            existing_flags.append("redaction_decrease")
    if any(
        f["type"] == "category_redaction_decrease" and f.get("category") == "D"
        for f in diff["significant_findings"]
    ):
        if "unredacted_names" not in existing_flags:
            existing_flags.append("unredacted_names")

    update_document(document_id, {
        "forensic_metadata": existing_meta,
        "flags": existing_flags,
    })

    return diff
