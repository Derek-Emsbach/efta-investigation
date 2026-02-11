"""
EFTA Document Processing Worker

Polls the Supabase processing_queue for queued documents, then runs
three processing stages: ingest, forensics, and text extraction.

Usage:
    cd services/worker
    pip install -r requirements.txt
    cp .env.example .env   # fill in credentials
    python main.py
"""

import sys
import time
import traceback

from config import POLL_INTERVAL
from db import (
    fetch_next_queued,
    lock_queue_item,
    update_queue_step,
    complete_queue_item,
    fail_queue_item,
)
from stages.ingest import run_ingest
from stages.forensics import run_forensics
from stages.extract import run_extract


def process_document(queue_item: dict) -> None:
    """Run all three processing stages on a single document."""
    queue_id = queue_item["id"]
    document = queue_item["documents"]
    document_id = document["id"]
    file_url = document.get("file_url", "")

    # Extract R2 key from file_url
    # URLs look like: https://{account}.r2.cloudflarestorage.com/{bucket}/{key}
    # We need just the key portion after the bucket name
    parts = file_url.split("/")
    # Find 'documents' in the path and reconstruct the key
    try:
        docs_idx = parts.index("documents")
        r2_key = "/".join(parts[docs_idx:])
    except ValueError:
        # Fallback: last two segments
        r2_key = "/".join(parts[-2:]) if len(parts) >= 2 else parts[-1]

    print(f"  Stage 1/3: Ingest — {r2_key}")
    update_queue_step(queue_id, "ingest")
    ingest_results = run_ingest(document_id, r2_key)
    update_queue_step(queue_id, "ingest", {"ingest": ingest_results})

    print(f"  Stage 2/3: Forensics")
    update_queue_step(queue_id, "forensics")
    forensics_results = run_forensics(document_id, r2_key)
    update_queue_step(queue_id, "forensics", {"forensics": forensics_results})

    print(f"  Stage 3/3: Text Extraction")
    update_queue_step(queue_id, "extract")
    extract_results = run_extract(document_id, r2_key)
    update_queue_step(queue_id, "extract", {"extract": extract_results})

    # Mark as completed
    complete_queue_item(queue_id, document_id)
    print(f"  Done — document {document_id} ready for review")


def main():
    """Main polling loop."""
    print("=" * 60)
    print("EFTA Document Processing Worker")
    print(f"Poll interval: {POLL_INTERVAL}s")
    print("=" * 60)
    print()

    while True:
        try:
            item = fetch_next_queued()

            if item is None:
                sys.stdout.write(".")
                sys.stdout.flush()
                time.sleep(POLL_INTERVAL)
                continue

            document = item.get("documents", {})
            doc_name = document.get("bates_number") or document.get("title") or item["document_id"]
            print(f"\nProcessing: {doc_name}")

            # Lock the item
            lock_queue_item(item["id"])

            try:
                process_document(item)
            except Exception as e:
                error_msg = f"{type(e).__name__}: {e}"
                print(f"  FAILED — {error_msg}")
                traceback.print_exc()
                fail_queue_item(
                    item["id"],
                    item["document_id"],
                    error_msg,
                )

        except KeyboardInterrupt:
            print("\nShutting down...")
            break
        except Exception as e:
            print(f"\nWorker error: {e}")
            traceback.print_exc()
            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
