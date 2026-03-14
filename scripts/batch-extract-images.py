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


def get_all_entity_linked_docs(supabase) -> list:
    """
    Fetch all entity-linked documents with file_url in one go.
    entity_documents is small (~few hundred rows), so this won't timeout.
    Returns deduplicated list of document dicts.
    """
    # Step 1: Get all unique document_ids from entity_documents
    r = supabase.table("entity_documents").select("document_id").limit(1000).execute()
    doc_ids = list({row["document_id"] for row in (r.data or [])})
    if not doc_ids:
        return []

    # Step 2: Fetch those documents by ID (batched to avoid URL length limits)
    all_docs = []
    for i in range(0, len(doc_ids), 50):
        batch_ids = doc_ids[i:i + 50]
        r2 = (
            supabase.table("documents")
            .select("id, bates_number, file_url, page_count")
            .in_("id", batch_ids)
            .not_.is_("file_url", "null")
            .execute()
        )
        all_docs.extend(r2.data or [])

    # Sort by ID for deterministic ordering
    all_docs.sort(key=lambda d: d["id"])
    return all_docs


def get_already_processed_ids(supabase, doc_ids: list[str]) -> set[str]:
    """Check which documents already have images extracted (skip them)."""
    if not doc_ids:
        return set()

    done = set()
    # Batch to avoid URL length limits on .in_() queries
    for i in range(0, len(doc_ids), 30):
        batch = doc_ids[i:i + 30]
        result = (
            supabase.table("document_images")
            .select("document_id")
            .in_("document_id", batch)
            .limit(len(batch))
            .execute()
        )
        done.update(r["document_id"] for r in (result.data or []))
    return done


def url_to_r2_key(file_url: str) -> str:
    """
    Convert a full R2 URL to just the key.
    e.g. 'https://....r2.cloudflarestorage.com/efta-documents/documents/EFTA02713979.pdf'
         -> 'documents/EFTA02713979.pdf'
    """
    # Split on bucket name
    marker = "/efta-documents/"
    idx = file_url.find(marker)
    if idx >= 0:
        return file_url[idx + len(marker):]
    # Fallback: if it's already a key (no http), return as-is
    if not file_url.startswith("http"):
        return file_url
    # Last resort: take everything after the last .com/
    parts = file_url.split(".com/", 1)
    if len(parts) == 2:
        # Remove bucket prefix if present
        rest = parts[1]
        if rest.startswith("efta-documents/"):
            return rest[len("efta-documents/"):]
        return rest
    return file_url


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
    parser.add_argument("--max-docs", type=int, default=0,
                        help="Maximum total documents to process (0 = unlimited)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Log what would be processed without actually extracting")
    parser.add_argument("--skip-existing", action="store_true", default=True,
                        help="Skip documents that already have images (default: true)")
    parser.add_argument("--no-skip-existing", dest="skip_existing", action="store_false",
                        help="Re-process documents even if they already have images")
    args = parser.parse_args()

    supabase = get_supabase()

    # Fetch all entity-linked docs with R2 keys in one shot
    print("Fetching entity-linked documents with R2 keys...")
    docs = get_all_entity_linked_docs(supabase)

    if args.max_docs > 0:
        docs = docs[:args.max_docs]

    # Check which already have images
    if args.skip_existing and docs:
        doc_ids = [d["id"] for d in docs]
        already_done = get_already_processed_ids(supabase, doc_ids)
    else:
        already_done = set()

    to_process = [d for d in docs if d["id"] not in already_done]

    print(f"\n{'=' * 60}")
    print(f"  EFTA Batch Image Extraction")
    print(f"  Started: {datetime.now().isoformat()}")
    print(f"  Total entity-linked docs with R2: {len(docs)}")
    print(f"  Already extracted (skipping): {len(already_done)}")
    print(f"  To process: {len(to_process)}")
    print(f"  Dry run: {args.dry_run}")
    print(f"{'=' * 60}\n")

    processed = 0
    errored = 0
    total_images = 0
    start_time = time.time()

    for doc in to_process:
        doc_id = doc["id"]
        r2_key = url_to_r2_key(doc["file_url"])
        bates = doc.get("bates_number", "?")
        pages = doc.get("page_count") or "?"

        result = process_document(doc_id, r2_key, dry_run=args.dry_run)

        if args.dry_run:
            print(f"  [DRY] {bates} ({pages}pp) — r2_key={r2_key}")
        elif result.get("success"):
            extracted = result.get("images_extracted", 0)
            total_images += extracted
            processed += 1

            scans = result.get("images_skipped_scan", 0)
            found = result.get("images_found", 0)
            print(f"  [{processed}/{len(to_process)}] {bates} ({pages}pp): "
                  f"{extracted} extracted, {found} found, {scans} scans skipped")
        else:
            errored += 1
            print(f"  [ERR] {bates}: {result.get('error', 'unknown')}")

    elapsed = time.time() - start_time
    print(f"\n{'=' * 60}")
    print(f"  Batch Complete")
    print(f"  Elapsed: {elapsed:.1f}s")
    print(f"  Processed: {processed}, Errored: {errored}, Skipped: {len(already_done)}")
    print(f"  Images extracted: {total_images}")
    if elapsed > 0 and processed > 0:
        print(f"  Rate: {processed / elapsed:.1f} docs/sec")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
