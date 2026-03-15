"""Detect redaction-related anomalies.

Three anomaly types:
1. Inconsistent entity redaction — entity visible in most docs but redacted in some
2. Category mismatch — Category A + D on same page
3. Density spikes — per-dataset redaction density outliers
"""

import sys
from collections import defaultdict
from pathlib import Path

from rich.console import Console

sys.path.insert(0, str(Path(__file__).parent.parent))
import db

console = Console()


def detect_inconsistent_redaction() -> list[dict]:
    """Find entities whose names are redacted in some docs but visible in others."""
    console.print("  Checking inconsistent entity redaction...")

    anomalies = []

    entities = db.get_all_entities()
    # Only check published entities (tiers 1-4)
    published = [e for e in entities if e.get("profile_published") and (e.get("tier") or 6) <= 4]

    for entity in published:
        # Count docs where entity is mentioned (entity_documents)
        mention_count = db.get_entity_documents_count(entity["id"])
        if mention_count < 5:
            continue

        # Get redactions that mention this entity's name near redacted areas
        # This requires checking redaction records where nearby text contains entity name
        client = db.get_client()
        result = client.table("redactions").select(
            "id, document_id, category, nearby_text, is_suspect"
        ).ilike("nearby_text", f"%{entity['name']}%").execute()

        redaction_docs = set()
        for r in (result.data or []):
            redaction_docs.add(r["document_id"])

        if not redaction_docs:
            continue

        # Calculate redaction ratio
        ratio = len(redaction_docs) / mention_count

        # Flag if entity is visible in >80% but redacted near their name in some
        if 0.01 < ratio < 0.30 and len(redaction_docs) >= 2:
            tier = entity.get("tier") or 6
            severity = "critical" if tier <= 2 else "high" if tier <= 3 else "medium"

            anomalies.append({
                "anomaly_type": "redaction_inconsistency",
                "severity": severity,
                "score": ratio * 100,
                "title": f"{entity['name']}: name visible in {mention_count} docs but near redactions in {len(redaction_docs)}",
                "description": (
                    f"Entity '{entity['name']}' (Tier {tier}) appears in {mention_count} documents "
                    f"but their name appears near redacted content in {len(redaction_docs)} documents "
                    f"({ratio:.0%} redaction rate). This suggests selective redaction of context "
                    f"around this entity."
                ),
                "entity_ids": [entity["id"]],
                "document_ids": list(redaction_docs)[:20],
                "evidence": {
                    "mention_count": mention_count,
                    "redaction_doc_count": len(redaction_docs),
                    "redaction_ratio": ratio,
                },
            })

    console.print(f"    Found {len(anomalies)} inconsistent redaction anomalies")
    return anomalies


def detect_category_mismatch() -> list[dict]:
    """Find documents with both Category A (victim) and Category D (perpetrator) redactions."""
    console.print("  Checking category mismatches...")

    client = db.get_client()

    # Get all documents with redactions
    result = client.table("redactions").select(
        "document_id, category"
    ).in_("category", ["A", "D"]).execute()

    doc_categories: dict[str, set[str]] = defaultdict(set)
    for r in (result.data or []):
        doc_categories[r["document_id"]].add(r["category"])

    # Find docs with both A and D
    anomalies = []
    for doc_id, cats in doc_categories.items():
        if "A" in cats and "D" in cats:
            anomalies.append({
                "anomaly_type": "redaction_category_mismatch",
                "severity": "critical",
                "score": 90.0,
                "title": f"Document has both Category A (victim) and D (perpetrator) redactions",
                "description": (
                    f"Document contains redactions categorized as both victim protection (A) "
                    f"and perpetrator protection (D). This combination often indicates "
                    f"that perpetrator-protecting redactions are being disguised as "
                    f"victim protection."
                ),
                "entity_ids": [],
                "document_ids": [doc_id],
                "evidence": {"categories": list(cats)},
            })

    console.print(f"    Found {len(anomalies)} category mismatch anomalies")
    return anomalies


def detect_density_spikes() -> list[dict]:
    """Find documents with unusually high redaction density within their dataset."""
    console.print("  Checking redaction density spikes...")

    client = db.get_client()

    # Get redaction counts per document with dataset info
    result = client.table("redactions").select(
        "document_id, id"
    ).execute()

    doc_redaction_counts: dict[str, int] = defaultdict(int)
    for r in (result.data or []):
        doc_redaction_counts[r["document_id"]] += 1

    if not doc_redaction_counts:
        console.print("    No redaction data available")
        return []

    # Get dataset info for these documents
    doc_ids = list(doc_redaction_counts.keys())[:5000]  # Sample
    docs = db.get_documents_by_ids(doc_ids)
    doc_datasets: dict[str, str] = {d["id"]: d.get("dataset_id", "") for d in docs}

    # Group by dataset and compute statistics
    dataset_counts: dict[str, list[tuple[str, int]]] = defaultdict(list)
    for doc_id, count in doc_redaction_counts.items():
        ds = doc_datasets.get(doc_id, "unknown")
        dataset_counts[ds].append((doc_id, count))

    anomalies = []
    for ds_id, doc_counts in dataset_counts.items():
        if len(doc_counts) < 10:
            continue

        counts = [c for _, c in doc_counts]
        mean = sum(counts) / len(counts)
        variance = sum((c - mean) ** 2 for c in counts) / len(counts)
        std = variance ** 0.5

        if std < 1:
            continue

        # Flag documents > 2 standard deviations above mean
        threshold = mean + 2 * std
        for doc_id, count in doc_counts:
            if count > threshold:
                z_score = (count - mean) / std
                anomalies.append({
                    "anomaly_type": "redaction_density_spike",
                    "severity": "high" if z_score > 3 else "medium",
                    "score": min(100, z_score * 20),
                    "title": f"Document has {count} redactions (dataset avg: {mean:.1f})",
                    "description": (
                        f"Document has {count} redactions, which is {z_score:.1f} standard "
                        f"deviations above the dataset average of {mean:.1f}. "
                        f"This unusually high redaction density may indicate systematic "
                        f"information suppression."
                    ),
                    "entity_ids": [],
                    "document_ids": [doc_id],
                    "evidence": {
                        "redaction_count": count,
                        "dataset_mean": mean,
                        "dataset_std": std,
                        "z_score": z_score,
                    },
                })

    # Keep top 50 by score
    anomalies.sort(key=lambda x: x["score"], reverse=True)
    anomalies = anomalies[:50]

    console.print(f"    Found {len(anomalies)} density spike anomalies")
    return anomalies


def run() -> list[dict]:
    """Run all redaction anomaly detectors."""
    anomalies = []
    for fn in [detect_inconsistent_redaction, detect_category_mismatch, detect_density_spikes]:
        try:
            anomalies.extend(fn())
        except Exception as e:
            console.print(f"    [yellow]Skipped {fn.__name__}: {e}[/]")
    return anomalies
