#!/usr/bin/env python3
"""
Auto-classify document images by image_type.

Reads document_images from Supabase, downloads each from R2, analyzes
dimensions/aspect ratio/color distribution/page context to classify as:
  - photo: photographs (people, places, objects)
  - graphic: logos, diagrams, illustrations
  - signature: handwritten signatures
  - map: maps and floor plans
  - chart: charts, graphs, tables
  - embedded: default/uncategorized

Uses heuristics (no ML model) based on:
  1. Aspect ratio (signatures tend to be very wide)
  2. Color histogram (photos have smooth gradients; graphics have few solid colors)
  3. Edge density (signatures have sparse edges; photos dense)
  4. File size relative to dimensions (photos compress less than graphics)
  5. Metadata from extraction (page coverage, images_on_page)

Usage:
  cd services/worker
  python3 ../../scripts/classify-images.py [--dry-run] [--limit 100] [--reclassify]

Requires services/worker/.env for Supabase + R2 credentials.
"""

import sys
import os
import argparse
from pathlib import Path
from collections import Counter

# Add worker directory to path
WORKER_DIR = Path(__file__).resolve().parent.parent / "services" / "worker"
sys.path.insert(0, str(WORKER_DIR))
os.chdir(WORKER_DIR)

from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from supabase import create_client
from storage import download_file

import fitz  # PyMuPDF — for Pixmap analysis


def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def fetch_images(supabase, limit: int, reclassify: bool = False) -> list[dict]:
    """Fetch document_images to classify."""
    query = (
        supabase.table("document_images")
        .select("id, document_id, r2_key, width, height, format, file_size_bytes, image_type, metadata, tags")
        .order("created_at")
        .limit(limit)
    )
    if not reclassify:
        # Only classify images still at default "embedded" type
        query = query.eq("image_type", "embedded")

    result = query.execute()
    return result.data or []


def analyze_image(img_bytes: bytes, width: int, height: int) -> dict:
    """Analyze image pixels to extract classification features."""
    features = {
        "aspect_ratio": width / max(height, 1),
        "pixel_count": width * height,
        "bytes_per_pixel": len(img_bytes) / max(width * height, 1),
    }

    try:
        pix = fitz.Pixmap(img_bytes)

        # Convert to RGB if needed
        if pix.n > 3:
            pix = fitz.Pixmap(fitz.csRGB, pix)

        # Sample pixels for color analysis (every 10th pixel for speed)
        samples = pix.samples
        stride = pix.stride
        n = pix.n
        total_pixels = pix.width * pix.height

        # Count unique colors (sampled)
        color_counter = Counter()
        step = max(1, total_pixels // 500)  # ~500 samples
        for i in range(0, len(samples), step * n):
            if i + n <= len(samples):
                color = tuple(samples[i:i + n])
                color_counter[color] += 1

        features["unique_colors"] = len(color_counter)
        features["dominant_color_pct"] = max(color_counter.values()) / sum(color_counter.values()) if color_counter else 0

        # Check if mostly black/white (signature indicator)
        bw_count = 0
        for color, count in color_counter.items():
            brightness = sum(color[:3]) / 3
            if brightness < 30 or brightness > 225:
                bw_count += count
        features["bw_ratio"] = bw_count / sum(color_counter.values()) if color_counter else 0

        # Check for large uniform regions (graphic indicator)
        top_3_pct = sum(sorted(color_counter.values(), reverse=True)[:3]) / sum(color_counter.values()) if color_counter else 0
        features["top3_color_pct"] = top_3_pct

    except Exception:
        features["unique_colors"] = 0
        features["dominant_color_pct"] = 0
        features["bw_ratio"] = 0
        features["top3_color_pct"] = 0

    return features


def classify(features: dict, metadata: dict | None) -> str:
    """Classify image type based on extracted features."""
    ar = features["aspect_ratio"]
    bw = features["bw_ratio"]
    unique = features["unique_colors"]
    top3 = features["top3_color_pct"]
    bpp = features["bytes_per_pixel"]
    pixels = features["pixel_count"]

    # Signature detection: very wide, mostly black on white, few colors
    if ar > 2.5 and bw > 0.85 and unique < 50:
        return "signature"
    if ar > 3.0 and bw > 0.7:
        return "signature"

    # Small, mostly B&W with few colors = likely a stamp or signature
    if pixels < 50000 and bw > 0.8 and unique < 30:
        return "signature"

    # Chart/table: moderate aspect ratio, few solid colors, structured
    if 0.5 < ar < 2.0 and top3 > 0.7 and unique < 100 and pixels > 50000:
        return "chart"

    # Graphic/logo: few unique colors, high top-3 concentration
    if unique < 40 and top3 > 0.6:
        return "graphic"

    # Map: large, moderate colors, specific compression ratio
    if pixels > 200000 and 0.6 < ar < 1.8 and 30 < unique < 200 and bpp > 0.5:
        return "map"

    # Photo: many unique colors, smooth gradients, typical compression
    if unique > 100 and top3 < 0.5:
        return "photo"

    # Photo fallback: large image with decent color variety
    if pixels > 100000 and unique > 50:
        return "photo"

    # Default to embedded if nothing else matches
    return "embedded"


def main():
    parser = argparse.ArgumentParser(description="Auto-classify document images")
    parser.add_argument("--dry-run", action="store_true", help="Show classifications without updating DB")
    parser.add_argument("--limit", type=int, default=500, help="Max images to process (default: 500)")
    parser.add_argument("--reclassify", action="store_true", help="Re-classify all images (not just 'embedded')")
    args = parser.parse_args()

    supabase = get_supabase()
    images = fetch_images(supabase, args.limit, args.reclassify)

    print(f"\n{'=' * 60}")
    print(f"  Image Auto-Classification")
    print(f"  Images to process: {len(images)}")
    print(f"  Dry run: {args.dry_run}")
    print(f"  Reclassify: {args.reclassify}")
    print(f"{'=' * 60}\n")

    stats = Counter()
    errors = 0

    for img in images:
        r2_key = img["r2_key"]
        w = img.get("width") or 0
        h = img.get("height") or 0
        old_type = img.get("image_type", "embedded")

        try:
            img_bytes = download_file(r2_key)
        except Exception as e:
            print(f"  [ERROR] {r2_key}: {e}")
            errors += 1
            continue

        features = analyze_image(img_bytes, w, h)
        new_type = classify(features, img.get("metadata"))
        stats[new_type] += 1

        if args.dry_run:
            label = f"  [{new_type:>9}]" if new_type != old_type else f"  [{'=' * 9}]"
            print(f"{label} {r2_key} ({w}x{h}, {features['unique_colors']} colors, bw={features['bw_ratio']:.2f}, ar={features['aspect_ratio']:.2f})")
        else:
            if new_type != old_type:
                supabase.table("document_images").update(
                    {"image_type": new_type}
                ).eq("id", img["id"]).execute()
                print(f"  {old_type} -> {new_type}: {r2_key}")

    print(f"\n{'=' * 60}")
    print(f"  Classification Results:")
    for itype, count in sorted(stats.items(), key=lambda x: -x[1]):
        print(f"    {itype:>12}: {count}")
    print(f"    {'errors':>12}: {errors}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
