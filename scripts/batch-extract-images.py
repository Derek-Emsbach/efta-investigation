#!/usr/bin/env python3
"""
Batch Image Extraction Script

Iterates all documents with an R2 key (file_url column), downloads the PDF,
runs PyMuPDF image extraction (reusing services/worker/stages/images.py logic),
uploads originals + thumbnails to R2, and upserts document_images records.

Features:
  - Resume capability: tracks last processed document_id in a checkpoint file
  - Progress logging: processed/skipped/errored counts
  - Configurable batch size and concurrency
  - Dry-run mode for testing

Usage:
  cd services/worker
  python ../../scripts/batch-extract-images.py [--batch-size 100] [--dry-run] [--reset]

Requires the worker's .env file (services/worker/.env) for Supabase + R2 credentials.
"""

import sys
import os
import json
import time
import argparse
from pathlib import Path
from datetime import datetime

# Add worker directory to path so we can import its modules
WORKER_DIR = Path(__file__).resolve().parent.parent / "services" / "worker"
sys.path.insert(0, str(WORKER_DIR))

# Now import worker modules (they load .env from worker dir)
os.chdir(WORKER_DIR)

from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from supabase import create_client

# ── Configuration ──────────────────────────────────────────

CHECKPOINT_FILE = Path(__file__).resolve().parent / ".batch-images-checkpoint.json"
DEFAULT_BATCH_SIZE = 100
LOG_INTERVAL = 10  # Log progress every N documents


def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def load_checkpoint() -> dict:
    """Load checkpoint from file. Returns empty dict if not found."""
    if CHECKPOINT_FILE.exists():
        with open(CHECKPOINT_FILE) as f:
            return json.load(f)
    return {}


def save_checkpoint(data: dict):
    """Save checkpoint to file."""
    with open(CHECKPOINT_FILE, "w") as f:
        json.dump(data, f, indent=2)


def get_documents_with_r2_key(supabase, last_id: str | None, batch_size: int) -> list:
    """
    Fetch documents that have an R2 key (file_url) and haven't been processed
    for images yet. Orders by ID for deterministic resume.
    """
    # Get documents with file_url (R2 key), ordered by ID
    query = (
        supabase.table("documents")
        .select("id, bates_number, file_url, page_count")
        .not_.is_("file_url", "null")
        .order("id")
        .limit(batch_size)
    )

    if last_id:
        query = query.gt("id", last_id)

    result = query.execute()
    return result.data or []


def get_already_processed_ids(supabase, doc_ids: list[str]) -> set[str]:
    """Check which documents already have images extracted (skip them)."""
    if not doc_ids:
        return set()

    result = (
        supabase.table("document_images")
        .select("document_id")
        .in_("document_id", doc_ids)
        .limit(len(doc_ids))
        .execute()
    )

    return {r["document_id"] for r in (result.data or [])}


def process_document(document_id: str, r2_key: str, dry_run: bool = False) -> dict:
    """Extract images from a single document."""
    if dry_run:
        return {"dry_run": True, "document_id": document_id}

    # Import here to avoid loading PyMuPDF if just checking args
    from stages.images import run_images

    try:
        stats = run_images(document_id, r2_key)
        return {"success": True, **stats}
    except Exception as e:
        return {"success": False, "error": str(e)}


def main():
    parser = argparse.ArgumentParser(description="Batch extract images from EFTA documents")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE,
                        help=f"Documents per batch (default: {DEFAULT_BATCH_SIZE})")
    parser.add_argument("--max-docs", type=int, default=0,
                        help="Maximum total documents to process (0 = unlimited)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Log what would be processed without actually extracting")
    parser.add_argument("--reset", action="store_true",
                        help="Reset checkpoint and start from the beginning")
    parser.add_argument("--skip-existing", action="store_true", default=True,
                        help="Skip documents that already have images (default: true)")
    parser.add_argument("--no-skip-existing", dest="skip_existing", action="store_false",
                        help="Re-process documents even if they already have images")
    args = parser.parse_args()

    # Load or reset checkpoint
    if args.reset:
        checkpoint = {}
        if CHECKPOINT_FILE.exists():
            CHECKPOINT_FILE.unlink()
        print("[RESET] Checkpoint cleared")
    else:
        checkpoint = load_checkpoint()

    last_id = checkpoint.get("last_id")
    total_processed = checkpoint.get("total_processed", 0)
    total_skipped = checkpoint.get("total_skipped", 0)
    total_errored = checkpoint.get("total_errored", 0)
    total_images = checkpoint.get("total_images", 0)

    if last_id:
        print(f"[RESUME] Resuming from document {last_id}")
        print(f"  Previously: {total_processed} processed, {total_skipped} skipped, {total_errored} errored, {total_images} images")

    supabase = get_supabase()

    print(f"\n{'=' * 60}")
    print(f"  EFTA Batch Image Extraction")
    print(f"  Started: {datetime.now().isoformat()}")
    print(f"  Batch size: {args.batch_size}")
    print(f"  Max docs: {'unlimited' if args.max_docs == 0 else args.max_docs}")
    print(f"  Dry run: {args.dry_run}")
    print(f"  Skip existing: {args.skip_existing}")
    print(f"{'=' * 60}\n")

    session_processed = 0
    session_errored = 0
    session_images = 0
    start_time = time.time()

    while True:
        # Check max docs limit
        if args.max_docs > 0 and session_processed >= args.max_docs:
            print(f"\n[LIMIT] Reached max-docs limit ({args.max_docs})")
            break

        # Fetch next batch
        remaining = args.max_docs - session_processed if args.max_docs > 0 else args.batch_size
        batch_size = min(args.batch_size, remaining) if args.max_docs > 0 else args.batch_size
        docs = get_documents_with_r2_key(supabase, last_id, batch_size)

        if not docs:
            print("\n[DONE] No more documents to process")
            break

        # Check which already have images
        if args.skip_existing:
            doc_ids = [d["id"] for d in docs]
            already_done = get_already_processed_ids(supabase, doc_ids)
        else:
            already_done = set()

        for doc in docs:
            doc_id = doc["id"]
            r2_key = doc["file_url"]
            bates = doc.get("bates_number", "?")

            # Skip if already processed
            if doc_id in already_done:
                total_skipped += 1
                last_id = doc_id
                continue

            # Process
            result = process_document(doc_id, r2_key, dry_run=args.dry_run)

            if args.dry_run:
                print(f"  [DRY] {bates} ({doc_id[:8]}...) — r2_key={r2_key}")
            elif result.get("success"):
                extracted = result.get("images_extracted", 0)
                total_images += extracted
                session_images += extracted
                total_processed += 1
                session_processed += 1

                if session_processed % LOG_INTERVAL == 0:
                    elapsed = time.time() - start_time
                    rate = session_processed / elapsed if elapsed > 0 else 0
                    print(f"  [{session_processed}] {bates}: {extracted} images "
                          f"({result.get('images_found', 0)} found, "
                          f"{result.get('images_skipped_scan', 0)} scans, "
                          f"{result.get('images_skipped_small', 0)} small) "
                          f"— {rate:.1f} docs/sec")
            else:
                total_errored += 1
                session_errored += 1
                print(f"  [ERR] {bates} ({doc_id[:8]}...): {result.get('error', 'unknown')}")

            last_id = doc_id

            # Save checkpoint periodically
            if (total_processed + total_skipped) % (args.batch_size * 2) == 0:
                save_checkpoint({
                    "last_id": last_id,
                    "total_processed": total_processed,
                    "total_skipped": total_skipped,
                    "total_errored": total_errored,
                    "total_images": total_images,
                    "updated_at": datetime.now().isoformat(),
                })

    # Final checkpoint
    save_checkpoint({
        "last_id": last_id,
        "total_processed": total_processed,
        "total_skipped": total_skipped,
        "total_errored": total_errored,
        "total_images": total_images,
        "updated_at": datetime.now().isoformat(),
        "completed": True,
    })

    elapsed = time.time() - start_time
    print(f"\n{'=' * 60}")
    print(f"  Batch Complete")
    print(f"  Elapsed: {elapsed:.1f}s")
    print(f"  Session: {session_processed} processed, {total_skipped} skipped, {session_errored} errored")
    print(f"  Session images: {session_images}")
    print(f"  Lifetime: {total_processed} processed, {total_images} total images")
    print(f"  Rate: {session_processed / elapsed:.1f} docs/sec" if elapsed > 0 else "")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
