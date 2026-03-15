"""EFTA ML Pipeline CLI — entry point for all ML operations."""

import click
from rich.console import Console

console = Console()


@click.group()
def cli():
    """EFTA ML Pipeline — entity extraction, cross-referencing, anomaly detection, connection suggestions."""
    pass


# ─────────────────────────────────────────────────
# Feature 1: Entity Extraction
# ─────────────────────────────────────────────────

@cli.command()
@click.option("--reviewed-only", is_flag=True, help="Only use reviewed documents as gold standard")
@click.option("--output", default="training_data.jsonl", help="Output JSONL file path")
def extract_training_data(reviewed_only: bool, output: str):
    """Extract entity extraction training data from entity_documents."""
    from entity_extraction.extract_training_data import run
    run(reviewed_only=reviewed_only, output_path=output)


@cli.command()
@click.option("--input", "input_path", default="training_data.jsonl", help="Input JSONL file")
@click.option("--output", default="spacy_data", help="Output directory for spaCy DocBin files")
def prepare_spacy(input_path: str, output: str):
    """Convert training data to spaCy NER format."""
    from entity_extraction.prepare_spacy_data import run
    run(input_path=input_path, output_dir=output)


@cli.command()
@click.option("--base-model", default=None, help="spaCy base model (default: from config)")
@click.option("--epochs", default=30, help="Training epochs")
@click.option("--data-dir", default="spacy_data", help="Directory with train/dev DocBin files")
def train_ner(base_model: str | None, epochs: int, data_dir: str):
    """Train spaCy NER model on extracted training data."""
    from entity_extraction.train_ner import run
    run(base_model=base_model, epochs=epochs, data_dir=data_dir)


@cli.command()
@click.option("--model-dir", default=None, help="Path to trained model (default: latest in models/)")
def evaluate_ner(model_dir: str | None):
    """Evaluate NER model vs regex+fuzzy baseline."""
    from entity_extraction.evaluate import run
    run(model_dir=model_dir)


# ─────────────────────────────────────────────────
# Feature 2: Cross-Referencing with Confidence
# ─────────────────────────────────────────────────

@cli.command()
@click.option("--batch-size", default=256, help="Documents per embedding batch")
@click.option("--limit", default=60000, help="Max documents to embed")
def embed_documents(batch_size: int, limit: int):
    """Generate document embeddings using sentence-transformers."""
    from crossref_confidence.embed_documents import run
    run(batch_size=batch_size, limit=limit)


@cli.command()
@click.option("--min-score", default=30, help="Minimum score to store")
@click.option("--top-k", default=50, help="Top K similar documents per document")
def compute_crossref(min_score: int, top_k: int):
    """Compute cross-reference confidence scores."""
    from crossref_confidence.compute_scores import run
    run(min_score=min_score, top_k=top_k)


# ─────────────────────────────────────────────────
# Feature 3: Anomaly Detection
# ─────────────────────────────────────────────────

@cli.command()
@click.option("--types", default="all", help="Comma-separated anomaly types or 'all'")
def detect_anomalies(types: str):
    """Run anomaly detection across redactions, timelines, and documents."""
    from anomaly_detection.run_all import run
    run(dry_run=False)


# ─────────────────────────────────────────────────
# Feature 4: Connection Suggestions
# ─────────────────────────────────────────────────

@cli.command()
@click.option("--min-shared-docs", default=2, help="Minimum shared documents for a suggestion")
@click.option("--classify/--no-classify", default=True, help="Use Claude API for type classification")
@click.option("--max-classify", default=500, help="Max pairs to send to Claude for classification")
def suggest_connections(min_shared_docs: int, classify: bool, max_classify: int):
    """Find entity co-occurrences and suggest connections."""
    from connection_suggestions.find_co_occurrences import run as find_pairs
    from connection_suggestions.extract_context import run as extract_ctx
    from connection_suggestions.score_connections import run as score
    from connection_suggestions.classify_type import run as classify_types

    console.print("[bold cyan]Step 1/4:[/] Finding co-occurring entity pairs...")
    pairs = find_pairs(min_shared_docs=min_shared_docs)
    console.print(f"  Found {len(pairs)} candidate pairs")

    console.print("[bold cyan]Step 2/4:[/] Extracting context from shared documents...")
    pairs_with_context = extract_ctx(pairs)

    console.print("[bold cyan]Step 3/4:[/] Scoring connections...")
    scored_pairs = score(pairs_with_context)

    if classify and scored_pairs:
        console.print(f"[bold cyan]Step 4/4:[/] Classifying relationship types (top {max_classify})...")
        classify_types(scored_pairs[:max_classify])
    else:
        console.print("[dim]Step 4/4: Skipping Claude classification[/]")

    console.print(f"[bold green]Done![/] {len(scored_pairs)} connection suggestions stored.")


# ─────────────────────────────────────────────────
# Full pipeline
# ─────────────────────────────────────────────────

@cli.command()
def run_all():
    """Run the full ML pipeline: anomalies + connections + crossref."""
    console.print("[bold]Running full ML pipeline...[/]\n")

    console.print("[bold cyan]═══ Anomaly Detection ═══[/]")
    from anomaly_detection.run_all import run as run_anomalies
    run_anomalies()

    console.print("\n[bold cyan]═══ Connection Suggestions ═══[/]")
    from connection_suggestions.find_co_occurrences import run as find_pairs
    from connection_suggestions.extract_context import run as extract_ctx
    from connection_suggestions.score_connections import run as score
    from connection_suggestions.classify_type import run as classify_types

    pairs = find_pairs(min_shared_docs=2)
    pairs_with_context = extract_ctx(pairs)
    scored = score(pairs_with_context)
    if scored:
        classify_types(scored[:500])

    console.print("\n[bold green]Pipeline complete![/]")


if __name__ == "__main__":
    cli()
