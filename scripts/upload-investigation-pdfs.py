#!/usr/bin/env python3
"""
Upload Investigation PDFs to R2

Downloads PDFs from the DOJ EFTA release servers and uploads them to R2,
then updates the file_url in Supabase. Targets entity-linked documents
that have been investigated but don't have PDFs in R2 yet.

Usage:
  cd services/worker
  python3 ../../scripts/upload-investigation-pdfs.py [--dry-run] [--bates EFTA02731082,EFTA01266403]

Requires services/worker/.env for Supabase + R2 credentials.
"""

import sys
import os
import argparse
import time
from pathlib import Path

# Add worker directory to path
WORKER_DIR = Path(__file__).resolve().parent.parent / "services" / "worker"
sys.path.insert(0, str(WORKER_DIR))
os.chdir(WORKER_DIR)

from config import SUPABASE_URL, SUPABASE_SERVICE_KEY, R2_ENDPOINT, R2_BUCKET_NAME
from supabase import create_client
from storage import upload_file, file_exists

import httpx

# ── EFTA number → DOJ dataset mapping ─────────────────────

DATASET_RANGES = [
    (1, 1, 4521),
    (2, 4522, 5586),
    (3, 5705, 69044),
    (4, 69045, 90321),
    (5, 90322, 96905),
    (6, 96906, 107252),
    (7, 107253, 117395),
    (8, 117396, 176563),
    (9, 176564, 1243099),
    (10, 1243100, 1524192),
    (11, 1524193, 2640992),
    (12, 2640993, 2858497),
]


def dataset_from_efta(bates: str) -> int | None:
    num = int(bates.replace("EFTA", ""))
    for ds, lo, hi in DATASET_RANGES:
        if lo <= num <= hi:
            return ds
    return None


def doj_url(bates: str) -> str | None:
    ds = dataset_from_efta(bates)
    if ds is None:
        return None
    padded = bates.replace("EFTA", "")
    return f"https://www.justice.gov/epstein/files/DataSet%20{ds}/EFTA{padded}.pdf"


def doj_url_scan(bates: str) -> str | None:
    """Try all 12 datasets to find the PDF. Returns URL or None."""
    padded = bates.replace("EFTA", "")
    # Try predicted dataset first, then all others
    predicted = dataset_from_efta(bates)
    order = ([predicted] if predicted else []) + [ds for ds in range(1, 13) if ds != predicted]
    with httpx.Client(timeout=30, follow_redirects=True) as client:
        for ds in order:
            url = f"https://www.justice.gov/epstein/files/DataSet%20{ds}/EFTA{padded}.pdf"
            try:
                resp = client.get(url, cookies=DOJ_AGE_COOKIE)
                if resp.status_code == 200 and resp.content[:4] == b"%PDF":
                    return url
            except Exception:
                continue
    return None


def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def find_docs_needing_upload(supabase, specific_bates: list[str] | None = None, force: bool = False) -> list[dict]:
    """Find entity-linked documents without file_url (or all entity-linked if force=True)."""
    if specific_bates:
        r = (
            supabase.table("documents")
            .select("id, bates_number, title, page_count, document_type, file_url")
            .in_("bates_number", specific_bates)
            .execute()
        )
        return r.data or []

    # Get entity-linked docs (optionally only those without file_url)
    query = (
        supabase.table("entity_documents")
        .select("document_id, documents!inner(id, bates_number, title, page_count, document_type, file_url)")
    )
    if not force:
        query = query.is_("documents.file_url", "null")
    r = query.limit(200).execute()

    seen = set()
    docs = []
    for row in (r.data or []):
        doc = row.get("documents")
        if doc and doc["bates_number"] and doc["bates_number"] not in seen:
            seen.add(doc["bates_number"])
            docs.append(doc)
    docs.sort(key=lambda x: x.get("page_count") or 0, reverse=True)
    return docs


DOJ_AGE_COOKIE = {"justiceGovAgeVerified": "true"}


def download_pdf(url: str) -> bytes | None:
    """Download PDF from DOJ. Returns bytes or None on failure."""
    try:
        with httpx.Client(timeout=60, follow_redirects=True) as client:
            resp = client.get(url, cookies=DOJ_AGE_COOKIE)
            if resp.status_code == 200 and resp.content[:4] == b"%PDF":
                return resp.content
            else:
                return None
    except Exception:
        return None


def main():
    parser = argparse.ArgumentParser(description="Upload investigation PDFs to R2")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be uploaded")
    parser.add_argument("--bates", type=str, default="",
                        help="Comma-separated EFTA numbers to upload (default: all entity-linked docs)")
    parser.add_argument("--force", action="store_true",
                        help="Re-download even if file_url already set (overwrites R2)")
    args = parser.parse_args()

    specific = [b.strip() for b in args.bates.split(",") if b.strip()] if args.bates else None
    supabase = get_supabase()

    docs = find_docs_needing_upload(supabase, specific, force=args.force)
    # Filter to only those without file_url unless --force
    if not args.force:
        docs = [d for d in docs if not d.get("file_url")]

    print(f"\n{'=' * 60}")
    print(f"  EFTA PDF Upload to R2")
    print(f"  Documents to process: {len(docs)}")
    print(f"  Dry run: {args.dry_run}")
    print(f"{'=' * 60}\n")

    uploaded = 0
    skipped = 0
    failed = 0

    for doc in docs:
        bates = doc["bates_number"]
        title = (doc.get("title") or "untitled")[:60]
        pages = doc.get("page_count") or "?"
        r2_key = f"documents/{bates}.pdf"

        url = doj_url(bates)
        if not url:
            print(f"  [SKIP] {bates}: cannot determine DOJ dataset")
            skipped += 1
            continue

        # Check if already in R2 (skip check in --force mode)
        if not args.force and file_exists(r2_key):
            print(f"  [EXISTS] {bates}: already in R2, updating DB...")
            if not args.dry_run:
                full_url = f"{R2_ENDPOINT}/{R2_BUCKET_NAME}/{r2_key}"
                supabase.table("documents").update({"file_url": full_url}).eq("id", doc["id"]).execute()
            uploaded += 1
            continue

        if args.dry_run:
            print(f"  [DRY] {bates} ({pages}pp) — {title}")
            print(f"         DOJ: {url}")
            print(f"         R2:  {r2_key}")
            continue

        # Download from DOJ
        print(f"  Downloading {bates} ({pages}pp)...", end=" ", flush=True)
        pdf_bytes = download_pdf(url)

        if not pdf_bytes:
            # Try scanning all datasets as fallback
            print("scanning datasets...", end=" ", flush=True)
            alt_url = doj_url_scan(bates)
            if alt_url:
                pdf_bytes = download_pdf(alt_url)

        if not pdf_bytes:
            print(f"FAILED (not found on any dataset)")
            failed += 1
            continue

        size_kb = len(pdf_bytes) / 1024
        print(f"{size_kb:.0f}KB", end=" ", flush=True)

        # Upload to R2
        upload_file(r2_key, pdf_bytes, "application/pdf")

        # Update Supabase
        full_url = f"{R2_ENDPOINT}/{R2_BUCKET_NAME}/{r2_key}"
        supabase.table("documents").update({"file_url": full_url}).eq("id", doc["id"]).execute()

        print(f"-> R2 OK")
        uploaded += 1
        time.sleep(0.5)  # Be polite to DOJ servers

    print(f"\n{'=' * 60}")
    print(f"  Results: {uploaded} uploaded, {skipped} skipped, {failed} failed")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
