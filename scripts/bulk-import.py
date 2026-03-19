"""
Bulk import script for EFTA litigation load files (DAT + OPT + PDFs).

Parses Concordance DAT and Opticon OPT files, uploads PDFs to R2,
creates document records in Supabase, and queues them for processing.

Features:
  - Parallel R2 uploads via ThreadPoolExecutor (--workers)
  - Batch Supabase inserts (100 records per API call)
  - Resume capability (--resume skips already-imported Bates numbers)
  - Backfill mode for docs with missing file_url

Usage:
    cd services/worker && source .venv/bin/activate && cd ../..
    python scripts/bulk-import.py --volume /path/to/VOL00011 --dataset 11 --limit 100
    python scripts/bulk-import.py --volume /path/to/VOL00011 --dataset 11 --limit 0 --workers 20 --resume
"""

import argparse
import csv
import os
import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

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
from botocore.config import Config as BotoConfig
from supabase import create_client

# ── Constants ──────────────────────────────────────────────

THORN = "\u00fe"  # þ — Concordance field delimiter
DC4 = "\x14"      # Text qualifier
BATCH_SIZE = 100  # Supabase insert batch size

# ── Thread-local clients ──────────────────────────────────

_thread_local = threading.local()


def get_thread_s3():
    """Get a thread-local boto3 S3 client (thread-safe pattern)."""
    if not hasattr(_thread_local, "s3"):
        session = boto3.Session(
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        )
        _thread_local.s3 = session.client(
            "s3",
            endpoint_url=R2_ENDPOINT,
            region_name="auto",
            config=BotoConfig(
                max_pool_connections=50,
                retries={"max_attempts": 3, "mode": "adaptive"},
            ),
        )
    return _thread_local.s3


# ── Parsers ────────────────────────────────────────────────

def parse_opt(opt_path: str) -> list[dict]:
    """Parse Opticon OPT file into document records.

    Each row with Y in field 4 starts a new document.
    Returns list of {bates, volume, pdf_path, page_count}.
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
            page_count = int(row[6].strip()) if len(row) > 6 and row[6].strip().isdigit() else 1

            if doc_break == "Y":
                # Convert Windows path to local path
                local_path = image_path.replace("\\", os.sep)
                documents.append({
                    "bates_number": bates,
                    "volume": volume,
                    "pdf_relative_path": local_path,
                    "page_count": page_count,
                })

    return documents


def parse_dat(dat_path: str) -> list[dict]:
    """Parse Concordance DAT file into Bates range records.

    Returns list of {begin_bates, end_bates}.
    """
    records = []

    with open(dat_path, "r", encoding="utf-8", errors="replace") as f:
        lines = f.readlines()

    if not lines:
        return records

    # Parse header
    header_line = lines[0].strip().replace(DC4, "")
    headers = [h.strip() for h in header_line.split(THORN) if h.strip()]

    for line in lines[1:]:
        clean = line.strip().replace(DC4, "")
        fields = [f.strip() for f in clean.split(THORN) if f.strip() != ""]

        if len(fields) >= 2:
            records.append({
                "begin_bates": fields[0],
                "end_bates": fields[1],
            })

    return records


# ── Upload Logic ──────────────────────────────────────────

def upload_one(local_path: str, r2_key: str) -> str:
    """Upload a single file to R2 using a thread-local client."""
    client = get_thread_s3()
    client.upload_file(
        local_path,
        R2_BUCKET_NAME,
        r2_key,
        ExtraArgs={"ContentType": "application/pdf"},
    )
    return r2_key


# ── Resume: pre-fetch existing Bates numbers ─────────────

def fetch_existing_bates(supabase, dataset_id: str) -> dict[str, dict]:
    """Fetch all existing Bates numbers for a dataset in bulk.

    Returns {bates_number: {"id": uuid, "file_url": str|None}}.
    Paginates in chunks of 1000 (Supabase default limit).
    """
    existing = {}
    offset = 0
    page_size = 1000

    while True:
        result = (
            supabase.table("documents")
            .select("id, bates_number, file_url")
            .eq("dataset_id", dataset_id)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        for row in result.data:
            existing[row["bates_number"]] = {
                "id": row["id"],
                "file_url": row.get("file_url"),
            }
        if len(result.data) < page_size:
            break
        offset += page_size

    return existing


# ── Batch insert helpers ──────────────────────────────────

def batch_insert_documents(supabase, records: list[dict]) -> list[dict]:
    """Insert a batch of document records, return inserted rows with IDs."""
    result = supabase.table("documents").insert(records).execute()
    return result.data


def batch_insert_queue(supabase, entries: list[dict]):
    """Insert a batch of processing_queue entries."""
    supabase.table("processing_queue").insert(entries).execute()


# ── Main Import ───────────────────────────────────────────

def run_import(
    volume_dir: str,
    dataset_number: int,
    limit: int = 100,
    dry_run: bool = False,
    skip_upload: bool = False,
    workers: int = 10,
    resume: bool = False,
):
    volume_path = Path(volume_dir)
    data_dir = volume_path / "DATA"

    # Find DAT and OPT files
    dat_files = list(data_dir.glob("*.DAT")) + list(data_dir.glob("*.dat"))
    opt_files = list(data_dir.glob("*.OPT")) + list(data_dir.glob("*.opt"))

    if not opt_files:
        print("ERROR: No OPT file found in DATA/")
        sys.exit(1)

    opt_path = opt_files[0]
    dat_path = dat_files[0] if dat_files else None

    print(f"Volume directory: {volume_path}")
    print(f"OPT file: {opt_path}")
    print(f"DAT file: {dat_path or 'not found'}")
    print(f"Dataset: {dataset_number}")
    print(f"Limit: {limit}")
    print(f"Workers: {workers}")
    print(f"Resume: {resume}")
    print(f"Dry run: {dry_run}")
    print()

    # Parse OPT
    print("Parsing OPT file...")
    documents = parse_opt(str(opt_path))
    print(f"  Found {len(documents)} documents")

    # Parse DAT for Bates ranges
    dat_ranges = {}
    if dat_path:
        print("Parsing DAT file...")
        ranges = parse_dat(str(dat_path))
        print(f"  Found {len(ranges)} Bates ranges")
        for r in ranges:
            dat_ranges[r["begin_bates"]] = r["end_bates"]

    # Apply limit
    if limit > 0:
        documents = documents[:limit]
        print(f"\nProcessing {len(documents)} documents (limited)")
    else:
        print(f"\nProcessing all {len(documents)} documents")

    if dry_run:
        print("\n=== DRY RUN — showing first 10 documents ===")
        for doc in documents[:10]:
            pdf_path = volume_path / doc["pdf_relative_path"]
            exists = pdf_path.exists()
            end_bates = dat_ranges.get(doc["bates_number"], "?")
            print(
                f"  {doc['bates_number']} → {end_bates} | "
                f"{doc['page_count']}pp | "
                f"{'EXISTS' if exists else 'MISSING'} | "
                f"{doc['pdf_relative_path']}"
            )
        return

    # Connect to Supabase
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Get or create dataset
    ds_result = supabase.table("datasets").select("id").eq("number", dataset_number).execute()
    if ds_result.data:
        dataset_id = ds_result.data[0]["id"]
        print(f"Using existing dataset {dataset_number} (ID: {dataset_id})")
    else:
        ds_insert = supabase.table("datasets").insert({
            "number": dataset_number,
            "name": f"Dataset {dataset_number}",
            "description": f"EFTA DOJ Release — Dataset {dataset_number}",
            "status": "in_progress",
        }).execute()
        dataset_id = ds_insert.data[0]["id"]
        print(f"Created dataset {dataset_number} (ID: {dataset_id})")

    # ── Resume: pre-fetch existing records ────────────────
    existing_map = {}
    if resume:
        print("Fetching existing records for resume...")
        existing_map = fetch_existing_bates(supabase, dataset_id)
        print(f"  Found {len(existing_map)} existing documents in dataset {dataset_number}")

    # ── Phase 1: Upload PDFs to R2 (parallel) ─────────────
    imported = 0
    skipped = 0
    backfilled = 0
    errors = 0
    upload_errors = 0
    start_time = time.time()

    # Separate documents into: new (need upload + insert), backfill (need upload only), skip
    to_upload = []      # (doc, pdf_path, r2_key, file_size, end_bates) — new docs
    to_backfill = []    # (doc, pdf_path, r2_key, existing_id) — existing docs missing file_url

    print("\nScanning documents...")
    for doc in documents:
        bates = doc["bates_number"]
        pdf_path = volume_path / doc["pdf_relative_path"]

        if resume and bates in existing_map:
            ex = existing_map[bates]
            if not ex.get("file_url") and not skip_upload and pdf_path.exists():
                r2_key = f"documents/{bates}.pdf"
                to_backfill.append((doc, str(pdf_path), r2_key, ex["id"]))
            else:
                skipped += 1
            continue

        if not resume:
            # Non-resume mode: check individually (slower, but works without dataset_id pre-fetch)
            existing = supabase.table("documents").select("id, file_url").eq("bates_number", bates).execute()
            if existing.data:
                ex = existing.data[0]
                if not ex.get("file_url") and not skip_upload and pdf_path.exists():
                    r2_key = f"documents/{bates}.pdf"
                    to_backfill.append((doc, str(pdf_path), r2_key, ex["id"]))
                else:
                    skipped += 1
                continue

        if not pdf_path.exists():
            print(f"  WARNING: PDF missing for {bates}: {pdf_path}")
            errors += 1
            continue

        file_size = pdf_path.stat().st_size
        end_bates = dat_ranges.get(bates)
        r2_key = f"documents/{bates}.pdf"
        to_upload.append((doc, str(pdf_path), r2_key, file_size, end_bates))

    print(f"  New documents to import: {len(to_upload)}")
    print(f"  Backfill (upload PDF only): {len(to_backfill)}")
    print(f"  Skipped (already complete): {skipped}")
    if errors:
        print(f"  Missing PDFs: {errors}")

    # ── Upload new + backfill PDFs in parallel ────────────
    # Maps r2_key → uploaded file_url (or error)
    upload_results = {}  # r2_key → True (success) or Exception

    if not skip_upload and (to_upload or to_backfill):
        all_uploads = []
        for item in to_upload:
            all_uploads.append((item[1], item[2]))  # (local_path, r2_key)
        for item in to_backfill:
            all_uploads.append((item[1], item[2]))  # (local_path, r2_key)

        print(f"\nUploading {len(all_uploads)} PDFs to R2 with {workers} workers...")
        upload_start = time.time()
        completed = 0

        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {
                executor.submit(upload_one, local_path, r2_key): r2_key
                for local_path, r2_key in all_uploads
            }
            for future in as_completed(futures):
                r2_key = futures[future]
                completed += 1
                try:
                    future.result()
                    upload_results[r2_key] = True
                except Exception as e:
                    upload_results[r2_key] = e
                    upload_errors += 1

                if completed % 100 == 0 or completed == len(all_uploads):
                    elapsed = time.time() - upload_start
                    rate = completed / elapsed if elapsed > 0 else 0
                    print(f"  [{completed}/{len(all_uploads)}] {rate:.1f} uploads/sec")

        upload_elapsed = time.time() - upload_start
        success_count = sum(1 for v in upload_results.values() if v is True)
        print(f"  Upload complete: {success_count} OK, {upload_errors} failed ({upload_elapsed:.1f}s)")

    # ── Process backfill results ──────────────────────────
    for doc, local_path, r2_key, existing_id in to_backfill:
        bates = doc["bates_number"]
        if skip_upload or upload_results.get(r2_key) is True:
            try:
                supabase.table("documents").update({"file_url": r2_key}).eq("id", existing_id).execute()
                backfilled += 1
            except Exception as e:
                print(f"  ERROR updating backfill {bates}: {e}")
                errors += 1
        elif r2_key in upload_results:
            print(f"  ERROR uploading backfill {bates}: {upload_results[r2_key]}")
            errors += 1

    if backfilled:
        print(f"  Backfilled {backfilled} documents with file_url")

    # ── Phase 2: Batch insert new documents ───────────────
    if to_upload:
        print(f"\nInserting {len(to_upload)} document records in batches of {BATCH_SIZE}...")
        insert_start = time.time()

        # Build records for docs that uploaded successfully (or skip_upload mode)
        pending_records = []
        pending_meta = []  # parallel list tracking (doc, r2_key) for each record

        for doc, local_path, r2_key, file_size, end_bates in to_upload:
            bates = doc["bates_number"]

            # Check upload succeeded (or skip_upload mode)
            if not skip_upload and upload_results.get(r2_key) is not True:
                if r2_key in upload_results:
                    print(f"  SKIP {bates}: upload failed ({upload_results[r2_key]})")
                errors += 1
                continue

            file_url = r2_key if not skip_upload else None
            pending_records.append({
                "bates_number": bates,
                "dataset_id": dataset_id,
                "title": f"{bates}" + (f"–{end_bates}" if end_bates and end_bates != bates else ""),
                "page_count": doc["page_count"],
                "file_size_bytes": file_size,
                "file_url": file_url,
                "processing_status": "queued",
                "forensic_metadata": {},
            })
            pending_meta.append((doc, r2_key))

        # Insert in batches
        total_inserted = 0
        all_doc_ids = []

        for batch_start in range(0, len(pending_records), BATCH_SIZE):
            batch = pending_records[batch_start:batch_start + BATCH_SIZE]
            try:
                inserted = batch_insert_documents(supabase, batch)
                for row in inserted:
                    all_doc_ids.append(row["id"])
                total_inserted += len(inserted)

                if total_inserted % 500 == 0 or batch_start + BATCH_SIZE >= len(pending_records):
                    elapsed = time.time() - insert_start
                    rate = total_inserted / elapsed if elapsed > 0 else 0
                    print(f"  [{total_inserted}/{len(pending_records)}] {rate:.1f} inserts/sec")

            except Exception as e:
                # If batch fails, try one-by-one to identify the bad record
                print(f"  Batch insert failed at offset {batch_start}: {e}")
                print(f"  Falling back to individual inserts...")
                for i, record in enumerate(batch):
                    try:
                        result = supabase.table("documents").insert(record).execute()
                        all_doc_ids.append(result.data[0]["id"])
                        total_inserted += 1
                    except Exception as e2:
                        bates = record["bates_number"]
                        print(f"    ERROR inserting {bates}: {e2}")
                        errors += 1

        imported = total_inserted
        print(f"  Inserted {total_inserted} documents ({time.time() - insert_start:.1f}s)")

        # ── Phase 3: Batch insert processing queue entries ─
        if all_doc_ids:
            print(f"\nQueuing {len(all_doc_ids)} documents for processing...")
            queue_entries = [
                {"document_id": doc_id, "status": "queued", "priority": 5}
                for doc_id in all_doc_ids
            ]
            queue_inserted = 0
            for batch_start in range(0, len(queue_entries), BATCH_SIZE):
                batch = queue_entries[batch_start:batch_start + BATCH_SIZE]
                try:
                    batch_insert_queue(supabase, batch)
                    queue_inserted += len(batch)
                except Exception as e:
                    print(f"  Queue batch failed at offset {batch_start}: {e}")
                    # Individual fallback
                    for entry in batch:
                        try:
                            supabase.table("processing_queue").insert(entry).execute()
                            queue_inserted += 1
                        except Exception as e2:
                            print(f"    ERROR queuing {entry['document_id']}: {e2}")
                            errors += 1
            print(f"  Queued {queue_inserted} documents")

    # ── Summary ───────────────────────────────────────────
    elapsed = time.time() - start_time
    print(f"\n{'=' * 60}")
    print(f"  Import Complete")
    print(f"  {'─' * 56}")
    print(f"  New documents imported: {imported}")
    print(f"  Backfilled (PDF upload): {backfilled}")
    print(f"  Skipped (already exists): {skipped}")
    print(f"  Upload errors: {upload_errors}")
    print(f"  Other errors: {errors}")
    print(f"  {'─' * 56}")
    print(f"  Total time: {elapsed:.1f}s")
    total_processed = imported + backfilled + skipped
    if elapsed > 0 and total_processed > 0:
        print(f"  Rate: {total_processed / elapsed:.1f} docs/sec")
    print(f"{'=' * 60}")


# ── CLI ────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bulk import EFTA load files")
    parser.add_argument("--volume", required=True, help="Path to volume directory (e.g. /path/to/VOL00011)")
    parser.add_argument("--dataset", type=int, required=True, help="Dataset number (e.g. 11)")
    parser.add_argument("--limit", type=int, default=100, help="Max documents to import (0 = all)")
    parser.add_argument("--dry-run", action="store_true", help="Parse files and show what would be imported")
    parser.add_argument("--skip-upload", action="store_true", help="Skip R2 upload (metadata only)")
    parser.add_argument("--workers", type=int, default=10, help="Parallel upload workers (default 10, max 50)")
    parser.add_argument("--resume", action="store_true", help="Resume interrupted import (bulk-fetch existing records)")

    args = parser.parse_args()

    if args.workers > 50:
        print("WARNING: Clamping workers to 50 (max)")
        args.workers = 50

    run_import(
        volume_dir=args.volume,
        dataset_number=args.dataset,
        limit=args.limit,
        dry_run=args.dry_run,
        skip_upload=args.skip_upload,
        workers=args.workers,
        resume=args.resume,
    )
