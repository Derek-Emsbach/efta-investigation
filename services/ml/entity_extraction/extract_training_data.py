"""Extract NER training data from entity_documents + full document text.

Converts entity_documents records (entity_id, excerpt, page_number) into
character-level span annotations suitable for spaCy NER training.

Output: JSONL with {document_id, bates, text, entities: [{name, start, end, label}]}
"""

import json
import sys
from pathlib import Path
from collections import defaultdict
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn

sys.path.insert(0, str(Path(__file__).parent.parent))
import db
import storage

console = Console()

# Map entity_type + category to NER labels
LABEL_MAP: dict[str, str] = {
    "person": "PERSON",
    "organization": "ORG",
    "property": "PROPERTY",
    "trust": "TRUST",
    "vehicle": "ORG",
    "agency": "ORG",
    "financial_institution": "ORG",
    "law_firm": "ORG",
}

CATEGORY_LABEL_MAP: dict[str, str] = {
    "victim": "VICTIM",
    "attorney": "ATTORNEY",
    "prosecutor": "PROSECUTOR",
    "suspect": "SUSPECT",
}


def get_ner_label(entity: dict) -> str:
    """Determine the NER label for an entity based on its type and category."""
    category = (entity.get("category") or "").lower()
    if category in CATEGORY_LABEL_MAP:
        return CATEGORY_LABEL_MAP[category]

    entity_type = (entity.get("entity_type") or "person").lower()
    return LABEL_MAP.get(entity_type, "PERSON")


def find_entity_spans(text: str, entity_name: str, aliases: list[str] | None) -> list[tuple[int, int, str]]:
    """Find all occurrences of entity name (and aliases) in text.

    Returns list of (start, end, matched_name) tuples.
    """
    spans: list[tuple[int, int, str]] = []
    names = [entity_name] + (aliases or [])

    # Sort by length descending to match longest first
    names = sorted(set(n for n in names if n), key=len, reverse=True)

    text_lower = text.lower()
    used_ranges: set[tuple[int, int]] = set()

    for name in names:
        name_lower = name.lower()
        start = 0
        while True:
            idx = text_lower.find(name_lower, start)
            if idx == -1:
                break

            end = idx + len(name)

            # Check word boundaries
            if idx > 0 and text_lower[idx - 1].isalnum():
                start = idx + 1
                continue
            if end < len(text_lower) and text_lower[end].isalnum():
                start = idx + 1
                continue

            # Check for overlap with existing spans
            overlaps = any(
                not (end <= s or idx >= e)
                for s, e in used_ranges
            )
            if not overlaps:
                spans.append((idx, end, name))
                used_ranges.add((idx, end))

            start = idx + 1

    return spans


def run(reviewed_only: bool = False, output_path: str = "training_data.jsonl"):
    """Extract training data and write to JSONL."""
    console.print("[bold]Extracting NER training data...[/]\n")

    # Fetch all entities
    entities = db.get_all_entities()
    entity_map = {e["id"]: e for e in entities}
    console.print(f"  Loaded {len(entities)} entities")

    # Fetch entity_documents links, grouped by document
    console.print("  Fetching entity_documents links...")
    total_links = db.get_entity_documents_count()
    console.print(f"  Total links: {total_links:,}")

    # Fetch in batches
    doc_entities: dict[str, list[dict]] = defaultdict(list)
    batch_size = 10000
    offset = 0

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("{task.completed}/{task.total}"),
        console=console,
    ) as progress:
        task = progress.add_task("Fetching links", total=total_links)

        while offset < total_links:
            batch = db.get_entity_documents(limit=batch_size, offset=offset)
            if not batch:
                break
            for link in batch:
                doc_entities[link["document_id"]].append(link)
            progress.update(task, advance=len(batch))
            offset += batch_size

    # Get unique document IDs
    all_doc_ids = list(doc_entities.keys())
    console.print(f"  Unique documents with entity links: {len(all_doc_ids):,}")

    # If reviewed_only, filter to reviewed documents
    if reviewed_only:
        console.print("  Filtering to reviewed documents only...")
        reviewed_docs = db.get_documents_by_ids(all_doc_ids[:1000])  # Sample first
        reviewed_ids = {
            d["id"] for d in reviewed_docs
            if d.get("processing_status") == "reviewed"
        }
        all_doc_ids = [d for d in all_doc_ids if d in reviewed_ids]
        console.print(f"  Reviewed documents: {len(all_doc_ids)}")

    # Process documents and extract span annotations
    output_file = Path(output_path)
    written = 0
    skipped = 0

    with (
        output_file.open("w") as f,
        Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("{task.completed}/{task.total}"),
            console=console,
        ) as progress,
    ):
        task = progress.add_task("Processing documents", total=len(all_doc_ids))

        for doc_id in all_doc_ids:
            progress.update(task, advance=1)

            # Get document metadata
            links = doc_entities[doc_id]
            if not links:
                skipped += 1
                continue

            # Get first link to find bates number
            sample_doc = db.get_document(doc_id)
            if not sample_doc or not sample_doc.get("bates_number"):
                skipped += 1
                continue

            bates = sample_doc["bates_number"]

            # Download full text from R2
            text = storage.download_text(bates)
            if not text or len(text) < 50:
                skipped += 1
                continue

            # Find entity spans in full text
            all_spans: list[dict] = []
            seen_spans: set[tuple[int, int]] = set()

            for link in links:
                entity = entity_map.get(link["entity_id"])
                if not entity:
                    continue

                label = get_ner_label(entity)
                spans = find_entity_spans(
                    text,
                    entity["name"],
                    entity.get("aliases"),
                )

                for start, end, matched_name in spans:
                    if (start, end) not in seen_spans:
                        all_spans.append({
                            "name": matched_name,
                            "start": start,
                            "end": end,
                            "label": label,
                            "entity_id": entity["id"],
                        })
                        seen_spans.add((start, end))

            if not all_spans:
                skipped += 1
                continue

            # Sort spans by start position
            all_spans.sort(key=lambda s: s["start"])

            record = {
                "document_id": doc_id,
                "bates": bates,
                "text_length": len(text),
                "text": text[:50000],  # Cap at 50K chars for training
                "entities": all_spans,
                "entity_count": len(all_spans),
                "is_reviewed": sample_doc.get("processing_status") == "reviewed",
            }

            f.write(json.dumps(record) + "\n")
            written += 1

    console.print(f"\n[bold green]Done![/] Written {written:,} documents, skipped {skipped:,}")
    console.print(f"  Output: {output_file.absolute()}")
