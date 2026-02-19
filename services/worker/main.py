"""
EFTA Document Processing Worker

Polls the Supabase processing_queue for queued documents, then runs
up to seven processing stages:

  Tier A (always): 1. Ingest  1.5. Image Extraction  2. Forensics
                   3. Text Extraction
  Tier B (gated):  4. Entity Extraction  5. Redaction Detection
                   6. Cross-Reference  7. Classification

Tier B stages only run on non-trivial documents (>3 pages, non-photo/blank,
known entity detected). Simple documents skip straight to needs_review.

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
    claim_next_queued,
    complete_queue_item,
    complete_queue_item_with_status,
    fail_queue_item,
    update_document,
    update_queue_step,
)
from stages.ingest import run_ingest
from stages.images import run_images
from stages.forensics import run_forensics
from stages.extract import run_extract
from stages.entities import run_entities
from stages.redactions import run_redactions
from stages.crossref import run_crossref
from stages.classify import run_classify
from stages.diff import run_diff


def should_run_advanced(document: dict, extract_results: dict) -> bool:
    """
    Tier B gate — decide whether to run stages 4-7.
    Returns True if the document is non-trivial and worth deeper analysis.
    """
    # Multi-page documents
    page_count = document.get("page_count") or extract_results.get("page_count", 0)
    if page_count > 3:
        return True

    # Non-photo/blank document types
    doc_type = extract_results.get("document_type") or document.get("document_type")
    if doc_type and doc_type not in ("photo", "blank"):
        return True

    # Has meaningful extracted text
    total_chars = extract_results.get("total_chars", 0)
    if total_chars > 500:
        return True

    return False


def process_document(queue_item: dict) -> None:
    """Run processing stages on a single document."""
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

    # ── Tier A: Always run (stages 1-3) ──────────────────────────

    print(f"  Stage 1: Ingest — {r2_key}")
    update_queue_step(queue_id, "ingest")
    ingest_results = run_ingest(document_id, r2_key)
    update_queue_step(queue_id, "ingest", {"ingest": ingest_results})

    print(f"  Stage 1.5: Image Extraction")
    update_queue_step(queue_id, "images")
    image_results = run_images(document_id, r2_key)
    update_queue_step(queue_id, "images", {"images": image_results})
    img_count = image_results.get("images_extracted", 0)
    scan_count = image_results.get("page_scan_pages", 0)
    if img_count > 0:
        print(f"    Extracted {img_count} images ({scan_count} scan pages skipped)")
    elif scan_count > 0:
        print(f"    No embedded images ({scan_count} scan pages)")

    print(f"  Stage 2: Forensics")
    update_queue_step(queue_id, "forensics")
    forensics_results = run_forensics(document_id, r2_key)
    update_queue_step(queue_id, "forensics", {"forensics": forensics_results})

    print(f"  Stage 3: Text Extraction")
    update_queue_step(queue_id, "extract")
    extract_results = run_extract(document_id, r2_key)
    update_queue_step(queue_id, "extract", {"extract": extract_results})

    # ── Tier B gate ──────────────────────────────────────────────

    if not should_run_advanced(document, extract_results):
        # Tag with skip reason so reviewers can distinguish blank pages
        # (safe to batch-approve) from handwritten notes with bad OCR
        # (need human attention). Stage 3 flags like needs_ocr are already set.
        skip_flags = ["tier_b_skipped"]
        doc_type = extract_results.get("document_type") or document.get("document_type")
        if doc_type == "blank":
            skip_flags.append("blank_page")
        elif doc_type == "photo":
            skip_flags.append("photo_only")

        existing_flags = document.get("flags") or []
        merged = list(set(existing_flags + skip_flags))
        update_document(document_id, {"flags": merged})

        complete_queue_item(queue_id, document_id)
        print(f"  Done (basic) — {', '.join(skip_flags)}, ready for review")
        return

    # ── Tier B: Advanced stages (4-7) ────────────────────────────

    print(f"  Stage 4: Entity Extraction")
    update_queue_step(queue_id, "entities")
    entity_results = run_entities(document_id, r2_key)
    update_queue_step(queue_id, "entities", {"entities": entity_results})
    print(f"    Found {entity_results.get('entities_found', 0)} entities")

    print(f"  Stage 5: Redaction Detection")
    update_queue_step(queue_id, "redactions")
    redaction_results = run_redactions(document_id, r2_key)
    update_queue_step(queue_id, "redactions", {"redactions": redaction_results})
    print(f"    Level: {redaction_results.get('overall_level', 'none')}")

    print(f"  Stage 6: Cross-Reference")
    update_queue_step(queue_id, "crossref")
    crossref_results = run_crossref(document_id, r2_key)
    update_queue_step(queue_id, "crossref", {"crossref": crossref_results})
    print(f"    Related: {crossref_results.get('related_docs', 0)} docs, {crossref_results.get('timeline_matches', 0)} events")

    print(f"  Stage 7: Classification")
    update_queue_step(queue_id, "classify")
    classify_results = run_classify(
        document_id, r2_key, queue_id,
        entity_results, redaction_results, crossref_results,
    )
    update_queue_step(queue_id, "classify", {"classify": classify_results})

    # ── Version Diff (conditional) ──────────────────────────────

    is_reprocess = queue_item.get("is_reprocess", False)
    previous_version_id = queue_item.get("previous_version_id")

    if is_reprocess and previous_version_id:
        print(f"  Stage 8: Version Diff")
        update_queue_step(queue_id, "diff")
        diff_results = run_diff(document_id, previous_version_id)
        update_queue_step(queue_id, "diff", {"diff": diff_results})
        findings = diff_results.get("significant_findings", [])
        if findings:
            print(f"    SIGNIFICANT: {len(findings)} finding(s)")
            for f in findings:
                print(f"      - {f['description']}")
        else:
            print(f"    No significant changes")

    # ── Complete ─────────────────────────────────────────────────

    needs_review = classify_results.get("needs_review", True)
    # Re-processed docs always go to needs_review so reviewer can see diff
    if is_reprocess:
        needs_review = True
    final_status = "needs_review" if needs_review else "extracted"
    complete_queue_item_with_status(queue_id, document_id, final_status)

    score = classify_results.get("score", 0)
    severity = classify_results.get("severity", "routine")
    reprocess_tag = " [re-processed]" if is_reprocess else ""
    print(f"  Done — score={score}, severity={severity}, status={final_status}{reprocess_tag}")


def main():
    """Main polling loop."""
    print("=" * 60)
    print("EFTA Document Processing Worker")
    print(f"Poll interval: {POLL_INTERVAL}s")
    print("Stages: 1-3 (all docs) + 4-7 (Tier B gated)")
    print("=" * 60)
    print()

    while True:
        try:
            item = claim_next_queued()

            if item is None:
                sys.stdout.write(".")
                sys.stdout.flush()
                time.sleep(POLL_INTERVAL)
                continue

            document = item.get("documents", {})
            doc_name = document.get("bates_number") or document.get("title") or item["document_id"]
            print(f"\nProcessing: {doc_name}")

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
