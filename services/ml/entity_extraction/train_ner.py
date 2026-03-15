"""Train spaCy NER model on prepared training data.

Uses spaCy's training infrastructure with a base model (en_core_web_lg)
for transfer learning.
"""

import subprocess
import sys
import time
from pathlib import Path

from rich.console import Console

sys.path.insert(0, str(Path(__file__).parent.parent))
import db
from config import NER_BASE_MODEL, ML_MODELS_DIR

console = Console()


def run(
    base_model: str | None = None,
    epochs: int = 30,
    data_dir: str = "spacy_data",
):
    """Train a spaCy NER model."""
    console.print("[bold]Training NER model...[/]\n")

    data_path = Path(data_dir)
    train_file = data_path / "train.spacy"
    dev_file = data_path / "dev.spacy"
    config_file = data_path / "base_config.cfg"

    if not train_file.exists() or not dev_file.exists():
        console.print("[red]Error: Training data not found. Run prepare-spacy first.[/]")
        return

    model = base_model or NER_BASE_MODEL
    output_dir = ML_MODELS_DIR / "entity_ner"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Determine version
    existing = sorted(output_dir.glob("v*"))
    version = len(existing) + 1
    model_output = output_dir / f"v{version}"

    # Log model run
    run_record = db.create_model_run({
        "model_name": "entity_ner",
        "version": version,
        "status": "running",
        "hyperparameters": {
            "base_model": model,
            "epochs": epochs,
            "data_dir": data_dir,
        },
    })
    run_id = run_record["id"]

    console.print(f"  Base model: {model}")
    console.print(f"  Output: {model_output}")
    console.print(f"  Run ID: {run_id}")

    # Fill config with actual paths
    filled_config = data_path / "config.cfg"

    try:
        # Use spaCy init fill-config to create a complete config
        subprocess.run(
            [
                sys.executable, "-m", "spacy", "init", "fill-config",
                str(config_file),
                str(filled_config),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as e:
        console.print(f"[red]Config fill failed: {e.stderr}[/]")
        db.update_model_run(run_id, {
            "status": "failed",
            "error_message": e.stderr[:500],
        })
        return

    start_time = time.time()

    try:
        # Train the model
        result = subprocess.run(
            [
                sys.executable, "-m", "spacy", "train",
                str(filled_config),
                "--output", str(model_output),
                "--paths.train", str(train_file),
                "--paths.dev", str(dev_file),
                "--training.max_epochs", str(epochs),
                "--gpu-id", "-1",  # CPU only
            ],
            check=True,
            capture_output=True,
            text=True,
        )

        duration = int(time.time() - start_time)
        console.print(f"\n[bold green]Training complete![/] ({duration}s)")
        console.print(f"  Model saved to: {model_output}")

        # Parse metrics from spaCy output
        metrics = _parse_spacy_metrics(result.stdout)

        db.update_model_run(run_id, {
            "status": "completed",
            "metrics": metrics,
            "artifact_path": str(model_output / "model-best"),
            "duration_seconds": duration,
            "completed_at": "now()",
        })

        console.print(f"  Metrics: {metrics}")

    except subprocess.CalledProcessError as e:
        duration = int(time.time() - start_time)
        console.print(f"[red]Training failed: {e.stderr[:500]}[/]")
        db.update_model_run(run_id, {
            "status": "failed",
            "error_message": e.stderr[:500],
            "duration_seconds": duration,
        })


def _parse_spacy_metrics(output: str) -> dict:
    """Parse precision/recall/F1 from spaCy training output."""
    metrics: dict = {}

    for line in output.split("\n"):
        line = line.strip()
        # spaCy outputs metrics like: "E    #   LOSS   ENTS_F   ENTS_P   ENTS_R   SCORE"
        if "ENTS_F" in line or "ents_f" in line:
            continue
        # Try to extract final scores from table rows
        parts = line.split()
        if len(parts) >= 6:
            try:
                metrics["f1"] = float(parts[-4])
                metrics["precision"] = float(parts[-3])
                metrics["recall"] = float(parts[-2])
            except (ValueError, IndexError):
                pass

    return metrics
