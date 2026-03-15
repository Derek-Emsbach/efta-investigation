"""Detect document-related anomalies.

Three anomaly types:
1. Entity density outliers — IsolationForest on (entity_count, page_count, doc_type)
2. Type-redaction combos — flag unusual document_type + redaction_category combos
3. Cross-dataset inconsistency — near-duplicate documents with different redaction profiles
"""

import sys
from collections import defaultdict
from pathlib import Path

from rich.console import Console

sys.path.insert(0, str(Path(__file__).parent.parent))
import db

console = Console()


def detect_entity_density_outliers() -> list[dict]:
    """Find documents with anomalous entity density using IsolationForest.

    Documents with an unusually high or low number of linked entities
    relative to their page count and type are flagged.
    """
    console.print("  Checking entity density outliers...")

    client = db.get_client()

    # Count entities per document (paginate since Supabase caps at 1000)
    doc_entity_counts: dict[str, int] = defaultdict(int)
    offset = 0
    page_size = 1000
    while True:
        result = client.table("entity_documents").select(
            "document_id"
        ).range(offset, offset + page_size - 1).execute()
        rows = result.data or []
        for row in rows:
            doc_entity_counts[row["document_id"]] += 1
        if len(rows) < page_size:
            break
        offset += page_size

    console.print(f"    Loaded {sum(doc_entity_counts.values())} entity-doc links across {len(doc_entity_counts)} documents")

    if len(doc_entity_counts) < 50:
        console.print("    Not enough data for density analysis")
        return []

    # Get document metadata (batch to avoid URL-too-long errors)
    doc_ids = list(doc_entity_counts.keys())[:5000]
    docs = []
    for i in range(0, len(doc_ids), 200):
        docs.extend(db.get_documents_by_ids(doc_ids[i:i + 200]))
    doc_map = {d["id"]: d for d in docs}
    console.print(f"    Loaded metadata for {len(doc_map)} documents")

    # Build feature matrix: [entity_count, page_count, doc_type_encoded]
    doc_type_codes: dict[str, int] = {}
    features = []
    doc_ids_ordered = []

    for doc_id in doc_ids:
        doc = doc_map.get(doc_id)
        if not doc:
            continue
        page_count = doc.get("page_count") or 1
        entity_count = doc_entity_counts[doc_id]
        doc_type = doc.get("document_type", "unknown")

        if doc_type not in doc_type_codes:
            doc_type_codes[doc_type] = len(doc_type_codes)

        features.append([
            entity_count,
            page_count,
            entity_count / max(page_count, 1),  # density
            doc_type_codes[doc_type],
        ])
        doc_ids_ordered.append(doc_id)

    if len(features) < 50:
        console.print("    Not enough features for IsolationForest")
        return []

    try:
        import numpy as np
        from sklearn.ensemble import IsolationForest
    except ImportError:
        console.print("    [yellow]Warning: scikit-learn not installed, skipping IsolationForest[/]")
        return []

    X = np.array(features)

    # Fit IsolationForest
    iso = IsolationForest(
        n_estimators=100,
        contamination=0.05,  # Expect ~5% anomalies
        random_state=42,
    )
    predictions = iso.fit_predict(X)
    scores = iso.decision_function(X)

    anomalies = []
    for i, (pred, score) in enumerate(zip(predictions, scores)):
        if pred == -1:  # Anomaly
            doc_id = doc_ids_ordered[i]
            doc = doc_map.get(doc_id, {})
            entity_count = features[i][0]
            page_count = features[i][1]
            density = features[i][2]

            # Only flag high-density outliers (more interesting for investigation)
            mean_density = np.mean(X[:, 2])
            if density < mean_density:
                continue

            anomaly_score = min(100, abs(score) * 200)
            severity = "high" if anomaly_score > 70 else "medium"

            anomalies.append({
                "anomaly_type": "entity_density_outlier",
                "severity": severity,
                "score": anomaly_score,
                "title": f"Document {doc.get('bates_number', '?')}: {int(entity_count)} entities in {int(page_count)} pages ({density:.1f}/page)",
                "description": (
                    f"Document '{doc.get('bates_number', doc_id)}' ({doc.get('document_type', '?')}) "
                    f"has {int(entity_count)} linked entities across {int(page_count)} pages "
                    f"({density:.1f} entities/page). The dataset average is {mean_density:.1f} "
                    f"entities/page. This anomalous density may indicate a key evidence document."
                ),
                "entity_ids": [],
                "document_ids": [doc_id],
                "evidence": {
                    "entity_count": int(entity_count),
                    "page_count": int(page_count),
                    "density": round(density, 2),
                    "mean_density": round(float(mean_density), 2),
                    "isolation_score": round(float(score), 4),
                    "document_type": doc.get("document_type"),
                    "bates_number": doc.get("bates_number"),
                },
            })

    # Keep top 50
    anomalies.sort(key=lambda x: x["score"], reverse=True)
    anomalies = anomalies[:50]

    console.print(f"    Found {len(anomalies)} entity density outliers")
    return anomalies


def detect_type_redaction_combos() -> list[dict]:
    """Flag unusual document_type + redaction_category combinations.

    Uses standardized residuals from a contingency table to find
    combinations that occur significantly more or less than expected.
    """
    console.print("  Checking type-redaction combinations...")

    client = db.get_client()

    # Get redactions with document types
    result = client.table("redactions").select(
        "document_id, category"
    ).not_.is_("category", "null").limit(50000).execute()

    if not result.data:
        console.print("    No redaction data")
        return []

    # Get document types for these docs
    doc_ids = list(set(r["document_id"] for r in result.data))[:5000]
    docs = db.get_documents_by_ids(doc_ids)
    doc_type_map = {d["id"]: d.get("document_type", "unknown") for d in docs}

    # Build contingency table: doc_type × redaction_category
    contingency: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for r in result.data:
        doc_type = doc_type_map.get(r["document_id"], "unknown")
        contingency[doc_type][r["category"]] += 1

    # Get all categories and types
    all_categories = sorted(set(cat for cats in contingency.values() for cat in cats))
    all_types = sorted(contingency.keys())

    if len(all_types) < 2 or len(all_categories) < 2:
        console.print("    Not enough variety for contingency analysis")
        return []

    # Calculate expected frequencies and standardized residuals
    total = sum(sum(cats.values()) for cats in contingency.values())
    row_totals = {t: sum(contingency[t].values()) for t in all_types}
    col_totals = {c: sum(contingency[t].get(c, 0) for t in all_types) for c in all_categories}

    anomalies = []

    for doc_type in all_types:
        for category in all_categories:
            observed = contingency[doc_type].get(category, 0)
            expected = (row_totals[doc_type] * col_totals[category]) / total if total > 0 else 0

            if expected < 5:  # Skip cells with low expected counts
                continue

            # Standardized residual
            residual = (observed - expected) / (expected ** 0.5) if expected > 0 else 0

            # Flag if |residual| > 3 (highly unusual combination)
            if abs(residual) > 3 and observed >= 5:
                direction = "over-represented" if residual > 0 else "under-represented"
                severity = "high" if abs(residual) > 5 else "medium"

                # Category D over-representation is most interesting
                if category == "D" and residual > 3:
                    severity = "critical"

                anomalies.append({
                    "anomaly_type": "type_redaction_combo",
                    "severity": severity,
                    "score": min(100, abs(residual) * 12),
                    "title": f"{doc_type} + Category {category}: {direction} (residual {residual:.1f})",
                    "description": (
                        f"The combination of document type '{doc_type}' with redaction category "
                        f"'{category}' is {direction}. Observed {observed} occurrences vs "
                        f"{expected:.0f} expected (standardized residual: {residual:.1f}). "
                        f"{'Category D redactions protect perpetrator identities — their over-representation in this document type warrants scrutiny.' if category == 'D' and residual > 0 else ''}"
                    ),
                    "entity_ids": [],
                    "document_ids": [],
                    "evidence": {
                        "document_type": doc_type,
                        "redaction_category": category,
                        "observed": observed,
                        "expected": round(expected, 1),
                        "residual": round(residual, 2),
                        "row_total": row_totals[doc_type],
                        "col_total": col_totals[category],
                    },
                })

    anomalies.sort(key=lambda x: x["score"], reverse=True)
    anomalies = anomalies[:30]

    console.print(f"    Found {len(anomalies)} type-redaction combo anomalies")
    return anomalies


def detect_cross_dataset_inconsistency() -> list[dict]:
    """Find near-duplicate documents across datasets with different redaction profiles.

    Documents with identical or very similar titles/bates prefixes in different
    datasets may represent the same underlying document released with different
    redaction decisions.
    """
    console.print("  Checking cross-dataset redaction inconsistencies...")

    client = db.get_client()

    # Get documents with titles and dataset info
    result = client.table("documents").select(
        "id, bates_number, title, dataset_id, page_count"
    ).not_.is_("title", "null").not_.is_("dataset_id", "null").limit(50000).execute()

    if not result.data:
        console.print("    No document data")
        return []

    # Group by normalized title to find potential duplicates
    title_groups: dict[str, list[dict]] = defaultdict(list)
    for doc in result.data:
        title = (doc.get("title") or "").strip().lower()
        if len(title) < 10:  # Skip very short titles
            continue
        title_groups[title].append(doc)

    # Find groups with docs from different datasets
    cross_dataset_groups = []
    for title, docs in title_groups.items():
        datasets = set(d.get("dataset_id") for d in docs)
        if len(datasets) >= 2:
            cross_dataset_groups.append((title, docs))

    if not cross_dataset_groups:
        console.print("    No cross-dataset duplicates found")
        return []

    # For each group, compare redaction profiles
    anomalies = []

    for title, docs in cross_dataset_groups[:100]:  # Check top 100
        doc_ids = [d["id"] for d in docs]

        # Get redaction counts per document
        red_result = client.table("redactions").select(
            "document_id, category"
        ).in_("document_id", doc_ids).execute()

        doc_redactions: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        for r in (red_result.data or []):
            doc_redactions[r["document_id"]][r.get("category", "?")] += 1

        # Compare redaction profiles between datasets
        if len(doc_redactions) < 2:
            continue

        # Calculate total redactions per doc
        doc_totals = {did: sum(cats.values()) for did, cats in doc_redactions.items()}

        # Find max difference
        totals = list(doc_totals.values())
        if not totals:
            continue

        max_total = max(totals)
        min_total = min(totals)

        if max_total <= 2 or (max_total - min_total) < 5:
            continue

        ratio = max_total / max(min_total, 1)
        if ratio < 2:
            continue

        # Find the docs with max and min redactions
        max_doc_id = max(doc_totals, key=doc_totals.get)
        min_doc_id = min(doc_totals, key=doc_totals.get)
        max_doc = next(d for d in docs if d["id"] == max_doc_id)
        min_doc = next(d for d in docs if d["id"] == min_doc_id)

        severity = "critical" if ratio > 5 else "high" if ratio > 3 else "medium"

        anomalies.append({
            "anomaly_type": "cross_dataset_redaction_inconsistency",
            "severity": severity,
            "score": min(100, ratio * 15),
            "title": f"'{title[:60]}': {max_total} vs {min_total} redactions across datasets",
            "description": (
                f"Near-duplicate documents titled '{title[:80]}' appear in datasets "
                f"{max_doc.get('dataset_id')} and {min_doc.get('dataset_id')} with significantly "
                f"different redaction counts ({max_total} vs {min_total}, {ratio:.1f}x difference). "
                f"This may indicate that one release was more heavily redacted than another."
            ),
            "entity_ids": [],
            "document_ids": [max_doc_id, min_doc_id],
            "evidence": {
                "title": title,
                "max_redactions": max_total,
                "min_redactions": min_total,
                "ratio": round(ratio, 2),
                "max_doc_bates": max_doc.get("bates_number"),
                "min_doc_bates": min_doc.get("bates_number"),
                "max_doc_dataset": max_doc.get("dataset_id"),
                "min_doc_dataset": min_doc.get("dataset_id"),
                "max_doc_categories": dict(doc_redactions.get(max_doc_id, {})),
                "min_doc_categories": dict(doc_redactions.get(min_doc_id, {})),
            },
        })

    anomalies.sort(key=lambda x: x["score"], reverse=True)
    anomalies = anomalies[:30]

    console.print(f"    Found {len(anomalies)} cross-dataset inconsistencies")
    return anomalies


def run() -> list[dict]:
    """Run all document anomaly detectors."""
    anomalies = []
    for fn in [detect_entity_density_outliers, detect_type_redaction_combos, detect_cross_dataset_inconsistency]:
        try:
            anomalies.extend(fn())
        except Exception as e:
            console.print(f"    [yellow]Skipped {fn.__name__}: {e}[/]")
    return anomalies
