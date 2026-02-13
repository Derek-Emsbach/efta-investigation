"""
Migrate extracted text from Supabase to R2.

For each document with non-null extracted_text:
  1. Upload full text to R2 as text/{bates_number}.txt
  2. Truncate DB column to 2000-char preview

Run from the worker directory (reuses its .env):
  cd services/worker && python ../../scripts/migrate-text-to-r2.py

After running this script, execute the SQL migration in Supabase:

  -- 1. Update search trigger (remove extracted_text)
  CREATE OR REPLACE FUNCTION documents_search_update() RETURNS TRIGGER AS $$
  BEGIN
    NEW.search_vector :=
      setweight(to_tsvector('english', COALESCE(NEW.bates_number, '')), 'A') ||
      setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
      setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'B');
    NEW.updated_at := now();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  -- 2. Rebuild search vectors
  UPDATE documents SET updated_at = now();

  -- 3. Reclaim space
  VACUUM FULL documents;
"""

import sys
from pathlib import Path

# Add worker dir to path so we can reuse its config
worker_dir = Path(__file__).resolve().parent.parent / "services" / "worker"
sys.path.insert(0, str(worker_dir))

from config import SUPABASE_URL, SUPABASE_SERVICE_KEY  # noqa: E402
from storage import upload_text, file_exists  # noqa: E402
from supabase import create_client  # noqa: E402

PREVIEW_LENGTH = 2000


def main() -> None:
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Fetch all documents that have extracted_text longer than the preview limit
    print("Fetching documents with extracted text...")
    result = sb.table("documents").select(
        "id, bates_number, extracted_text"
    ).not_.is_("extracted_text", "null").execute()

    docs = result.data or []
    print(f"Found {len(docs)} documents with extracted text")

    uploaded = 0
    skipped = 0
    truncated = 0
    errors = 0

    for i, doc in enumerate(docs, 1):
        doc_id = doc["id"]
        bates = doc.get("bates_number")
        text = doc.get("extracted_text") or ""

        if not bates:
            print(f"  [{i}/{len(docs)}] {doc_id[:8]}... — no bates number, skipping")
            skipped += 1
            continue

        if not text.strip():
            print(f"  [{i}/{len(docs)}] {bates} — empty text, skipping")
            skipped += 1
            continue

        # Upload to R2 (if not already there)
        r2_key = f"text/{bates}.txt"
        try:
            if file_exists(r2_key):
                print(f"  [{i}/{len(docs)}] {bates} — already in R2, skipping upload")
            else:
                upload_text(bates, text)
                uploaded += 1
                print(f"  [{i}/{len(docs)}] {bates} — uploaded ({len(text):,} chars)")
        except Exception as e:
            print(f"  [{i}/{len(docs)}] {bates} — R2 upload FAILED: {e}")
            errors += 1
            continue

        # Truncate in DB if longer than preview
        if len(text) > PREVIEW_LENGTH:
            try:
                sb.table("documents").update(
                    {"extracted_text": text[:PREVIEW_LENGTH]}
                ).eq("id", doc_id).execute()
                truncated += 1
            except Exception as e:
                print(f"  [{i}/{len(docs)}] {bates} — DB truncate FAILED: {e}")
                errors += 1

    print(f"\nDone!")
    print(f"  Uploaded to R2: {uploaded}")
    print(f"  Truncated in DB: {truncated}")
    print(f"  Skipped: {skipped}")
    print(f"  Errors: {errors}")
    print(f"\nNext steps:")
    print(f"  1. Run the SQL migration in Supabase (see docstring above)")
    print(f"  2. Check Supabase storage — should drop significantly")


if __name__ == "__main__":
    main()
