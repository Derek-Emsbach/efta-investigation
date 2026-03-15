"""Convert extracted training data JSONL to spaCy DocBin format.

Reads JSONL from extract_training_data.py and produces train/dev/test
DocBin files for spaCy NER training.
"""

import json
import random
import sys
from pathlib import Path
from collections import Counter

from rich.console import Console

console = Console()


def run(input_path: str = "training_data.jsonl", output_dir: str = "spacy_data"):
    """Convert JSONL training data to spaCy DocBin format."""
    try:
        import spacy
        from spacy.tokens import DocBin
    except ImportError:
        console.print("[red]Error: spaCy not installed. Run: pip install spacy[/]")
        return

    console.print("[bold]Preparing spaCy training data...[/]\n")

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Load training data
    input_file = Path(input_path)
    if not input_file.exists():
        console.print(f"[red]Error: {input_file} not found. Run extract-training-data first.[/]")
        return

    records = []
    with input_file.open() as f:
        for line in f:
            records.append(json.loads(line))

    console.print(f"  Loaded {len(records):,} documents")

    # Shuffle and split (80/10/10)
    random.seed(42)
    random.shuffle(records)

    n = len(records)
    train_end = int(n * 0.8)
    dev_end = int(n * 0.9)

    splits = {
        "train": records[:train_end],
        "dev": records[train_end:dev_end],
        "test": records[dev_end:],
    }

    # Load blank spaCy model for tokenization
    nlp = spacy.blank("en")

    # Collect label statistics
    label_counts: Counter = Counter()
    alignment_errors = 0

    for split_name, split_data in splits.items():
        doc_bin = DocBin()
        processed = 0

        for record in split_data:
            text = record["text"]
            entities = record["entities"]

            doc = nlp.make_doc(text)

            # Convert character offsets to spaCy span format
            ents = []
            for ent in entities:
                span = doc.char_span(
                    ent["start"],
                    ent["end"],
                    label=ent["label"],
                    alignment_mode="contract",
                )
                if span is not None:
                    ents.append(span)
                    label_counts[ent["label"]] += 1
                else:
                    alignment_errors += 1

            # Filter overlapping spans (keep longest)
            filtered_ents = spacy.util.filter_spans(ents)
            doc.ents = filtered_ents

            doc_bin.add(doc)
            processed += 1

        # Save DocBin
        out_file = output_path / f"{split_name}.spacy"
        doc_bin.to_disk(out_file)
        console.print(f"  {split_name}: {processed:,} documents → {out_file}")

    # Print statistics
    console.print(f"\n  Label distribution:")
    for label, count in label_counts.most_common():
        console.print(f"    {label}: {count:,}")

    if alignment_errors > 0:
        console.print(f"\n  [yellow]Alignment errors (spans dropped): {alignment_errors:,}[/]")

    # Write spaCy config base
    config_path = output_path / "base_config.cfg"
    config_path.write_text(_SPACY_CONFIG)
    console.print(f"\n  Config template: {config_path}")
    console.print("[bold green]Done![/]")


_SPACY_CONFIG = """[paths]
train = null
dev = null

[system]
gpu_allocator = null

[nlp]
lang = "en"
pipeline = ["tok2vec", "ner"]

[components]

[components.tok2vec]
factory = "tok2vec"

[components.tok2vec.model]
@architectures = "spacy.Tok2Vec.v2"

[components.tok2vec.model.embed]
@architectures = "spacy.MultiHashEmbed.v2"
width = 96
attrs = ["NORM", "PREFIX", "SUFFIX", "SHAPE"]
rows = [5000, 2500, 2500, 2500]
include_static_vectors = true

[components.tok2vec.model.encode]
@architectures = "spacy.MaxoutWindowEncoder.v2"
width = 96
depth = 4
window_size = 1
maxout_pieces = 3

[components.ner]
factory = "ner"

[components.ner.model]
@architectures = "spacy.TransitionBasedParser.v2"
state_type = "ner"
extra_state_tokens = false
hidden_width = 64
maxout_pieces = 2
use_upper = true
nO = null

[components.ner.model.tok2vec]
@architectures = "spacy.Tok2VecListener.v1"
width = ${components.tok2vec.model.encode.width}

[training]
dev_corpus = "corpora.dev"
train_corpus = "corpora.train"
patience = 1600
max_epochs = 0
max_steps = 20000
eval_frequency = 200
seed = 42
accumulate_gradient = 1
dropout = 0.3

[training.batcher]
@batchers = "spacy.batch_by_words.v1"
discard_oversize = false
tolerance = 0.2
size = 2000

[training.optimizer]
@optimizers = "Adam.v1"
beta1 = 0.9
beta2 = 0.999
L2_is_weight_decay = true
L2 = 0.01
grad_clip = 1.0
use_averages = false
eps = 0.00000001

[corpora]

[corpora.train]
@readers = "spacy.Corpus.v1"
path = ${paths.train}

[corpora.dev]
@readers = "spacy.Corpus.v1"
path = ${paths.dev}
"""
