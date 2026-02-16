"""Delete documents with corrupted bates numbers (Ã¾ prefix from encoding bug).

Run from project root with the worker venv activated:
    cd services/worker && source .venv/bin/activate && cd ../..
    python scripts/cleanup_corrupted_docs.py
"""

import time
from pathlib import Path
from dotenv import load_dotenv
import os

# Load env from worker .env
env_path = Path(__file__).resolve().parent.parent / "services" / "worker" / ".env"
load_dotenv(env_path)

from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
BATCH_SIZE = 200  # PostgREST puts IN(...) in URL; 200 UUIDs ≈ 7KB, under 8KB limit
MAX_RETRIES = 5


def make_client():
    """Create a fresh Supabase client (new HTTP connection)."""
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def main():
    supabase = make_client()

    # Use prefix match on the corruption pattern — index-friendly, won't timeout
    # Corrupted bates numbers look like: Ã¾EFTA00134624Ã¾
    CORRUPTION_PREFIX = "Ã¾%"

    print(f"Deleting documents with bates_number LIKE '{CORRUPTION_PREFIX}'...")
    print(f"Batch size: {BATCH_SIZE:,}\n")

    deleted_total = 0
    batch_num = 0
    consecutive_errors = 0

    while True:
        try:
            # Fetch a batch of corrupted IDs (prefix match is fast)
            batch = (
                supabase.table("documents")
                .select("id")
                .like("bates_number", CORRUPTION_PREFIX)
                .limit(BATCH_SIZE)
                .execute()
            )

            ids = [row["id"] for row in batch.data]
            if not ids:
                break

            # Delete this batch
            supabase.table("documents").delete().in_("id", ids).execute()
            deleted_total += len(ids)
            batch_num += 1
            consecutive_errors = 0

            if batch_num % 50 == 0 or len(ids) < BATCH_SIZE:
                print(f"  Batch {batch_num}: deleted {len(ids):,} (total: {deleted_total:,})")

            # Brief pause to avoid hammering the API
            time.sleep(0.05)

        except Exception as e:
            consecutive_errors += 1
            if consecutive_errors > MAX_RETRIES:
                print(f"\nFailed after {MAX_RETRIES} consecutive retries. Last error: {e}")
                break

            wait = 2 ** consecutive_errors  # exponential backoff: 2, 4, 8, 16, 32s
            print(f"\n  Connection error (attempt {consecutive_errors}/{MAX_RETRIES}), "
                  f"reconnecting in {wait}s... (deleted {deleted_total:,} so far)")
            time.sleep(wait)
            # Fresh client = fresh HTTP connection
            supabase = make_client()

    print(f"\nDone. Deleted {deleted_total:,} corrupted documents.")

    # Final count
    final = supabase.table("documents").select("id", count="exact").limit(1).execute()
    print(f"Remaining documents: {final.count or 0:,}")


if __name__ == "__main__":
    main()
