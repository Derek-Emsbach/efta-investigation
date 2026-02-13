"""
Bulk import script for EFTA litigation load files (DAT + OPT + PDFs).

Parses Concordance DAT and Opticon OPT files, uploads PDFs to R2,
creates document records in Supabase, and queues them for processing.

Usage:
    cd services/worker && source .venv/bin/activate && cd ../..
    python scripts/bulk-import.py --volume /path/to/VOL00011 --dataset 11 --limit 100
"""

import argparse
import csv
import os
import sys
import time
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
from supabase import create_client

# ── Constants ──────────────────────────────────────────────

THORN = "\u00fe"  # þ — Concordance field delimiter
DC4 = "\x14"      # Text qualifier

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


# ── Import Logic ───────────────────────────────────────────

def upload_to_r2(s3_client, local_path: str, r2_key: str) -> str:
    """Upload a file to R2 and return the public URL."""
    s3_client.upload_file(
        local_path,
        R2_BUCKET_NAME,
        r2_key,
        ExtraArgs={"ContentType": "application/pdf"},
    )
    return f"{R2_ENDPOINT}/{R2_BUCKET_NAME}/{r2_key}"


def run_import(
    volume_dir: str,
    dataset_number: int,
    limit: int = 100,
    dry_run: bool = False,
    skip_upload: bool = False,
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

    # Connect to services
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    s3_client = None
    if not skip_upload:
        s3_client = boto3.client(
            "s3",
            endpoint_url=R2_ENDPOINT,
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
            region_name="auto",
        )

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

    # Import documents
    imported = 0
    skipped = 0
    errors = 0
    start_time = time.time()

    for i, doc in enumerate(documents):
        bates = doc["bates_number"]
        end_bates = dat_ranges.get(bates)
        pdf_relative = doc["pdf_relative_path"]
        pdf_path = volume_path / pdf_relative
        page_count = doc["page_count"]

        # Progress
        if (i + 1) % 10 == 0:
            elapsed = time.time() - start_time
            rate = (i + 1) / elapsed if elapsed > 0 else 0
            print(f"  [{i+1}/{len(documents)}] {bates} ({rate:.1f} docs/sec)")

        # Check if already imported
        existing = supabase.table("documents").select("id").eq("bates_number", bates).execute()
        if existing.data:
            skipped += 1
            continue

        # Check PDF exists locally
        if not pdf_path.exists():
            print(f"  WARNING: PDF missing for {bates}: {pdf_path}")
            errors += 1
            continue

        file_size = pdf_path.stat().st_size

        # Upload to R2
        file_url = None
        if s3_client:
            r2_key = f"documents/{bates}.pdf"
            try:
                upload_to_r2(s3_client, str(pdf_path), r2_key)
                file_url = r2_key
            except Exception as e:
                print(f"  ERROR uploading {bates}: {e}")
                errors += 1
                continue

        # Create document record
        try:
            doc_record = {
                "bates_number": bates,
                "dataset_id": dataset_id,
                "title": f"{bates}" + (f"–{end_bates}" if end_bates and end_bates != bates else ""),
                "page_count": page_count,
                "file_size_bytes": file_size,
                "file_url": file_url,
                "processing_status": "queued",
                "forensic_metadata": {},
            }

            result = supabase.table("documents").insert(doc_record).execute()
            doc_id = result.data[0]["id"]

            # Queue for processing
            supabase.table("processing_queue").insert({
                "document_id": doc_id,
                "status": "queued",
                "priority": 5,
            }).execute()

            imported += 1

        except Exception as e:
            print(f"  ERROR inserting {bates}: {e}")
            errors += 1

    elapsed = time.time() - start_time
    print(f"\n=== Import Complete ===")
    print(f"  Imported: {imported}")
    print(f"  Skipped (already exists): {skipped}")
    print(f"  Errors: {errors}")
    print(f"  Time: {elapsed:.1f}s")
    print(f"  Rate: {(imported / elapsed if elapsed > 0 else 0):.1f} docs/sec")


# ── CLI ────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bulk import EFTA load files")
    parser.add_argument("--volume", required=True, help="Path to volume directory (e.g. /path/to/VOL00011)")
    parser.add_argument("--dataset", type=int, required=True, help="Dataset number (e.g. 11)")
    parser.add_argument("--limit", type=int, default=100, help="Max documents to import (0 = all)")
    parser.add_argument("--dry-run", action="store_true", help="Parse files and show what would be imported")
    parser.add_argument("--skip-upload", action="store_true", help="Skip R2 upload (metadata only)")

    args = parser.parse_args()
    run_import(
        volume_dir=args.volume,
        dataset_number=args.dataset,
        limit=args.limit,
        dry_run=args.dry_run,
        skip_upload=args.skip_upload,
    )
