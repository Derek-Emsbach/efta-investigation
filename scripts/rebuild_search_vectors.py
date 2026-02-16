"""Rebuild search_vector for all documents via RPC batches.

Prerequisites:
  1. Create the RPC function in Supabase SQL Editor:
     CREATE OR REPLACE FUNCTION rebuild_search_vectors(batch_limit INT DEFAULT 5000)
     RETURNS INT AS $$ ... $$ LANGUAGE plpgsql;

  2. Run from project root with the worker venv activated:
     cd services/worker && source .venv/bin/activate && cd ../..
     python scripts/rebuild_search_vectors.py
"""

import time
from pathlib import Path
from dotenv import load_dotenv
import os

env_path = Path(__file__).resolve().parent.parent / "services" / "worker" / ".env"
load_dotenv(env_path)

from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
BATCH_SIZE = 5000
MAX_RETRIES = 5


def make_client():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def main():
    supabase = make_client()

    print(f"Rebuilding search vectors in batches of {BATCH_SIZE:,}...")
    print("(Skipping count query — it times out on large tables)\n")

    rebuilt_total = 0
    batch_num = 0
    consecutive_errors = 0

    while True:
        try:
            result = supabase.rpc(
                "rebuild_search_vectors", {"batch_limit": BATCH_SIZE}
            ).execute()

            updated = result.data
            if not updated or updated == 0:
                break

            rebuilt_total += updated
            batch_num += 1
            consecutive_errors = 0

            if batch_num % 10 == 0 or updated < BATCH_SIZE:
                print(f"  Batch {batch_num}: +{updated:,}  (total: {rebuilt_total:,})")

            time.sleep(0.05)

        except Exception as e:
            consecutive_errors += 1
            if consecutive_errors > MAX_RETRIES:
                print(f"\nFailed after {MAX_RETRIES} retries. Last error: {e}")
                break

            wait = 2 ** consecutive_errors
            print(
                f"\n  Error (attempt {consecutive_errors}/{MAX_RETRIES}), "
                f"retrying in {wait}s... ({rebuilt_total:,} rebuilt so far)"
            )
            time.sleep(wait)
            supabase = make_client()

    print(f"\nDone. Rebuilt {rebuilt_total:,} search vectors.")


if __name__ == "__main__":
    main()
