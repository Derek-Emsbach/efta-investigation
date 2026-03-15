"""Generate document embeddings using sentence-transformers.

Uses all-MiniLM-L6-v2 (384-dim, ~80MB) to embed the first 512 tokens
of each entity-linked document's extracted text. Stores embeddings in
R2 and builds a FAISS flat index for nearest-neighbor search.
"""

import io
import sys
from pathlib import Path

import numpy as np
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn

sys.path.insert(0, str(Path(__file__).parent.parent))
import db
import storage
from config import EMBEDDING_MODEL, ML_MODELS_DIR

console = Console()

EMBEDDING_DIM = 384
MAX_TEXT_LENGTH = 2000  # Characters (~512 tokens)


def load_model():
    """Load the sentence-transformers model."""
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        console.print("[red]Error: sentence-transformers not installed.[/]")
        console.print("  pip install sentence-transformers")
        raise

    console.print(f"  Loading model: {EMBEDDING_MODEL}")
    model = SentenceTransformer(EMBEDDING_MODEL)
    return model


def get_documents_to_embed(limit: int = 0) -> list[dict]:
    """Get entity-linked documents that need embeddings.

    Returns documents that have entity_documents links, prioritizing
    those with higher-tier entity connections.
    """
    client = db.get_client()

    # Get unique document IDs from entity_documents
    result = client.table("entity_documents").select(
        "document_id"
    ).limit(60000).execute()

    doc_ids = list(set(r["document_id"] for r in (result.data or [])))
    console.print(f"  Found {len(doc_ids)} entity-linked documents")

    if limit > 0:
        doc_ids = doc_ids[:limit]

    # Fetch document metadata
    docs = []
    batch_size = 500
    for i in range(0, len(doc_ids), batch_size):
        batch = doc_ids[i:i + batch_size]
        batch_docs = db.get_documents_by_ids(batch)
        docs.extend(batch_docs)

    return docs


def embed_batch(model, texts: list[str]) -> np.ndarray:
    """Embed a batch of texts, returning a (N, 384) array."""
    embeddings = model.encode(
        texts,
        show_progress_bar=False,
        normalize_embeddings=True,
        batch_size=32,
    )
    return np.array(embeddings, dtype=np.float32)


def run(limit: int = 0, skip_existing: bool = True):
    """Generate embeddings for entity-linked documents.

    Args:
        limit: Max documents to embed (0 = all).
        skip_existing: Skip documents that already have embeddings in R2.
    """
    console.print("[bold]Generating document embeddings...[/]\n")

    model = load_model()
    docs = get_documents_to_embed(limit)

    if not docs:
        console.print("[yellow]No documents to embed.[/]")
        return

    # Download text and embed
    all_embeddings: dict[str, np.ndarray] = {}
    skipped = 0
    failed = 0

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("{task.completed}/{task.total}"),
        console=console,
    ) as progress:
        task = progress.add_task("Embedding", total=len(docs))

        batch_texts = []
        batch_bates = []
        batch_ids = []

        for doc in docs:
            bates = doc.get("bates_number", "")

            # Check if embedding already exists
            if skip_existing and bates:
                existing = storage.download_embedding(bates)
                if existing is not None:
                    skipped += 1
                    progress.update(task, advance=1)
                    continue

            # Download text
            text = None
            if bates:
                text = storage.download_text(bates)

            if not text or len(text.strip()) < 50:
                failed += 1
                progress.update(task, advance=1)
                continue

            # Truncate to max length
            text = text[:MAX_TEXT_LENGTH]

            batch_texts.append(text)
            batch_bates.append(bates)
            batch_ids.append(doc["id"])

            # Process in batches of 64
            if len(batch_texts) >= 64:
                embeddings = embed_batch(model, batch_texts)
                for j, (b, emb) in enumerate(zip(batch_bates, embeddings)):
                    all_embeddings[b] = emb
                    # Upload to R2
                    buf = io.BytesIO()
                    np.save(buf, emb)
                    storage.upload_embedding(b, buf.getvalue())

                progress.update(task, advance=len(batch_texts))
                batch_texts = []
                batch_bates = []
                batch_ids = []

        # Process remaining batch
        if batch_texts:
            embeddings = embed_batch(model, batch_texts)
            for j, (b, emb) in enumerate(zip(batch_bates, embeddings)):
                all_embeddings[b] = emb
                buf = io.BytesIO()
                np.save(buf, emb)
                storage.upload_embedding(b, buf.getvalue())

            progress.update(task, advance=len(batch_texts))

    console.print(f"\n  Embedded: {len(all_embeddings)}")
    console.print(f"  Skipped (existing): {skipped}")
    console.print(f"  Failed (no text): {failed}")

    # Build FAISS index
    if all_embeddings:
        build_faiss_index(all_embeddings)

    return all_embeddings


def build_faiss_index(embeddings: dict[str, np.ndarray] | None = None):
    """Build a FAISS flat index from embeddings.

    If embeddings dict not provided, downloads all from R2.
    Saves index locally to ML_MODELS_DIR/faiss_index/.
    """
    try:
        import faiss
    except ImportError:
        console.print("[yellow]Warning: faiss-cpu not installed, skipping index build.[/]")
        return

    console.print("\n[bold]Building FAISS index...[/]")

    if embeddings is None:
        console.print("  Loading embeddings from R2...")
        # This would need a listing mechanism — for now, skip
        console.print("  [yellow]No embeddings provided and R2 listing not implemented. Skipping.[/]")
        return

    bates_list = sorted(embeddings.keys())
    if not bates_list:
        console.print("  No embeddings to index.")
        return

    # Stack into matrix
    matrix = np.stack([embeddings[b] for b in bates_list]).astype(np.float32)
    console.print(f"  Matrix shape: {matrix.shape}")

    # Build flat L2 index (exact search, good for <100K vectors)
    index = faiss.IndexFlatIP(EMBEDDING_DIM)  # Inner product = cosine for normalized vectors
    index.add(matrix)

    # Save index and ID mapping
    index_dir = Path(ML_MODELS_DIR) / "faiss_index"
    index_dir.mkdir(parents=True, exist_ok=True)

    faiss.write_index(index, str(index_dir / "documents.index"))

    # Save bates mapping
    with open(index_dir / "bates_map.txt", "w") as f:
        for b in bates_list:
            f.write(f"{b}\n")

    console.print(f"  Index saved to {index_dir}")
    console.print(f"  {index.ntotal} vectors indexed")

    # Upload index to R2 for persistence
    index_bytes = Path(index_dir / "documents.index").read_bytes()
    storage.upload_file("ml-models/faiss_documents.index", index_bytes)

    map_bytes = (index_dir / "bates_map.txt").read_bytes()
    storage.upload_file("ml-models/faiss_bates_map.txt", map_bytes)

    console.print("  Index uploaded to R2")
