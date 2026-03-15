"""Utilities for managing embeddings storage.

Provides functions to list, verify, and rebuild embedding stores.
"""

import io
import sys
from pathlib import Path

import numpy as np
from rich.console import Console

sys.path.insert(0, str(Path(__file__).parent.parent))
import db
import storage
from config import ML_MODELS_DIR

console = Console()

EMBEDDING_DIM = 384


def verify_embeddings(sample_size: int = 100) -> dict:
    """Verify embedding integrity by sampling and checking dimensions.

    Returns stats about the embedding store.
    """
    console.print("[bold]Verifying embedding store...[/]\n")

    # Get entity-linked documents
    client = db.get_client()
    result = client.table("entity_documents").select(
        "document_id"
    ).limit(60000).execute()

    doc_ids = list(set(r["document_id"] for r in (result.data or [])))

    # Get bates numbers
    docs = db.get_documents_by_ids(doc_ids[:5000])
    bates_numbers = [d["bates_number"] for d in docs if d.get("bates_number")]

    console.print(f"  Total entity-linked docs: {len(doc_ids)}")
    console.print(f"  With bates numbers: {len(bates_numbers)}")

    # Sample and verify
    import random
    sample = random.sample(bates_numbers, min(sample_size, len(bates_numbers)))

    found = 0
    valid = 0
    invalid = 0

    for bates in sample:
        data = storage.download_embedding(bates)
        if data is None:
            continue
        found += 1

        try:
            emb = np.load(io.BytesIO(data))
            if emb.shape == (EMBEDDING_DIM,):
                valid += 1
            else:
                invalid += 1
                console.print(f"  [yellow]Wrong shape for {bates}: {emb.shape}[/]")
        except Exception as e:
            invalid += 1
            console.print(f"  [red]Failed to load {bates}: {e}[/]")

    coverage = found / len(sample) * 100 if sample else 0

    stats = {
        "total_docs": len(doc_ids),
        "sample_size": len(sample),
        "found": found,
        "valid": valid,
        "invalid": invalid,
        "coverage_pct": round(coverage, 1),
    }

    console.print(f"\n  Sampled: {len(sample)}")
    console.print(f"  Found in R2: {found} ({coverage:.1f}%)")
    console.print(f"  Valid: {valid}")
    console.print(f"  Invalid: {invalid}")

    return stats


def rebuild_faiss_from_r2(limit: int = 0):
    """Rebuild the FAISS index by downloading embeddings from R2.

    This is useful when the local index is lost but embeddings exist in R2.
    """
    try:
        import faiss
    except ImportError:
        console.print("[red]Error: faiss-cpu not installed.[/]")
        return

    console.print("[bold]Rebuilding FAISS index from R2...[/]\n")

    # Get all entity-linked documents
    client = db.get_client()
    result = client.table("entity_documents").select(
        "document_id"
    ).limit(60000).execute()

    doc_ids = list(set(r["document_id"] for r in (result.data or [])))
    docs = db.get_documents_by_ids(doc_ids[:5000])
    bates_numbers = [d["bates_number"] for d in docs if d.get("bates_number")]

    if limit > 0:
        bates_numbers = bates_numbers[:limit]

    console.print(f"  Checking {len(bates_numbers)} documents for embeddings...")

    embeddings: dict[str, np.ndarray] = {}

    for bates in bates_numbers:
        data = storage.download_embedding(bates)
        if data is not None:
            try:
                emb = np.load(io.BytesIO(data))
                if emb.shape == (EMBEDDING_DIM,):
                    embeddings[bates] = emb
            except Exception:
                pass

    console.print(f"  Found {len(embeddings)} valid embeddings")

    if not embeddings:
        console.print("[yellow]No embeddings found in R2.[/]")
        return

    # Build index
    bates_list = sorted(embeddings.keys())
    matrix = np.stack([embeddings[b] for b in bates_list]).astype(np.float32)

    index = faiss.IndexFlatIP(EMBEDDING_DIM)
    index.add(matrix)

    # Save locally
    index_dir = Path(ML_MODELS_DIR) / "faiss_index"
    index_dir.mkdir(parents=True, exist_ok=True)

    faiss.write_index(index, str(index_dir / "documents.index"))

    with open(index_dir / "bates_map.txt", "w") as f:
        for b in bates_list:
            f.write(f"{b}\n")

    console.print(f"\n  Index rebuilt: {index.ntotal} vectors")
    console.print(f"  Saved to {index_dir}")

    # Upload to R2
    index_bytes = Path(index_dir / "documents.index").read_bytes()
    storage.upload_file("ml-models/faiss_documents.index", index_bytes)

    map_bytes = (index_dir / "bates_map.txt").read_bytes()
    storage.upload_file("ml-models/faiss_bates_map.txt", map_bytes)

    console.print("  Uploaded to R2")
