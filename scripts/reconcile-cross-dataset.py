"""
Cross-dataset reconciliation script.

When the same Bates number appears in multiple DOJ dataset releases, the
documents may have different redaction levels, different text, or different
metadata. This script detects those overlaps and triggers re-processing
with version diff (Stage 8) so the reviewer can see exactly what changed.

Usage:
    cd services/worker && source .venv/bin/activate && cd ../..
    python scripts/reconcile-cross-dataset.py --volume /path/to/VOL00009 --dataset 9
    python scripts/reconcile-cross-dataset.py --volume /path/to/VOL00009 --dataset 9 --force
    python scripts/reconcile-cross-dataset.py --volume /path/to/VOL00009 --dataset 9 --dry-run

How it works:
  1. Parses the OPT file from the new dataset volume to extract Bates numbers
  2. Batch-queries the documents table for matching Bates numbers
  3. For each overlap where the existing document is from a different dataset:
     a. Compares local file size vs DB file size (skip if identical, unless --force)
     b. Creates a version snapshot of the existing document
     c. Uploads the new PDF to R2 (overwrites existing)
     d. Deletes pipeline-generated entity_documents and redactions
     e. Resets document processing fields, preserves review data
     f. Creates a processing_queue entry with is_reprocess=True + priority 2
  4. Worker picks up the re-queued docs and runs all stages + Stage 8 version diff
"""

import argparse
import csv
import os
import sys
import time
from pathlib import Path
from typing import Any

# Add worker dir to path so we can reuse config
sys.path.insert(0, str(Path(__file__).parent.parent / "services" / "worker"))

from config import (
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    R2_ENDPOINT,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
)

import boto3
from supabase import create_client, Client

# ── Constants ──────────────────────────────────────────────

BATCH_SIZE = 200  # Max Bates numbers per Supabase IN() query
MAX_RETRIES = 5


# ── Supabase client factory ────────────────────────────────


def make_client() -> Client:
    """Create a fresh Supabase client (useful after HTTP/2 drops)."""
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ── OPT parser (same logic as bulk-import.py) ──────────────


def parse_opt(opt_path: str) -> list[dict[str, Any]]:
    """Parse Opticon OPT file into document records.

    Each row with Y in field 4 starts a new document.
    Returns list of {bates_number, volume, pdf_relative_path, page_count}.
    """
    documents = []

    with open(opt_path, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 4:
                continue

            bates = row[0].strip()
            volume = row[1].strip() if len(row) > 1 else ""
            image_path = row[2].strip() if len(row) > 2 else ""
            doc_break = row[3].strip() if len(row) > 3 else ""
            page_count = (
                int(row[6].strip())
                if len(row) > 6 and row[6].strip().isdigit()
                else 1
            )

            if doc_break == "Y":
                local_path = image_path.replace("\\", os.sep)
                documents.append({
                    "bates_number": bates,
                    "volume": volume,
                    "pdf_relative_path": local_path,
                    "page_count": page_count,
                })

    return documents


# ── R2 upload ──────────────────────────────────────────────


def upload_to_r2(s3_client: Any, local_path: str, r2_key: str) -> None:
    """Upload a PDF to R2."""
    s3_client.upload_file(
        local_path,
        R2_BUCKET_NAME,
        r2_key,
        ExtraArgs={"ContentType": "application/pdf"},
    )


# ── Version snapshot (Python equivalent of presign route) ──


def create_version_snapshot(
    supabase: Client, doc: dict[str, Any], trigger: str
) -> dict[str, Any]:
    """
    Snapshot the current document state into document_versions.
    Mirrors the createVersionSnapshot() logic in the presign route.
    Returns {id, version_number}.
    """
    document_id = doc["id"]

    # Find current max version number
    versions = (
        supabase.table("document_versions")
        .select("version_number")
        .eq("document_id", document_id)
        .order("version_number", desc=True)
        .limit(1)
        .execute()
    )
    max_version = versions.data[0]["version_number"] if versions.data else 0
    snapshot_version = max_version + 1

    # Aggregate current redaction summary
    redactions = (
        supabase.table("redactions")
        .select("page_number, category")
        .eq("document_id", document_id)
        .execute()
    )
    categories = {"A": 0, "B": 0, "C": 0, "D": 0}
    redacted_pages: set[int] = set()
    for r in redactions.data or []:
        cat = r.get("category")
        if cat and cat in categories:
            categories[cat] += 1
        page = r.get("page_number")
        if page is not None:
            redacted_pages.add(page)
    redaction_summary = {
        "total_pages_with_redactions": len(redacted_pages),
        "categories": categories,
        "total_redactions": len(redactions.data or []),
    }

    # Collect entity IDs
    entity_docs = (
        supabase.table("entity_documents")
        .select("entity_id")
        .eq("document_id", document_id)
        .execute()
    )
    entity_ids = list(set(ed["entity_id"] for ed in (entity_docs.data or [])))

    # Get most recent completed queue results
    queue_items = (
        supabase.table("processing_queue")
        .select("results")
        .eq("document_id", document_id)
        .eq("status", "completed")
        .order("completed_at", desc=True)
        .limit(1)
        .execute()
    )
    processing_results = (
        queue_items.data[0]["results"] if queue_items.data else {}
    )

    # Insert version snapshot
    snapshot = (
        supabase.table("document_versions")
        .insert({
            "document_id": document_id,
            "version_number": snapshot_version,
            "trigger": trigger,
            "file_url": doc.get("file_url"),
            "file_size_bytes": doc.get("file_size_bytes"),
            "page_count": doc.get("page_count"),
            "extracted_text": doc.get("extracted_text"),
            "document_type": doc.get("document_type"),
            "original_date": doc.get("original_date"),
            "classification": doc.get("classification"),
            "severity": doc.get("severity"),
            "processing_status": doc.get("processing_status"),
            "forensic_metadata": doc.get("forensic_metadata") or {},
            "flags": doc.get("flags") or [],
            "review_notes": doc.get("review_notes"),
            "reviewed_by": doc.get("reviewed_by"),
            "reviewed_at": doc.get("reviewed_at"),
            "redaction_summary": redaction_summary,
            "entity_ids": entity_ids,
            "processing_results": processing_results,
        })
        .select("id, version_number")
        .single()
        .execute()
    )

    return snapshot.data


# ── Main reconciliation logic ──────────────────────────────


def run_reconcile(
    volume_dir: str,
    dataset_number: int,
    limit: int = 0,
    dry_run: bool = False,
    force: bool = False,
):
    volume_path = Path(volume_dir)
    data_dir = volume_path / "DATA"

    # Find OPT file
    opt_files = list(data_dir.glob("*.OPT")) + list(data_dir.glob("*.opt"))
    if not opt_files:
        print("ERROR: No OPT file found in DATA/")
        sys.exit(1)

    opt_path = opt_files[0]
    print(f"Volume directory: {volume_path}")
    print(f"OPT file: {opt_path}")
    print(f"Source dataset: {dataset_number}")
    print(f"Force (ignore file size match): {force}")
    print()

    # Parse OPT to get Bates numbers and file paths
    print("Parsing OPT file...")
    source_docs = parse_opt(str(opt_path))
    print(f"  Found {len(source_docs)} documents in source volume")

    if limit > 0:
        source_docs = source_docs[:limit]
        print(f"  Limited to {len(source_docs)} documents")

    # Build lookup: bates_number → source doc info
    source_by_bates: dict[str, dict[str, Any]] = {}
    for doc in source_docs:
        source_by_bates[doc["bates_number"]] = doc

    all_bates = list(source_by_bates.keys())

    # Connect to services
    supabase = make_client()

    # Get source dataset ID (so we can exclude same-dataset matches)
    ds_result = (
        supabase.table("datasets")
        .select("id")
        .eq("number", dataset_number)
        .execute()
    )
    source_dataset_id = ds_result.data[0]["id"] if ds_result.data else None

    # Batch-query existing documents by Bates number
    print(f"\nChecking {len(all_bates)} Bates numbers against existing database...")
    overlaps: list[dict[str, Any]] = []

    for batch_start in range(0, len(all_bates), BATCH_SIZE):
        batch = all_bates[batch_start : batch_start + BATCH_SIZE]
        result = (
            supabase.table("documents")
            .select("id, bates_number, dataset_id, file_size_bytes, processing_status, current_version")
            .in_("bates_number", batch)
            .execute()
        )
        for doc in result.data or []:
            # Skip if same dataset (not a cross-dataset overlap)
            if source_dataset_id and doc.get("dataset_id") == source_dataset_id:
                continue
            overlaps.append(doc)

    print(f"  Found {len(overlaps)} cross-dataset overlaps")

    if not overlaps:
        print("\nNo cross-dataset overlaps found. Nothing to do.")
        return

    # Process overlaps
    queued = 0
    skipped_same_size = 0
    skipped_active = 0
    errors = 0
    start_time = time.time()
    consecutive_errors = 0

    # Set up R2 client
    s3_client = boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )

    for i, existing_doc in enumerate(overlaps):
        bates = existing_doc["bates_number"]
        source = source_by_bates[bates]
        pdf_path = volume_path / source["pdf_relative_path"]

        if (i + 1) % 10 == 0 or i == 0:
            elapsed = time.time() - start_time
            rate = (i + 1) / elapsed if elapsed > 0 else 0
            print(f"  [{i+1}/{len(overlaps)}] {bates} ({rate:.1f}/sec)")

        # Check PDF exists locally
        if not pdf_path.exists():
            print(f"  WARNING: PDF missing for {bates}: {pdf_path}")
            errors += 1
            continue

        # Compare file sizes — skip if identical (unless --force)
        local_size = pdf_path.stat().st_size
        db_size = existing_doc.get("file_size_bytes") or 0
        if not force and local_size == db_size:
            skipped_same_size += 1
            continue

        try:
            # Refresh client on consecutive errors (HTTP/2 connection drops)
            if consecutive_errors > 0:
                backoff = min(2 ** consecutive_errors, 32)
                print(f"    Backing off {backoff}s after {consecutive_errors} errors...")
                time.sleep(backoff)
                supabase = make_client()

            document_id = existing_doc["id"]

            # Check if already queued/processing — skip to prevent double-queue
            active_queue = (
                supabase.table("processing_queue")
                .select("id")
                .eq("document_id", document_id)
                .in_("status", ["queued", "processing"])
                .limit(1)
                .execute()
            )
            if active_queue.data:
                skipped_active += 1
                continue

            if dry_run:
                size_diff = local_size - db_size
                print(
                    f"  WOULD RECONCILE: {bates} "
                    f"(size: {db_size:,} → {local_size:,}, "
                    f"delta: {size_diff:+,} bytes)"
                )
                queued += 1
                continue

            # Fetch full document record for snapshot
            full_doc = (
                supabase.table("documents")
                .select("*")
                .eq("id", document_id)
                .single()
                .execute()
            )

            # 1. Create version snapshot
            snapshot = create_version_snapshot(
                supabase, full_doc.data, "cross_dataset_reconcile"
            )
            new_version = snapshot["version_number"] + 1

            # 2. Upload new PDF to R2 (overwrites existing)
            r2_key = f"documents/{bates}.pdf"
            upload_to_r2(s3_client, str(pdf_path), r2_key)

            # 3. Delete pipeline-generated data
            supabase.table("entity_documents").delete().eq(
                "document_id", document_id
            ).execute()
            supabase.table("redactions").delete().eq(
                "document_id", document_id
            ).execute()

            # 4. Reset document for re-processing (preserve review data)
            supabase.table("documents").update({
                "file_url": r2_key,
                "file_size_bytes": local_size,
                "processing_status": "queued",
                "current_version": new_version,
                "extracted_text": None,
                "page_count": None,
                "thumbnail_url": None,
                "forensic_metadata": {},
                "flags": [],
                # Preserves: classification, severity, review_notes,
                #   reviewed_by, reviewed_at, dataset_id
            }).eq("id", document_id).execute()

            # 5. Queue for re-processing with version diff
            supabase.table("processing_queue").insert({
                "document_id": document_id,
                "status": "queued",
                "priority": 2,  # Higher than normal re-uploads (3)
                "is_reprocess": True,
                "previous_version_id": snapshot["id"],
            }).execute()

            queued += 1
            consecutive_errors = 0

            size_diff = local_size - db_size
            print(
                f"  QUEUED: {bates} v{new_version} "
                f"(size: {db_size:,} → {local_size:,}, "
                f"delta: {size_diff:+,} bytes)"
            )

        except Exception as e:
            print(f"  ERROR: {bates} — {e}")
            errors += 1
            consecutive_errors += 1
            if consecutive_errors >= MAX_RETRIES:
                print(f"\n  Too many consecutive errors ({MAX_RETRIES}). Aborting.")
                break

    elapsed = time.time() - start_time
    action = "Would queue" if dry_run else "Queued"
    print(f"\n{'=== Dry Run Results ===' if dry_run else '=== Reconciliation Complete ==='}")
    print(f"  Cross-dataset overlaps found: {len(overlaps)}")
    print(f"  {action} for version diff: {queued}")
    print(f"  Skipped (identical file size): {skipped_same_size}")
    print(f"  Skipped (already in queue): {skipped_active}")
    print(f"  Errors: {errors}")
    print(f"  Time: {elapsed:.1f}s")

    if queued > 0 and not dry_run:
        print(f"\n  {queued} documents re-queued at priority 2.")
        print(f"  Start the worker to process them: cd services/worker && python main.py")
        print(f"  Stage 8 (Version Diff) will flag redaction changes, new entities, etc.")


# ── CLI ────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Detect and reconcile same-Bates-number documents across datasets"
    )
    parser.add_argument(
        "--volume", required=True,
        help="Path to volume directory (e.g. /path/to/VOL00009)",
    )
    parser.add_argument(
        "--dataset", type=int, required=True,
        help="Dataset number of the source volume (e.g. 9)",
    )
    parser.add_argument(
        "--limit", type=int, default=0,
        help="Max documents to check (0 = all)",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show what would be reconciled without making changes",
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Re-process even if file sizes match (forces version diff on all overlaps)",
    )

    args = parser.parse_args()
    run_reconcile(
        volume_dir=args.volume,
        dataset_number=args.dataset,
        limit=args.limit,
        dry_run=args.dry_run,
        force=args.force,
    )
