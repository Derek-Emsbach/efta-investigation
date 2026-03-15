"""Orchestrate all anomaly detectors, deduplicate, and store results."""

import sys
from pathlib import Path

from rich.console import Console
from rich.table import Table

sys.path.insert(0, str(Path(__file__).parent.parent))
import db

from anomaly_detection import redaction_anomalies, timeline_anomalies, document_anomalies

console = Console()

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def deduplicate(anomalies: list[dict]) -> list[dict]:
    """Remove near-duplicate anomalies based on overlapping entity/document IDs and type."""
    seen_keys: set[str] = set()
    unique = []

    for a in anomalies:
        # Build dedup key from type + primary IDs
        entity_part = "|".join(sorted(a.get("entity_ids", [])[:3]))
        doc_part = "|".join(sorted(a.get("document_ids", [])[:3]))
        key = f"{a['anomaly_type']}:{entity_part}:{doc_part}"

        if key not in seen_keys:
            seen_keys.add(key)
            unique.append(a)

    return unique


def rank(anomalies: list[dict]) -> list[dict]:
    """Sort anomalies by severity then score."""
    return sorted(
        anomalies,
        key=lambda a: (SEVERITY_ORDER.get(a.get("severity", "low"), 3), -a.get("score", 0)),
    )


def run(dry_run: bool = False) -> list[dict]:
    """Run all anomaly detectors, deduplicate, rank, and store.

    Args:
        dry_run: If True, print results but don't write to database.

    Returns:
        List of detected anomalies.
    """
    console.print("[bold]Running anomaly detection pipeline...[/]\n")

    # Run all detectors (each wrapped in try/except so one failure doesn't stop the rest)
    all_anomalies: list[dict] = []

    detectors = [
        ("1/3 Redaction anomalies", redaction_anomalies),
        ("2/3 Timeline anomalies", timeline_anomalies),
        ("3/3 Document anomalies", document_anomalies),
    ]

    for label, module in detectors:
        console.print(f"[bold cyan]{label}[/]")
        try:
            all_anomalies.extend(module.run())
        except Exception as e:
            console.print(f"  [yellow]Skipped — {e}[/]")
        console.print()

    console.print(f"\n[bold]Total raw anomalies: {len(all_anomalies)}[/]")

    # Deduplicate
    all_anomalies = deduplicate(all_anomalies)
    console.print(f"After deduplication: {len(all_anomalies)}")

    # Rank
    all_anomalies = rank(all_anomalies)

    # Summary table
    table = Table(title="Anomaly Detection Summary")
    table.add_column("Severity", style="bold")
    table.add_column("Count", justify="right")
    table.add_column("Types")

    for severity in ["critical", "high", "medium", "low"]:
        group = [a for a in all_anomalies if a.get("severity") == severity]
        if group:
            types = set(a["anomaly_type"] for a in group)
            color = {"critical": "red", "high": "yellow", "medium": "blue", "low": "dim"}.get(severity, "")
            table.add_row(
                f"[{color}]{severity}[/]",
                str(len(group)),
                ", ".join(sorted(types)),
            )

    console.print(table)

    # Top 10 preview
    console.print("\n[bold]Top 10 anomalies:[/]")
    for i, a in enumerate(all_anomalies[:10], 1):
        sev = a.get("severity", "?")
        color = {"critical": "red", "high": "yellow", "medium": "blue"}.get(sev, "dim")
        console.print(f"  {i}. [{color}][{sev}][/] {a['title']}")

    if dry_run:
        console.print("\n[yellow]Dry run — skipping database insert.[/]")
        return all_anomalies

    # Prepare rows for database insert
    rows = []
    for a in all_anomalies:
        rows.append({
            "anomaly_type": a["anomaly_type"],
            "severity": a["severity"],
            "score": a["score"],
            "title": a["title"],
            "description": a["description"],
            "entity_ids": a.get("entity_ids", []),
            "document_ids": a.get("document_ids", []),
            "evidence": a.get("evidence", {}),
            "review_status": "pending",
        })

    if rows:
        count = db.insert_anomalies(rows)
        console.print(f"\n[green]Inserted {count} anomalies into ml_anomalies table.[/]")

    return all_anomalies
