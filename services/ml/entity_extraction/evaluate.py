"""Evaluate trained NER model against regex+fuzzy baseline.

Loads test set, runs both the trained spaCy NER model and the current
regex+fuzzy entity extraction, and compares precision/recall/F1.
"""

import json
import re
import sys
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path

from rich.console import Console
from rich.table import Table

sys.path.insert(0, str(Path(__file__).parent.parent))
import db
from config import ML_MODELS_DIR

console = Console()


def run(model_dir: str | None = None):
    """Evaluate NER model vs regex+fuzzy baseline."""
    try:
        import spacy
    except ImportError:
        console.print("[red]Error: spaCy not installed.[/]")
        return

    console.print("[bold]Evaluating NER model...[/]\n")

    # Find model
    if model_dir:
        model_path = Path(model_dir)
    else:
        ner_dir = ML_MODELS_DIR / "entity_ner"
        versions = sorted(ner_dir.glob("v*/model-best"))
        if not versions:
            console.print("[red]No trained model found. Run train-ner first.[/]")
            return
        model_path = versions[-1]

    console.print(f"  Model: {model_path}")

    # Load model
    nlp = spacy.load(model_path)

    # Load test data
    test_file = Path("spacy_data/test.spacy")
    if not test_file.exists():
        console.print("[red]Test data not found. Run prepare-spacy first.[/]")
        return

    # Also load the JSONL for ground truth entity IDs
    jsonl_file = Path("training_data.jsonl")
    ground_truth: dict[str, list[dict]] = {}
    if jsonl_file.exists():
        with jsonl_file.open() as f:
            for line in f:
                record = json.loads(line)
                ground_truth[record["bates"]] = record["entities"]

    # Load entities for regex baseline
    entities = db.get_all_entities()
    entity_names = []
    for e in entities:
        entity_names.append(e["name"])
        for alias in (e.get("aliases") or []):
            if alias:
                entity_names.append(alias)
    entity_names = sorted(set(entity_names), key=len, reverse=True)

    # Build regex patterns (mirrors worker Stage 3 approach)
    patterns = []
    for name in entity_names:
        escaped = re.escape(name)
        patterns.append(re.compile(rf"\b{escaped}\b", re.IGNORECASE))

    # Evaluate on test documents from JSONL
    ner_results: dict[str, dict] = defaultdict(lambda: {"tp": 0, "fp": 0, "fn": 0})
    regex_results: dict[str, dict] = defaultdict(lambda: {"tp": 0, "fp": 0, "fn": 0})
    total_ner = {"tp": 0, "fp": 0, "fn": 0}
    total_regex = {"tp": 0, "fp": 0, "fn": 0}

    test_records = []
    with Path("training_data.jsonl").open() as f:
        all_records = [json.loads(line) for line in f]
    # Use last 10% as test set (matches the split in prepare_spacy_data)
    test_start = int(len(all_records) * 0.9)
    test_records = all_records[test_start:]

    console.print(f"  Test documents: {len(test_records)}")

    for record in test_records:
        text = record["text"]
        gt_spans = {(e["start"], e["end"]) for e in record["entities"]}
        gt_labels = {(e["start"], e["end"]): e["label"] for e in record["entities"]}

        # NER predictions
        doc = nlp(text)
        ner_spans = {(ent.start_char, ent.end_char) for ent in doc.ents}

        # Regex predictions
        regex_spans: set[tuple[int, int]] = set()
        for pattern in patterns:
            for match in pattern.finditer(text):
                regex_spans.add((match.start(), match.end()))

        # Score NER
        ner_tp = len(gt_spans & ner_spans)
        ner_fp = len(ner_spans - gt_spans)
        ner_fn = len(gt_spans - ner_spans)

        total_ner["tp"] += ner_tp
        total_ner["fp"] += ner_fp
        total_ner["fn"] += ner_fn

        # Score regex
        regex_tp = len(gt_spans & regex_spans)
        regex_fp = len(regex_spans - gt_spans)
        regex_fn = len(gt_spans - regex_spans)

        total_regex["tp"] += regex_tp
        total_regex["fp"] += regex_fp
        total_regex["fn"] += regex_fn

        # Per-label scoring for NER
        for ent in doc.ents:
            span = (ent.start_char, ent.end_char)
            label = ent.label_
            if span in gt_spans:
                ner_results[label]["tp"] += 1
            else:
                ner_results[label]["fp"] += 1

        for span, label in gt_labels.items():
            if span not in ner_spans:
                ner_results[label]["fn"] += 1

    # Compute aggregate metrics
    def compute_prf(counts: dict) -> tuple[float, float, float]:
        p = counts["tp"] / max(counts["tp"] + counts["fp"], 1)
        r = counts["tp"] / max(counts["tp"] + counts["fn"], 1)
        f1 = 2 * p * r / max(p + r, 1e-10)
        return p, r, f1

    ner_p, ner_r, ner_f1 = compute_prf(total_ner)
    regex_p, regex_r, regex_f1 = compute_prf(total_regex)

    # Display comparison table
    table = Table(title="NER vs Regex+Fuzzy Comparison")
    table.add_column("Method", style="bold")
    table.add_column("Precision", justify="right")
    table.add_column("Recall", justify="right")
    table.add_column("F1", justify="right")
    table.add_column("TP", justify="right")
    table.add_column("FP", justify="right")
    table.add_column("FN", justify="right")

    table.add_row(
        "NER (trained)",
        f"{ner_p:.3f}", f"{ner_r:.3f}", f"{ner_f1:.3f}",
        str(total_ner["tp"]), str(total_ner["fp"]), str(total_ner["fn"]),
    )
    table.add_row(
        "Regex+Fuzzy",
        f"{regex_p:.3f}", f"{regex_r:.3f}", f"{regex_f1:.3f}",
        str(total_regex["tp"]), str(total_regex["fp"]), str(total_regex["fn"]),
    )

    console.print(table)

    # Per-label breakdown for NER
    if ner_results:
        label_table = Table(title="NER Per-Label Breakdown")
        label_table.add_column("Label", style="bold")
        label_table.add_column("Precision", justify="right")
        label_table.add_column("Recall", justify="right")
        label_table.add_column("F1", justify="right")
        label_table.add_column("Count", justify="right")

        for label in sorted(ner_results.keys()):
            counts = ner_results[label]
            p, r, f1 = compute_prf(counts)
            total = counts["tp"] + counts["fn"]
            label_table.add_row(label, f"{p:.3f}", f"{r:.3f}", f"{f1:.3f}", str(total))

        console.print(label_table)

    # Log to database
    metrics = {
        "ner": {"precision": ner_p, "recall": ner_r, "f1": ner_f1, **total_ner},
        "regex": {"precision": regex_p, "recall": regex_r, "f1": regex_f1, **total_regex},
        "improvement": {
            "f1_delta": ner_f1 - regex_f1,
            "precision_delta": ner_p - regex_p,
            "recall_delta": ner_r - regex_r,
        },
        "per_label": {
            label: {
                "precision": compute_prf(counts)[0],
                "recall": compute_prf(counts)[1],
                "f1": compute_prf(counts)[2],
            }
            for label, counts in ner_results.items()
        },
    }

    console.print(f"\n  F1 improvement: {(ner_f1 - regex_f1):+.3f}")
    console.print(f"  Precision improvement: {(ner_p - regex_p):+.3f}")
    console.print(f"  Recall improvement: {(ner_r - regex_r):+.3f}")

    console.print("\n[bold green]Evaluation complete![/]")
    return metrics
