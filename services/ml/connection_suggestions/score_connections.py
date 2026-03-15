"""Multi-signal confidence scoring for connection suggestions.

Combines co-occurrence frequency, context quality, document type diversity,
and entity tier relevance into a single confidence score (0-100).
"""

import sys
from pathlib import Path
from collections import Counter

from rich.console import Console

sys.path.insert(0, str(Path(__file__).parent.parent))
import db

console = Console()

# Weights for each scoring signal
WEIGHTS = {
    "frequency": 0.30,
    "context_quality": 0.30,
    "doc_type_diversity": 0.20,
    "tier_relevance": 0.20,
}


def score_frequency(shared_count: int) -> float:
    """Score based on number of shared documents. 0-100."""
    if shared_count >= 50:
        return 100
    if shared_count >= 20:
        return 80
    if shared_count >= 10:
        return 60
    if shared_count >= 5:
        return 40
    if shared_count >= 2:
        return 20
    return 0


def score_doc_type_diversity(context_excerpts: list[dict]) -> float:
    """Score based on diversity of document types in co-occurrences. 0-100."""
    doc_types = set()
    for exc in context_excerpts:
        dt = exc.get("document_type")
        if dt:
            doc_types.add(dt)

    n = len(doc_types)
    if n >= 4:
        return 100
    if n >= 3:
        return 80
    if n >= 2:
        return 50
    if n >= 1:
        return 20
    return 0


def score_tier_relevance(tier_a: int | None, tier_b: int | None) -> float:
    """Score based on entity tiers (lower tier = higher relevance). 0-100."""
    ta = tier_a or 6
    tb = tier_b or 6
    min_tier = min(ta, tb)

    if min_tier <= 1:
        return 100
    if min_tier <= 2:
        return 80
    if min_tier <= 3:
        return 60
    if min_tier <= 4:
        return 40
    return 20


def run(pairs: list[dict]) -> list[dict]:
    """Score and sort connection suggestions.

    Expects pairs with 'context_excerpts' and 'context_quality' from extract_context.
    Adds 'confidence' and 'score_components' to each pair.
    Inserts results into ml_connection_suggestions table.
    """
    console.print("[bold]Scoring connection suggestions...[/]\n")

    # Load entity info for tiers
    entities = db.get_all_entities()
    entity_map = {e["id"]: e for e in entities}

    for pair in pairs:
        entity_a = entity_map.get(pair["entity_a"], {})
        entity_b = entity_map.get(pair["entity_b"], {})

        freq = score_frequency(pair["shared_count"])
        ctx = pair.get("context_quality", 0)
        diversity = score_doc_type_diversity(pair.get("context_excerpts", []))
        tier = score_tier_relevance(entity_a.get("tier"), entity_b.get("tier"))

        confidence = int(
            freq * WEIGHTS["frequency"]
            + ctx * WEIGHTS["context_quality"]
            + diversity * WEIGHTS["doc_type_diversity"]
            + tier * WEIGHTS["tier_relevance"]
        )

        pair["confidence"] = min(100, confidence)
        pair["score_components"] = {
            "frequency": freq,
            "context_quality": ctx,
            "document_type_diversity": diversity,
            "entity_tier_relevance": tier,
        }

    # Sort by confidence descending
    pairs.sort(key=lambda x: x["confidence"], reverse=True)

    # Insert into database
    rows = []
    for pair in pairs:
        # Format context excerpts for storage
        ctx_excerpts = [
            {
                "document_id": exc["document_id"],
                "excerpt": exc["excerpt"][:500],  # Cap excerpt length
                "distance": exc.get("distance"),
            }
            for exc in pair.get("context_excerpts", [])
        ]

        rows.append({
            "entity_a": pair["entity_a"],
            "entity_b": pair["entity_b"],
            "suggested_type": "connected_to",  # Default; classify_type will update
            "confidence": pair["confidence"],
            "co_occurrence_count": pair["shared_count"],
            "shared_document_ids": pair["shared_doc_ids"][:50],
            "context_excerpts": ctx_excerpts,
            "score_components": pair["score_components"],
            "status": "pending",
        })

    if rows:
        count = db.upsert_connection_suggestions(rows)
        console.print(f"  Stored {count} connection suggestions")

    # Summary
    if pairs:
        avg_confidence = sum(p["confidence"] for p in pairs) / len(pairs)
        high_conf = sum(1 for p in pairs if p["confidence"] >= 70)
        console.print(f"  Average confidence: {avg_confidence:.1f}")
        console.print(f"  High confidence (>= 70): {high_conf}")

    return pairs
