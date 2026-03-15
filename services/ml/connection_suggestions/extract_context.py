"""Extract context excerpts around entity co-occurrences.

For each candidate pair, finds passages in shared documents where both
entity names appear within proximity of each other.
"""

import re
import sys
from pathlib import Path

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn

sys.path.insert(0, str(Path(__file__).parent.parent))
import db
import storage

console = Console()

CONTEXT_WINDOW = 500  # Characters around co-occurrence
MAX_EXCERPTS_PER_PAIR = 10
MAX_DOCS_TO_SCAN = 20  # Don't scan more than 20 docs per pair


def find_proximity_excerpts(
    text: str,
    name_a: str,
    name_b: str,
    aliases_a: list[str],
    aliases_b: list[str],
) -> list[dict]:
    """Find passages where both entities appear within CONTEXT_WINDOW chars."""
    excerpts = []

    # Build patterns for both entities
    names_a = [name_a] + [a for a in aliases_a if a]
    names_b = [name_b] + [a for a in aliases_b if a]

    # Find all occurrences of entity A
    positions_a: list[tuple[int, int]] = []
    for name in names_a:
        for m in re.finditer(re.escape(name), text, re.IGNORECASE):
            positions_a.append((m.start(), m.end()))

    # Find all occurrences of entity B
    positions_b: list[tuple[int, int]] = []
    for name in names_b:
        for m in re.finditer(re.escape(name), text, re.IGNORECASE):
            positions_b.append((m.start(), m.end()))

    if not positions_a or not positions_b:
        return []

    # Find closest pairs
    for start_a, end_a in positions_a:
        for start_b, end_b in positions_b:
            distance = abs(start_a - start_b)
            if distance <= CONTEXT_WINDOW:
                # Extract context window around both mentions
                ctx_start = max(0, min(start_a, start_b) - 100)
                ctx_end = min(len(text), max(end_a, end_b) + 100)
                excerpt = text[ctx_start:ctx_end].strip()

                excerpts.append({
                    "excerpt": excerpt,
                    "distance": distance,
                    "position_a": start_a,
                    "position_b": start_b,
                })

    # Deduplicate overlapping excerpts, keep closest
    excerpts.sort(key=lambda x: x["distance"])
    deduped: list[dict] = []
    used_positions: set[int] = set()

    for exc in excerpts:
        pos_key = exc["position_a"] // 200  # Group by ~200 char buckets
        if pos_key not in used_positions:
            deduped.append(exc)
            used_positions.add(pos_key)
        if len(deduped) >= MAX_EXCERPTS_PER_PAIR:
            break

    return deduped


def score_context_quality(excerpts: list[dict]) -> float:
    """Score context quality based on proximity of co-occurrences.

    Returns 0-100 score.
    """
    if not excerpts:
        return 0.0

    distances = [e["distance"] for e in excerpts]
    min_dist = min(distances)
    avg_dist = sum(distances) / len(distances)

    # Same sentence (< 100 chars) = 100, paragraph (< 300) = 70, page (< 500) = 40
    if min_dist < 100:
        base_score = 100
    elif min_dist < 300:
        base_score = 70
    elif min_dist < 500:
        base_score = 40
    else:
        base_score = 10

    # Bonus for multiple close excerpts
    close_count = sum(1 for d in distances if d < 200)
    bonus = min(20, close_count * 5)

    return min(100, base_score + bonus)


def run(pairs: list[dict]) -> list[dict]:
    """Extract context for each entity pair from shared documents.

    Adds 'context_excerpts' and 'context_quality' to each pair dict.
    """
    console.print("[bold]Extracting context from shared documents...[/]\n")

    # Load entity info
    entities = db.get_all_entities()
    entity_map = {e["id"]: e for e in entities}

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("{task.completed}/{task.total}"),
        console=console,
    ) as progress:
        task = progress.add_task("Extracting context", total=len(pairs))

        for pair in pairs:
            progress.update(task, advance=1)

            entity_a = entity_map.get(pair["entity_a"])
            entity_b = entity_map.get(pair["entity_b"])

            if not entity_a or not entity_b:
                pair["context_excerpts"] = []
                pair["context_quality"] = 0
                continue

            # Scan shared documents for proximity excerpts
            all_excerpts: list[dict] = []
            docs_to_scan = pair["shared_doc_ids"][:MAX_DOCS_TO_SCAN]

            # Get bates numbers for shared docs
            docs = db.get_documents_by_ids(docs_to_scan)
            bates_map = {d["id"]: d.get("bates_number") for d in docs}
            doc_type_map = {d["id"]: d.get("document_type") for d in docs}

            for doc_id in docs_to_scan:
                bates = bates_map.get(doc_id)
                if not bates:
                    continue

                text = storage.download_text(bates)
                if not text:
                    continue

                excerpts = find_proximity_excerpts(
                    text,
                    entity_a["name"],
                    entity_b["name"],
                    entity_a.get("aliases") or [],
                    entity_b.get("aliases") or [],
                )

                for exc in excerpts:
                    exc["document_id"] = doc_id
                    exc["document_type"] = doc_type_map.get(doc_id)
                    all_excerpts.append(exc)

            # Sort by distance, keep top N
            all_excerpts.sort(key=lambda x: x["distance"])
            pair["context_excerpts"] = all_excerpts[:MAX_EXCERPTS_PER_PAIR]
            pair["context_quality"] = score_context_quality(all_excerpts)

    # Count pairs with context
    with_context = sum(1 for p in pairs if p.get("context_excerpts"))
    console.print(f"\n  Pairs with context: {with_context}/{len(pairs)}")

    return pairs
