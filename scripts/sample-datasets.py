#!/usr/bin/env python3
"""
DOJ EFTA Dataset Sampling & Scan Analysis

Downloads random PDFs from each of the 12 DOJ EFTA datasets and analyzes
whether pages are scanned images, born-digital text, or hybrid (OCR'd scans).
Produces a JSON report with per-dataset statistics.

This is a standalone analysis tool — no Supabase or R2 dependencies.
Only requires PyMuPDF (fitz) and httpx.

Usage:
  python3 scripts/sample-datasets.py [--samples-per-dataset 20] [--seed 42] [--resume]

Output:
  scripts/scan-analysis-report.json
"""

import argparse
import json
import random
import time
from datetime import datetime
from pathlib import Path

import fitz  # PyMuPDF
import httpx

# ── DOJ Constants ────────────────────────────────────────

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

DOJ_AGE_COOKIE = {"justiceGovAgeVerified": "true"}

DEFAULT_OUTPUT = Path(__file__).resolve().parent / "scan-analysis-report.json"


# ── Sampling ─────────────────────────────────────────────

def generate_samples(n_per_dataset: int, seed: int) -> dict[int, list[str]]:
    """Generate random Bates numbers for each dataset."""
    rng = random.Random(seed)
    samples = {}
    for ds, lo, hi in DATASET_RANGES:
        count = min(n_per_dataset, hi - lo + 1)
        nums = rng.sample(range(lo, hi + 1), count)
        samples[ds] = [f"EFTA{n:08d}" for n in sorted(nums)]
    return samples


def dataset_from_efta(bates: str) -> int | None:
    num = int(bates.replace("EFTA", ""))
    for ds, lo, hi in DATASET_RANGES:
        if lo <= num <= hi:
            return ds
    return None


# ── Download ─────────────────────────────────────────────

def download_pdf(bates: str, client: httpx.Client) -> tuple[bytes | None, int | None]:
    """
    Download a PDF from DOJ, trying predicted dataset first then all others.
    Returns (pdf_bytes, dataset_found_on) or (None, None).
    """
    padded = bates.replace("EFTA", "")
    predicted = dataset_from_efta(bates)
    order = ([predicted] if predicted else []) + [ds for ds in range(1, 13) if ds != predicted]

    for ds in order:
        url = f"https://www.justice.gov/epstein/files/DataSet%20{ds}/EFTA{padded}.pdf"
        try:
            resp = client.get(url, cookies=DOJ_AGE_COOKIE)
            if resp.status_code == 200 and resp.content[:4] == b"%PDF":
                return resp.content, ds
        except Exception:
            continue

    return None, None


# ── Page Analysis ────────────────────────────────────────

def is_page_scan(page: fitz.Page, img_width: int, img_height: int) -> bool:
    """Check if a single image covers >90% of the page."""
    rect = page.rect
    if rect.width <= 0 or rect.height <= 0:
        return False
    return (img_width / rect.width) > 0.9 and (img_height / rect.height) > 0.9


def analyze_page(page: fitz.Page) -> dict:
    """Classify a single page as scanned, born_digital, or hybrid."""
    # Check for images
    try:
        images = page.get_images(full=True)
    except Exception:
        images = []

    has_full_page_image = False
    img_width = None
    img_height = None

    for img_info in images:
        w = img_info[2]
        h = img_info[3]
        if is_page_scan(page, w, h):
            has_full_page_image = True
            img_width = w
            img_height = h
            break

    # Check for text
    try:
        text = page.get_text().strip()
    except Exception:
        text = ""

    has_text = len(text) > 10  # more than trivial whitespace/artifacts

    # Classify
    if has_full_page_image and has_text:
        classification = "hybrid"
    elif has_full_page_image:
        classification = "scanned"
    elif has_text:
        classification = "born_digital"
    else:
        classification = "scanned"  # blank or image-only without text

    return {
        "classification": classification,
        "image_count": len(images),
        "has_full_page_image": has_full_page_image,
        "has_text_layer": has_text,
        "text_length": len(text),
        "image_width": img_width,
        "image_height": img_height,
        "page_width": round(page.rect.width, 1),
        "page_height": round(page.rect.height, 1),
    }


def analyze_document(pdf_bytes: bytes) -> dict:
    """Analyze all pages of a PDF and produce a summary."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    pages = []
    scanned = 0
    hybrid = 0
    born_digital = 0
    resolutions = set()

    for page_num in range(doc.page_count):
        page = doc[page_num]
        result = analyze_page(page)
        result["page_number"] = page_num

        if result["classification"] == "scanned":
            scanned += 1
        elif result["classification"] == "hybrid":
            hybrid += 1
        else:
            born_digital += 1

        if result["image_width"] and result["image_height"]:
            resolutions.add((result["image_width"], result["image_height"]))

        pages.append(result)

    # Extract PDF metadata
    metadata = doc.metadata or {}
    fonts = set()
    for page_num in range(min(doc.page_count, 5)):  # sample first 5 pages
        try:
            for font in doc[page_num].get_fonts():
                if font[3]:  # font name
                    fonts.add(font[3])
        except Exception:
            pass

    # Determine overall classification
    if born_digital == 0 and hybrid == 0:
        overall = "all_scanned"
    elif scanned == 0 and hybrid == 0:
        overall = "all_born_digital"
    elif scanned == 0 and born_digital == 0:
        overall = "all_hybrid"
    else:
        overall = "mixed"

    doc.close()

    return {
        "page_count": len(pages),
        "scanned_pages": scanned,
        "hybrid_pages": hybrid,
        "born_digital_pages": born_digital,
        "classification": overall,
        "resolutions": [{"width": w, "height": h} for w, h in sorted(resolutions)],
        "fonts": sorted(fonts),
        "pdf_producer": metadata.get("producer", ""),
        "pdf_creator": metadata.get("creator", ""),
        "pages": pages,
    }


# ── Report ───────────────────────────────────────────────

def generate_report(results: dict, samples_per_dataset: int, seed: int) -> dict:
    """Aggregate per-dataset and overall statistics."""
    per_dataset = {}
    overall_pages = 0
    overall_scanned = 0
    overall_hybrid = 0
    overall_born_digital = 0
    overall_found = 0
    overall_attempted = 0

    for ds, lo, hi in DATASET_RANGES:
        ds_results = results.get(str(ds), [])
        found = [r for r in ds_results if r.get("status") == "found"]
        not_found = [r for r in ds_results if r.get("status") == "not_found"]

        ds_pages = sum(r.get("analysis", {}).get("page_count", 0) for r in found)
        ds_scanned = sum(r.get("analysis", {}).get("scanned_pages", 0) for r in found)
        ds_hybrid = sum(r.get("analysis", {}).get("hybrid_pages", 0) for r in found)
        ds_born_digital = sum(r.get("analysis", {}).get("born_digital_pages", 0) for r in found)

        # Collect unique resolutions
        all_resolutions = []
        for r in found:
            all_resolutions.extend(r.get("analysis", {}).get("resolutions", []))

        per_dataset[str(ds)] = {
            "range": [lo, hi],
            "samples_attempted": len(ds_results),
            "samples_found": len(found),
            "samples_not_found": len(not_found),
            "availability_rate": round(len(found) / max(len(ds_results), 1), 3),
            "total_pages": ds_pages,
            "scanned_pages": ds_scanned,
            "hybrid_pages": ds_hybrid,
            "born_digital_pages": ds_born_digital,
            "scan_percentage": round((ds_scanned + ds_hybrid) / max(ds_pages, 1) * 100, 1),
            "avg_page_count": round(ds_pages / max(len(found), 1), 1),
            "resolutions": all_resolutions,
        }

        overall_pages += ds_pages
        overall_scanned += ds_scanned
        overall_hybrid += ds_hybrid
        overall_born_digital += ds_born_digital
        overall_found += len(found)
        overall_attempted += len(ds_results)

    return {
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "samples_per_dataset": samples_per_dataset,
            "random_seed": seed,
            "total_attempted": overall_attempted,
            "total_found": overall_found,
            "total_pages_analyzed": overall_pages,
        },
        "per_dataset": per_dataset,
        "overall": {
            "total_pages": overall_pages,
            "scanned_pages": overall_scanned,
            "hybrid_pages": overall_hybrid,
            "born_digital_pages": overall_born_digital,
            "scan_percentage": round((overall_scanned + overall_hybrid) / max(overall_pages, 1) * 100, 1),
            "availability_rate": round(overall_found / max(overall_attempted, 1), 3),
        },
    }


def print_summary_table(report: dict):
    """Print a formatted summary table to stdout."""
    print(f"\n{'=' * 80}")
    print(f"  DOJ EFTA Dataset Scan Analysis")
    print(f"  Generated: {report['metadata']['generated_at']}")
    print(f"  Seed: {report['metadata']['random_seed']}")
    print(f"{'=' * 80}\n")

    header = f"{'Dataset':>8} | {'Found':>7} | {'Pages':>6} | {'Scanned':>8} | {'Hybrid':>7} | {'Digital':>8} | {'Scan%':>6}"
    print(header)
    print("-" * len(header))

    for ds in range(1, 13):
        d = report["per_dataset"].get(str(ds), {})
        found = f"{d.get('samples_found', 0)}/{d.get('samples_attempted', 0)}"
        pages = d.get("total_pages", 0)
        scanned = d.get("scanned_pages", 0)
        hybrid = d.get("hybrid_pages", 0)
        digital = d.get("born_digital_pages", 0)
        pct = f"{d.get('scan_percentage', 0):.0f}%"
        print(f"{'DS ' + str(ds):>8} | {found:>7} | {pages:>6} | {scanned:>8} | {hybrid:>7} | {digital:>8} | {pct:>6}")

    o = report["overall"]
    total_found = f"{report['metadata']['total_found']}/{report['metadata']['total_attempted']}"
    print("-" * len(header))
    print(f"{'TOTAL':>8} | {total_found:>7} | {o['total_pages']:>6} | {o['scanned_pages']:>8} | {o['hybrid_pages']:>7} | {o['born_digital_pages']:>8} | {o['scan_percentage']:.0f}%")
    print()


# ── Main ─────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Sample and analyze DOJ EFTA datasets for scan detection")
    parser.add_argument("--samples-per-dataset", type=int, default=20,
                        help="Number of random documents per dataset (default: 20)")
    parser.add_argument("--seed", type=int, default=42,
                        help="Random seed for reproducibility (default: 42)")
    parser.add_argument("--output", type=str, default=str(DEFAULT_OUTPUT),
                        help="Output JSON report path")
    parser.add_argument("--delay", type=float, default=0.5,
                        help="Delay between downloads in seconds (default: 0.5)")
    parser.add_argument("--resume", action="store_true",
                        help="Resume from existing partial report")
    parser.add_argument("--dataset", type=int, default=0,
                        help="Only sample this dataset number (0 = all)")
    args = parser.parse_args()

    output_path = Path(args.output)
    samples = generate_samples(args.samples_per_dataset, args.seed)

    # Load existing results for resume
    existing_results: dict[str, list] = {}
    existing_bates: set[str] = set()
    if args.resume and output_path.exists():
        with open(output_path) as f:
            old_report = json.load(f)
        for ds_key, ds_docs in old_report.get("per_dataset", {}).items():
            # The full results might be nested — check structure
            pass
        # Load from raw results file instead
        raw_path = output_path.with_suffix(".raw.json")
        if raw_path.exists():
            with open(raw_path) as f:
                existing_results = json.load(f)
            for ds_key, docs in existing_results.items():
                for doc in docs:
                    existing_bates.add(doc.get("bates", ""))
        print(f"[RESUME] Loaded {len(existing_bates)} previously sampled documents")

    # Filter datasets if --dataset specified
    datasets_to_sample = [args.dataset] if args.dataset > 0 else list(range(1, 13))

    # Initialize results
    results: dict[str, list] = existing_results.copy()
    for ds in datasets_to_sample:
        if str(ds) not in results:
            results[str(ds)] = []

    total_samples = sum(len(samples[ds]) for ds in datasets_to_sample)
    completed = 0
    start_time = time.time()

    print(f"\n{'=' * 60}")
    print(f"  DOJ EFTA Dataset Sampling")
    print(f"  Datasets: {datasets_to_sample}")
    print(f"  Samples per dataset: {args.samples_per_dataset}")
    print(f"  Total samples: {total_samples}")
    print(f"  Seed: {args.seed}")
    print(f"{'=' * 60}\n")

    with httpx.Client(timeout=60, follow_redirects=True) as client:
        for ds in datasets_to_sample:
            ds_samples = samples[ds]
            ds_found = 0
            ds_not_found = 0

            for bates in ds_samples:
                if bates in existing_bates:
                    completed += 1
                    continue

                # Download
                pdf_bytes, found_on_ds = download_pdf(bates, client)

                if pdf_bytes:
                    # Analyze
                    try:
                        analysis = analyze_document(pdf_bytes)
                        result = {
                            "bates": bates,
                            "status": "found",
                            "dataset_predicted": ds,
                            "dataset_found_on": found_on_ds,
                            "file_size": len(pdf_bytes),
                            "analysis": {
                                "page_count": analysis["page_count"],
                                "scanned_pages": analysis["scanned_pages"],
                                "hybrid_pages": analysis["hybrid_pages"],
                                "born_digital_pages": analysis["born_digital_pages"],
                                "classification": analysis["classification"],
                                "resolutions": analysis["resolutions"],
                                "fonts": analysis["fonts"],
                                "pdf_producer": analysis["pdf_producer"],
                                "pdf_creator": analysis["pdf_creator"],
                            },
                        }
                        ds_found += 1
                        cls = analysis["classification"]
                        pages = analysis["page_count"]
                        loc = f"DS{found_on_ds}" if found_on_ds != ds else f"DS{ds}"
                        print(f"  [DS{ds:2d}] [{completed + 1}/{total_samples}] {bates} — "
                              f"{pages}pp, {cls} ({loc})")
                    except Exception as e:
                        result = {"bates": bates, "status": "error", "error": str(e)}
                        print(f"  [DS{ds:2d}] [{completed + 1}/{total_samples}] {bates} — ERROR: {e}")
                else:
                    result = {"bates": bates, "status": "not_found", "dataset_predicted": ds}
                    ds_not_found += 1
                    print(f"  [DS{ds:2d}] [{completed + 1}/{total_samples}] {bates} — not found")

                results[str(ds)].append(result)
                completed += 1
                time.sleep(args.delay)

            print(f"  --- DS{ds}: {ds_found} found, {ds_not_found} not found ---\n")

            # Save raw results after each dataset (for resume)
            raw_path = output_path.with_suffix(".raw.json")
            with open(raw_path, "w") as f:
                json.dump(results, f, indent=2)

    # Generate final report
    report = generate_report(results, args.samples_per_dataset, args.seed)

    # Save report
    with open(output_path, "w") as f:
        json.dump(report, f, indent=2)

    print_summary_table(report)

    elapsed = time.time() - start_time
    print(f"  Elapsed: {elapsed:.0f}s")
    print(f"  Report saved to: {output_path}")
    print(f"  Raw data saved to: {output_path.with_suffix('.raw.json')}")


if __name__ == "__main__":
    main()
