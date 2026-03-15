"""Mine entity_documents for co-occurring entity pairs.

Finds pairs of entities that appear in the same documents but have
no existing connection record.
"""

import sys
from collections import Counter, defaultdict
from pathlib import Path

from rich.console import Console

sys.path.insert(0, str(Path(__file__).parent.parent))
import db

console = Console()


def run(min_shared_docs: int = 2) -> list[dict]:
    """Find entity pairs co-occurring in documents without connections.

    Returns list of {entity_a, entity_b, shared_count, shared_doc_ids} dicts,
    sorted by shared_count descending.
    """
    console.print("[bold]Mining entity co-occurrences...[/]\n")

    # Fetch all entity_documents links
    total = db.get_entity_documents_count()
    console.print(f"  Total entity_documents links: {total:,}")

    # Build document → entities mapping
    doc_entities: dict[str, set[str]] = defaultdict(set)
    batch_size = 10000
    offset = 0

    while offset < total:
        batch = db.get_entity_documents(limit=batch_size, offset=offset)
        if not batch:
            break
        for link in batch:
            doc_entities[link["document_id"]].add(link["entity_id"])
        offset += batch_size

    console.print(f"  Documents with entity links: {len(doc_entities):,}")

    # Count entity pair co-occurrences
    pair_docs: dict[tuple[str, str], list[str]] = defaultdict(list)

    for doc_id, entity_ids in doc_entities.items():
        entities = sorted(entity_ids)
        for i, ea in enumerate(entities):
            for eb in entities[i + 1:]:
                pair_docs[(ea, eb)].append(doc_id)

    console.print(f"  Total entity pairs with co-occurrence: {len(pair_docs):,}")

    # Filter by minimum shared documents
    filtered = {
        pair: docs for pair, docs in pair_docs.items()
        if len(docs) >= min_shared_docs
    }
    console.print(f"  Pairs with >= {min_shared_docs} shared docs: {len(filtered):,}")

    # Fetch existing connections to exclude
    connections = db.get_connections()
    existing_pairs: set[tuple[str, str]] = set()
    for conn in connections:
        ea = conn.get("entity_a", "")
        eb = conn.get("entity_b", "")
        if ea and eb:
            pair = tuple(sorted([ea, eb]))
            existing_pairs.add(pair)

    console.print(f"  Existing connections: {len(existing_pairs)}")

    # Filter out pairs with existing connections
    new_pairs = {
        pair: docs for pair, docs in filtered.items()
        if pair not in existing_pairs
    }
    console.print(f"  New candidate pairs: {len(new_pairs):,}")

    # Build output
    results = []
    for (ea, eb), doc_ids in new_pairs.items():
        results.append({
            "entity_a": ea,
            "entity_b": eb,
            "shared_count": len(doc_ids),
            "shared_doc_ids": doc_ids[:100],  # Cap at 100 doc IDs
        })

    # Sort by shared count descending
    results.sort(key=lambda x: x["shared_count"], reverse=True)

    console.print(f"\n  Top 10 pairs by co-occurrence:")
    entities = db.get_all_entities()
    entity_names = {e["id"]: e["name"] for e in entities}

    for pair in results[:10]:
        name_a = entity_names.get(pair["entity_a"], "Unknown")
        name_b = entity_names.get(pair["entity_b"], "Unknown")
        console.print(f"    {name_a} ↔ {name_b}: {pair['shared_count']:,} shared docs")

    return results
