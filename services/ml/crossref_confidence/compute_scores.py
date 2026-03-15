"""Compute multi-signal cross-reference confidence scores.

For each entity-linked document, find the top-50 most similar documents
by embedding, then score each pair using 4 signals:

| Signal                    | Weight | Scoring                                    |
|---------------------------|--------|--------------------------------------------|
| Entity co-occurrence      | 0.35   | shared_count × 20, cap 100                |
| Semantic similarity       | 0.30   | cosine similarity × 100                   |
| Temporal proximity        | 0.20   | same day=100, week=80, month=60, year=30  |
| Document type compat      | 0.15   | lookup matrix (e.g. FBI-302+memo = 90)    |
"""

import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import numpy as np
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn

sys.path.insert(0, str(Path(__file__).parent.parent))
import db
from config import ML_MODELS_DIR

console = Console()

# Document type compatibility matrix (higher = more interesting cross-reference)
TYPE_COMPAT = {
    ("fbi_302", "prosecution_memo"): 90,
    ("fbi_302", "grand_jury"): 85,
    ("prosecution_memo", "grand_jury"): 85,
    ("fbi_302", "plea_agreement"): 80,
    ("correspondence", "financial"): 75,
    ("fbi_302", "fbi_302"): 70,
    ("correspondence", "correspondence"): 40,
    ("financial", "financial"): 50,
}

# Symmetric lookup
for (a, b), v in list(TYPE_COMPAT.items()):
    TYPE_COMPAT[(b, a)] = v

DEFAULT_TYPE_COMPAT = 50


def _parse_date(date_str: str | None) -> datetime | None:
    if not date_str:
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f"):
        try:
            return datetime.strptime(date_str.split("+")[0].split("Z")[0], fmt)
        except ValueError:
            continue
    return None


def temporal_score(date_a: datetime | None, date_b: datetime | None) -> float:
    """Score temporal proximity between two document dates."""
    if not date_a or not date_b:
        return 0.0

    delta = abs((date_a - date_b).days)
    if delta == 0:
        return 100.0
    if delta <= 7:
        return 80.0
    if delta <= 30:
        return 60.0
    if delta <= 365:
        return 30.0
    return 10.0


def type_compat_score(type_a: str, type_b: str) -> float:
    """Score document type compatibility."""
    key = (type_a.lower(), type_b.lower())
    return TYPE_COMPAT.get(key, DEFAULT_TYPE_COMPAT)


def load_faiss_index():
    """Load the FAISS index and bates mapping."""
    try:
        import faiss
    except ImportError:
        console.print("[red]Error: faiss-cpu not installed.[/]")
        raise

    index_dir = Path(ML_MODELS_DIR) / "faiss_index"

    index_path = index_dir / "documents.index"
    map_path = index_dir / "bates_map.txt"

    if not index_path.exists():
        console.print("[red]Error: FAISS index not found. Run embed-documents first.[/]")
        return None, None

    index = faiss.read_index(str(index_path))
    bates_list = map_path.read_text().strip().split("\n")

    console.print(f"  Loaded FAISS index: {index.ntotal} vectors")
    console.print(f"  Bates map: {len(bates_list)} entries")

    return index, bates_list


def run(top_k: int = 50, min_score: float = 30.0, batch_size: int = 1000):
    """Compute cross-reference scores for all indexed documents.

    Args:
        top_k: Number of nearest neighbors per document.
        min_score: Minimum composite score to store.
        batch_size: Documents to process per database write.
    """
    console.print("[bold]Computing cross-reference confidence scores...[/]\n")

    # Load FAISS index
    index, bates_list = load_faiss_index()
    if index is None:
        return

    n_docs = len(bates_list)
    bates_to_idx = {b: i for i, b in enumerate(bates_list)}

    # Load document metadata for scoring signals
    console.print("  Loading document metadata...")
    client = db.get_client()

    # Get document records by bates number
    doc_map: dict[str, dict] = {}
    for i in range(0, len(bates_list), 500):
        batch = bates_list[i:i + 500]
        result = client.table("documents").select(
            "id, bates_number, document_type, original_date, dataset_id"
        ).in_("bates_number", batch).execute()
        for d in (result.data or []):
            doc_map[d["bates_number"]] = d

    console.print(f"  Loaded metadata for {len(doc_map)} documents")

    # Build entity co-occurrence counts
    console.print("  Building entity co-occurrence matrix...")
    result = client.table("entity_documents").select(
        "entity_id, document_id"
    ).limit(60000).execute()

    doc_entities: dict[str, set[str]] = defaultdict(set)
    for r in (result.data or []):
        doc_entities[r["document_id"]].add(r["entity_id"])

    # Map document IDs to bates numbers for co-occurrence lookup
    doc_id_to_bates: dict[str, str] = {}
    for bates, doc in doc_map.items():
        doc_id_to_bates[doc["id"]] = bates

    # Reconstruct embeddings matrix for FAISS search
    # The index already has them, so we use index.reconstruct_n
    console.print("  Reconstructing embedding matrix...")
    try:
        all_embeddings = np.zeros((n_docs, index.d), dtype=np.float32)
        for i in range(n_docs):
            all_embeddings[i] = index.reconstruct(i)
    except Exception:
        console.print("  [yellow]Cannot reconstruct from index, searching in batches instead[/]")
        all_embeddings = None

    # Search for nearest neighbors
    console.print(f"  Finding top-{top_k} neighbors for each document...")

    all_scored_pairs = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("{task.completed}/{task.total}"),
        console=console,
    ) as progress:
        task = progress.add_task("Scoring", total=n_docs)

        for i in range(0, n_docs, 100):
            chunk_end = min(i + 100, n_docs)

            if all_embeddings is not None:
                query_vectors = all_embeddings[i:chunk_end]
            else:
                query_vectors = np.array([
                    index.reconstruct(j) for j in range(i, chunk_end)
                ], dtype=np.float32)

            # Search FAISS
            similarities, indices = index.search(query_vectors, top_k + 1)  # +1 for self-match

            for q_offset in range(chunk_end - i):
                q_idx = i + q_offset
                q_bates = bates_list[q_idx]
                q_doc = doc_map.get(q_bates, {})
                q_doc_id = q_doc.get("id", "")
                q_date = _parse_date(q_doc.get("original_date"))
                q_type = q_doc.get("document_type", "unknown")
                q_entities = doc_entities.get(q_doc_id, set())

                for rank in range(top_k + 1):
                    n_idx = int(indices[q_offset][rank])
                    if n_idx < 0 or n_idx >= n_docs or n_idx == q_idx:
                        continue

                    n_bates = bates_list[n_idx]
                    n_doc = doc_map.get(n_bates, {})
                    n_doc_id = n_doc.get("id", "")
                    n_date = _parse_date(n_doc.get("original_date"))
                    n_type = n_doc.get("document_type", "unknown")
                    n_entities = doc_entities.get(n_doc_id, set())

                    # Only store each pair once (lower bates first)
                    if q_bates > n_bates:
                        continue

                    # Signal 1: Semantic similarity (already cosine for normalized vectors)
                    sim = float(similarities[q_offset][rank])
                    semantic = sim * 100

                    # Signal 2: Entity co-occurrence
                    shared = len(q_entities & n_entities) if q_entities and n_entities else 0
                    cooccurrence = min(100, shared * 20)

                    # Signal 3: Temporal proximity
                    temporal = temporal_score(q_date, n_date)

                    # Signal 4: Document type compatibility
                    type_compat = type_compat_score(q_type, n_type)

                    # Weighted composite score
                    composite = (
                        0.35 * cooccurrence +
                        0.30 * semantic +
                        0.20 * temporal +
                        0.15 * type_compat
                    )

                    if composite >= min_score:
                        all_scored_pairs.append({
                            "document_a": q_doc_id,
                            "document_b": n_doc_id,
                            "score": round(composite, 2),
                            "score_components": {
                                "entity_cooccurrence": round(cooccurrence, 2),
                                "semantic_similarity": round(semantic, 2),
                                "temporal_proximity": round(temporal, 2),
                                "type_compatibility": round(type_compat, 2),
                            },
                        })

            progress.update(task, advance=chunk_end - i)

    console.print(f"\n  Scored pairs above threshold: {len(all_scored_pairs)}")

    if not all_scored_pairs:
        console.print("[yellow]No pairs scored above threshold.[/]")
        return

    # Deduplicate (keep highest score per pair)
    pair_scores: dict[tuple[str, str], dict] = {}
    for p in all_scored_pairs:
        key = (p["document_a"], p["document_b"])
        if key not in pair_scores or p["score"] > pair_scores[key]["score"]:
            pair_scores[key] = p

    unique_pairs = list(pair_scores.values())
    console.print(f"  Unique pairs: {len(unique_pairs)}")

    # Sort by score descending
    unique_pairs.sort(key=lambda x: x["score"], reverse=True)

    # Store in database
    console.print("  Writing to ml_crossref_scores...")
    total_stored = 0
    for i in range(0, len(unique_pairs), batch_size):
        batch = unique_pairs[i:i + batch_size]
        count = db.upsert_crossref_scores(batch)
        total_stored += count

    console.print(f"\n[green]  Stored {total_stored} cross-reference scores.[/]")
    console.print(f"  Score range: {unique_pairs[-1]['score']:.1f} — {unique_pairs[0]['score']:.1f}")

    # Distribution summary
    brackets = [(90, 100), (70, 90), (50, 70), (30, 50)]
    for lo, hi in brackets:
        count = sum(1 for p in unique_pairs if lo <= p["score"] < hi)
        console.print(f"    {lo}-{hi}: {count:,} pairs")
