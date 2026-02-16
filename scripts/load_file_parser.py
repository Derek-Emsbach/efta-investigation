"""
eDiscovery Load File Parser — DAT/OPT manifest parsing and forensic analysis.

Parses Concordance DAT and Opticon OPT files from DOJ eDiscovery productions,
analyzes metadata completeness, detects Bates gaps, and creates/updates
document records in Supabase.

This is a manifest-only tool — it does NOT upload PDFs to R2. Use the web UI
upload flow or bulk-import.py for that.

Supports batch mode: point at a folder with multiple DAT/OPT files and it
processes every pair it finds.

Usage:
    cd services/worker && source .venv/bin/activate && cd ../..

    # Single volume
    python scripts/load_file_parser.py /path/to/VOL00011 --dataset-number 12

    # Batch mode — all DAT/OPT files in one folder
    python scripts/load_file_parser.py /path/to/loadfiles --auto-create

    # Dry run (parse + analyze, no database changes)
    python scripts/load_file_parser.py /path/to/loadfiles --dry-run

Environment:
    Reads SUPABASE_URL and SUPABASE_SERVICE_KEY from services/worker/.env
"""

import argparse
import json
import re
import sys
from pathlib import Path

# Add worker dir to path so we can reuse config (loads .env automatically)
sys.path.insert(0, str(Path(__file__).parent.parent / "services" / "worker"))

from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from supabase import create_client

# ── Constants ──────────────────────────────────────────────

# Concordance delimiters
THORN = "\xfe"       # þ — standard field delimiter
REGISTERED = "\xae"  # ® — standard text qualifier
ALT_DELIM = "\x14"   # ASCII 20 — alternate field delimiter (some DOJ volumes)

# Standard eDiscovery fields that a properly produced DAT should contain
EXPECTED_EDISCOVERY_FIELDS = [
    "BEGBATES", "ENDBATES", "BEGATTACH", "ENDATTACH",
    "CUSTODIAN", "DOCTYPE", "DATECREATED", "DATEMODIFIED",
    "DATESENT", "AUTHOR", "FROM", "TO", "CC", "BCC",
    "SUBJECT", "FILEPATH", "FILENAME", "FILEEXT",
    "NUMPAGES", "CONFIDENTIALITY", "REDACTION_BASIS",
    "PRODUCTION_VOLUME",
]


# ── Parsers ────────────────────────────────────────────────

def parse_dat_file(filepath: str) -> tuple[list[str], list[dict]]:
    """Parse a Concordance DAT file.

    Auto-detects encoding (UTF-8 vs latin-1) and delimiter (ASCII 20 vs thorn).
    Standard Concordance format: þ is text qualifier, \\x14 is field separator.
    Returns (headers, list_of_record_dicts).
    """
    # Try UTF-8 first (DOJ large volumes use UTF-8 encoded thorn),
    # fall back to latin-1 for older volumes
    raw = Path(filepath).read_bytes()
    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError:
        content = raw.decode("latin-1")

    lines = [l for l in content.splitlines() if l.strip()]

    if not lines:
        return [], []

    header_line = lines[0]

    # Detect delimiter: ASCII 20 (\x14) is the standard Concordance field separator.
    # Thorn (þ) is the text qualifier, NOT the delimiter — but some volumes use
    # thorn as delimiter when \x14 is absent.
    if ALT_DELIM in header_line:
        delimiter = ALT_DELIM
    elif THORN in header_line:
        delimiter = THORN
    else:
        # Fallback: try comma
        delimiter = ","

    # Text qualifiers to strip from field values
    qualifiers = {THORN, REGISTERED}

    def parse_row(line: str) -> list[str]:
        """Split a row by delimiter, stripping text qualifiers."""
        fields = line.split(delimiter)
        result = []
        for field in fields:
            f = field.strip()
            # Strip text qualifiers (þ or ®) from both ends
            while f and f[0] in qualifiers:
                f = f[1:]
            while f and f[-1] in qualifiers:
                f = f[:-1]
            result.append(f.strip())
        return result

    headers = parse_row(header_line)
    # Filter out empty headers
    headers = [h for h in headers if h]

    records = []
    for line in lines[1:]:
        values = parse_row(line)
        # Build dict from header-value pairs
        record = {}
        for i, header in enumerate(headers):
            record[header] = values[i] if i < len(values) else ""
        records.append(record)

    return headers, records


def parse_opt_file(filepath: str) -> list[dict]:
    """Parse an Opticon OPT file.

    Returns list of page records with document break markers.
    """
    content = Path(filepath).read_text(encoding="latin-1")
    lines = [l for l in content.splitlines() if l.strip()]

    records = []
    for line in lines:
        parts = line.split(",")
        if len(parts) < 4:
            continue

        records.append({
            "bates_number": parts[0].strip(),
            "volume_label": parts[1].strip() if len(parts) > 1 else "",
            "image_path": parts[2].strip() if len(parts) > 2 else "",
            "document_break": parts[3].strip().upper() == "Y",
            "folder_break": parts[4].strip().upper() == "Y" if len(parts) > 4 else False,
            "page_count_field": int(parts[5].strip()) if len(parts) > 5 and parts[5].strip().isdigit() else None,
        })

    return records


def compute_page_counts(opt_records: list[dict]) -> dict[str, int]:
    """Compute page count per document from OPT records.

    Documents are delimited by DocumentBreak=Y markers. Each page
    between two markers belongs to the same document.
    """
    page_counts: dict[str, int] = {}
    current_bates: str | None = None
    current_count = 0

    for rec in opt_records:
        if rec["document_break"]:
            # Save previous document
            if current_bates is not None:
                page_counts[current_bates] = current_count
            # Start new document
            current_bates = rec["bates_number"]
            current_count = 1
        else:
            current_count += 1

    # Save last document
    if current_bates is not None:
        page_counts[current_bates] = current_count

    return page_counts


# ── Forensic Analysis ──────────────────────────────────────

def analyze_load_files(
    dat_headers: list[str],
    dat_records: list[dict],
    opt_records: list[dict],
    page_counts: dict[str, int],
) -> dict:
    """Analyze load files for metadata completeness, Bates gaps, and anomalies."""

    # Normalize headers for comparison
    normalized = [h.upper().strip() for h in dat_headers]

    # Field presence analysis
    fields_present = []
    for expected in EXPECTED_EDISCOVERY_FIELDS:
        # Fuzzy match: check if expected field appears in any header
        if any(expected in h or h in expected for h in normalized):
            fields_present.append(expected)

    fields_missing = [f for f in EXPECTED_EDISCOVERY_FIELDS if f not in fields_present]
    completeness = len(fields_present) / len(EXPECTED_EDISCOVERY_FIELDS) if EXPECTED_EDISCOVERY_FIELDS else 0

    # Metadata status classification
    if completeness < 0.3:
        metadata_status = "stripped"
    elif completeness < 0.8:
        metadata_status = "partial"
    else:
        metadata_status = "present"

    # Forensic flags
    forensic_flags: list[str] = []
    if completeness < 0.3:
        forensic_flags.append("RF-FORENSIC-4: Severe metadata suppression in load files")
    if completeness < 0.1:
        forensic_flags.append("RF-FORENSIC-4a: Near-total metadata stripping (< 10% fields present)")

    # Bates gap detection from OPT document breaks
    doc_bates = [r["bates_number"] for r in opt_records if r["document_break"]]
    bates_gaps = detect_bates_gaps(doc_bates)

    if bates_gaps:
        total_missing = sum(g["missing_count"] for g in bates_gaps)
        forensic_flags.append(f"BATES_GAP: {len(bates_gaps)} gap(s), {total_missing} document(s) missing")

    # Bates range
    all_bates = [r["bates_number"] for r in opt_records]
    bates_range_start = all_bates[0] if all_bates else ""
    bates_range_end = all_bates[-1] if all_bates else ""

    # Volume label
    volume_label = opt_records[0]["volume_label"] if opt_records else ""

    # Total pages vs documents
    total_pages = len(opt_records)
    total_documents = len(page_counts)

    return {
        "volume_label": volume_label,
        "dat_fields_present": fields_present,
        "dat_fields_missing": fields_missing,
        "dat_headers_raw": dat_headers,
        "metadata_completeness": round(completeness, 3),
        "metadata_status": metadata_status,
        "dat_record_count": len(dat_records),
        "opt_record_count": total_pages,
        "total_documents": total_documents,
        "total_pages": total_pages,
        "bates_range_start": bates_range_start,
        "bates_range_end": bates_range_end,
        "bates_gaps": bates_gaps,
        "forensic_flags": forensic_flags,
    }


def detect_bates_gaps(bates_numbers: list[str]) -> list[dict]:
    """Find gaps in Bates number sequences.

    Extracts numeric portions, sorts them, and checks for non-consecutive numbers.
    """
    # Extract numeric portions
    bates_with_nums: list[tuple[str, int]] = []
    for b in bates_numbers:
        nums = re.sub(r"[^\d]", "", b)
        if nums:
            bates_with_nums.append((b, int(nums)))

    if len(bates_with_nums) < 2:
        return []

    # Sort by numeric value
    bates_with_nums.sort(key=lambda x: x[1])

    gaps = []
    for i in range(1, len(bates_with_nums)):
        prev_bates, prev_num = bates_with_nums[i - 1]
        curr_bates, curr_num = bates_with_nums[i]
        missing = curr_num - prev_num - 1

        if missing > 0:
            gaps.append({
                "after": prev_bates,
                "before": curr_bates,
                "after_num": prev_num,
                "before_num": curr_num,
                "missing_count": missing,
            })

    return gaps


# ── Database Operations ────────────────────────────────────

BATCH_SIZE = 500  # Supabase insert batch size


def resolve_bates_field(dat_records: list[dict]) -> str | None:
    """Determine which DAT field holds the bates number."""
    if not dat_records:
        return None
    first_keys = list(dat_records[0].keys())
    for candidate in ["BEGBATES", "BEGATTACH", "BEG_BATES", "BATES_BEG", "BEGIN BATES", "BEG BATES"]:
        matches = [k for k in first_keys if candidate in k.upper()]
        if matches:
            return matches[0]
    # Fallback: first field
    return first_keys[0] if first_keys else None


def upsert_documents(
    supabase,
    dat_records: list[dict],
    page_counts: dict[str, int],
    dataset_id: str | None,
    analysis: dict,
) -> dict:
    """Create or update document records from parsed load file data.

    Uses batch inserts for new documents (chunks of BATCH_SIZE) and
    individual updates for existing documents that need forensic_metadata merging.
    """

    stats = {"created": 0, "updated": 0, "skipped": 0, "errors": 0}

    bates_field = resolve_bates_field(dat_records)

    # If no DAT records, use OPT document breaks
    if not dat_records and page_counts:
        dat_records = [{"_bates": b} for b in page_counts]
        bates_field = "_bates"

    # Shared forensic_metadata payload (same for all docs in this volume)
    fm_payload = {
        "source_volume": analysis["volume_label"],
        "metadata_status": analysis["metadata_status"],
        "loadfile_analysis": {
            "dat_fields_present": analysis["dat_fields_present"],
            "metadata_completeness": analysis["metadata_completeness"],
            "forensic_flags": analysis["forensic_flags"],
        },
    }

    # Collect all bates numbers we need to process
    bates_list: list[str] = []
    bates_to_record: dict[str, dict] = {}
    for record in dat_records:
        bates = record.get(bates_field, "").strip() if bates_field else ""
        if not bates:
            stats["skipped"] += 1
            continue
        bates_list.append(bates)
        bates_to_record[bates] = record

    if not bates_list:
        return stats

    total = len(bates_list)
    print(f"  Processing {total} documents...")

    # Step 1: Find which bates numbers already exist (batch query)
    existing_map: dict[str, dict] = {}  # bates_number → { id, forensic_metadata }
    QUERY_CHUNK = 500
    for i in range(0, len(bates_list), QUERY_CHUNK):
        chunk = bates_list[i : i + QUERY_CHUNK]
        try:
            result = (
                supabase.table("documents")
                .select("id, bates_number, forensic_metadata")
                .in_("bates_number", chunk)
                .execute()
            )
            for row in result.data:
                existing_map[row["bates_number"]] = row
        except Exception as e:
            print(f"  WARNING: batch lookup failed at offset {i}: {e}")

    # Step 2: Update existing documents (individual — need to merge forensic_metadata)
    existing_count = len(existing_map)
    if existing_count > 0:
        print(f"  Updating {existing_count} existing documents...")
        for idx, (bates, row) in enumerate(existing_map.items()):
            try:
                old_fm = row.get("forensic_metadata") or {}
                merged_fm = {**old_fm, **fm_payload}
                update_fields: dict = {"forensic_metadata": merged_fm}

                pages = page_counts.get(bates)
                if pages is not None:
                    update_fields["page_count"] = pages
                if dataset_id:
                    update_fields["dataset_id"] = dataset_id

                supabase.table("documents").update(update_fields).eq("id", row["id"]).execute()
                stats["updated"] += 1
            except Exception as e:
                print(f"  ERROR updating {bates}: {e}")
                stats["errors"] += 1

    # Step 3: Batch insert new documents
    new_bates = [b for b in bates_list if b not in existing_map]
    if new_bates:
        print(f"  Inserting {len(new_bates)} new documents in batches of {BATCH_SIZE}...")
        batch: list[dict] = []

        for idx, bates in enumerate(new_bates):
            record = bates_to_record[bates]
            pages = page_counts.get(bates)

            insert_fields: dict = {
                "bates_number": bates,
                "title": bates,
                "processing_status": "queued",
                "forensic_metadata": fm_payload,
            }
            if pages is not None:
                insert_fields["page_count"] = pages
            if dataset_id:
                insert_fields["dataset_id"] = dataset_id

            # Check for SUBJECT or title field in DAT
            for title_field in ["SUBJECT", "TITLE", "DESCRIPTION"]:
                val = record.get(title_field, "").strip()
                if val:
                    insert_fields["title"] = val
                    break

            batch.append(insert_fields)

            # Flush batch when full or at end
            if len(batch) >= BATCH_SIZE or idx == len(new_bates) - 1:
                try:
                    supabase.table("documents").insert(batch).execute()
                    stats["created"] += len(batch)
                except Exception as e:
                    print(f"  ERROR batch insert at {idx - len(batch) + 1}-{idx}: {e}")
                    stats["errors"] += len(batch)
                batch = []

                # Progress indicator for large volumes
                done = stats["created"] + stats["errors"]
                if done % 5000 < BATCH_SIZE or idx == len(new_bates) - 1:
                    pct = done / len(new_bates) * 100
                    print(f"    {done:,} / {len(new_bates):,} ({pct:.0f}%)")

    return stats


def update_dataset(
    supabase,
    dataset_id: str,
    analysis: dict,
) -> None:
    """Update the dataset row with Bates range and file/page counts."""

    # Build notes summary
    notes_parts = [
        f"Load file analysis for {analysis['volume_label']}:",
        f"  DAT fields present ({len(analysis['dat_fields_present'])}): {', '.join(analysis['dat_fields_present']) or 'None'}",
        f"  DAT fields missing ({len(analysis['dat_fields_missing'])}): {', '.join(analysis['dat_fields_missing'][:5])}{'...' if len(analysis['dat_fields_missing']) > 5 else ''}",
        f"  Metadata completeness: {analysis['metadata_completeness']:.1%} ({analysis['metadata_status']})",
        f"  Documents: {analysis['total_documents']}, Pages: {analysis['total_pages']}",
    ]
    if analysis["bates_gaps"]:
        notes_parts.append(f"  Bates gaps: {len(analysis['bates_gaps'])}")
    if analysis["forensic_flags"]:
        notes_parts.append(f"  Forensic flags: {'; '.join(analysis['forensic_flags'])}")

    notes_text = "\n".join(notes_parts)

    update_fields = {
        "bates_range_start": analysis["bates_range_start"],
        "bates_range_end": analysis["bates_range_end"],
        "total_files": analysis["total_documents"],
        "total_pages": analysis["total_pages"],
        "notes": notes_text,
    }

    supabase.table("datasets").update(update_fields).eq("id", dataset_id).execute()
    print(f"  Updated dataset {dataset_id}")


# ── Report ─────────────────────────────────────────────────

def print_report(analysis: dict, page_counts: dict[str, int]) -> None:
    """Print a human-readable forensic analysis report."""

    print()
    print("=" * 60)
    print(f"  LOAD FILE ANALYSIS: {analysis['volume_label'] or 'Unknown Volume'}")
    print("=" * 60)
    print()

    # Bates range
    print(f"  Bates Range:  {analysis['bates_range_start']} → {analysis['bates_range_end']}")
    print(f"  Documents:    {analysis['total_documents']}")
    print(f"  Total Pages:  {analysis['total_pages']}")
    print()

    # DAT field analysis
    print("  DAT FIELD ANALYSIS")
    print("  " + "─" * 40)
    completeness_pct = analysis["metadata_completeness"] * 100
    status_label = analysis["metadata_status"].upper()
    print(f"  Completeness: {completeness_pct:.1f}% ({status_label})")
    print()

    if analysis["dat_fields_present"]:
        print(f"  Fields present ({len(analysis['dat_fields_present'])}):")
        for f in analysis["dat_fields_present"]:
            print(f"    ✓ {f}")
    else:
        print("  Fields present: NONE")
    print()

    print(f"  Fields missing ({len(analysis['dat_fields_missing'])}):")
    for f in analysis["dat_fields_missing"]:
        print(f"    ✗ {f}")
    print()

    # Raw DAT headers
    if analysis["dat_headers_raw"]:
        print(f"  Raw DAT headers: {', '.join(analysis['dat_headers_raw'])}")
        print()

    # Bates gaps
    if analysis["bates_gaps"]:
        print(f"  BATES GAPS ({len(analysis['bates_gaps'])} detected)")
        print("  " + "─" * 40)
        for gap in analysis["bates_gaps"][:20]:  # Show first 20
            print(f"    Gap after {gap['after']} → before {gap['before']} ({gap['missing_count']} missing)")
        if len(analysis["bates_gaps"]) > 20:
            remaining = len(analysis["bates_gaps"]) - 20
            print(f"    ... and {remaining} more gaps")
        print()
    else:
        print("  Bates gaps: None detected (sequence is continuous)")
        print()

    # Forensic flags
    if analysis["forensic_flags"]:
        print("  FORENSIC FLAGS")
        print("  " + "─" * 40)
        for flag in analysis["forensic_flags"]:
            print(f"  ⚠  {flag}")
        print()
    else:
        print("  Forensic flags: None")
        print()

    # Page count distribution
    if page_counts:
        counts = sorted(page_counts.values())
        min_p = counts[0]
        max_p = counts[-1]
        avg_p = sum(counts) / len(counts)
        single_page = sum(1 for c in counts if c == 1)
        print(f"  Page distribution: min={min_p}, max={max_p}, avg={avg_p:.1f}")
        print(f"  Single-page documents: {single_page} ({single_page / len(counts) * 100:.0f}%)")
        print()

    print("=" * 60)


# ── Volume Discovery & Pairing ────────────────────────────

def discover_volumes(directory: Path) -> list[dict]:
    """Find all DAT/OPT file pairs in a directory and pair by stem name.

    Returns list of dicts with 'stem', 'dat_path', 'opt_path' keys.
    A volume needs at least an OPT file; DAT is optional.
    """
    # Find all DAT and OPT files (case-insensitive)
    dat_files = list(directory.glob("**/*.DAT")) + list(directory.glob("**/*.dat"))
    opt_files = list(directory.glob("**/*.OPT")) + list(directory.glob("**/*.opt"))

    # Index by stem name (e.g., "VOL00001")
    dat_by_stem: dict[str, Path] = {}
    for f in dat_files:
        dat_by_stem[f.stem.upper()] = f
    opt_by_stem: dict[str, Path] = {}
    for f in opt_files:
        opt_by_stem[f.stem.upper()] = f

    volumes = []
    # Every OPT file defines a volume (DAT is optional)
    for stem in sorted(opt_by_stem):
        volumes.append({
            "stem": stem,
            "dat_path": dat_by_stem.get(stem),
            "opt_path": opt_by_stem[stem],
        })

    return volumes


def extract_volume_number(stem: str) -> int | None:
    """Extract numeric portion from a volume stem name like 'VOL00011' -> 11."""
    nums = re.sub(r"[^\d]", "", stem)
    return int(nums) if nums else None


def auto_create_dataset(supabase, number: int, volume_label: str) -> str:
    """Create a placeholder dataset record and return its UUID."""
    result = (
        supabase.table("datasets")
        .insert({
            "number": number,
            "name": f"Dataset {number}",
            "description": f"Auto-created from load file import ({volume_label}). Edit to add details.",
            "status": "not_started",
            "priority": "medium",
            "reviewed_count": 0,
        })
        .execute()
    )
    return result.data[0]["id"]


def process_volume(
    volume: dict,
    supabase,
    dataset_id: str | None,
    dry_run: bool,
) -> dict:
    """Process a single DAT/OPT volume pair.

    Returns dict with 'analysis', 'page_counts', 'stats' keys.
    """
    stem = volume["stem"]
    opt_path = volume["opt_path"]
    dat_path = volume["dat_path"]

    print(f"\n{'━' * 60}")
    print(f"  VOLUME: {stem}")
    print(f"{'━' * 60}")
    print(f"  OPT: {opt_path}")
    print(f"  DAT: {dat_path or '(not found — OPT-only mode)'}")
    print()

    # Parse files
    opt_records = parse_opt_file(str(opt_path))
    print(f"  OPT records: {len(opt_records)} pages")

    dat_headers: list[str] = []
    dat_records: list[dict] = []
    if dat_path:
        dat_headers, dat_records = parse_dat_file(str(dat_path))
        print(f"  DAT records: {len(dat_records)} documents, {len(dat_headers)} headers")

    # Compute page counts
    page_counts = compute_page_counts(opt_records)
    print(f"  Documents:   {len(page_counts)}")

    # Forensic analysis
    analysis = analyze_load_files(dat_headers, dat_records, opt_records, page_counts)
    print_report(analysis, page_counts)

    stats = {"created": 0, "updated": 0, "skipped": 0, "errors": 0}

    if not dry_run and supabase:
        stats = upsert_documents(supabase, dat_records, page_counts, dataset_id, analysis)
        print(f"  Created: {stats['created']}, Updated: {stats['updated']}, Skipped: {stats['skipped']}", end="")
        if stats["errors"] > 0:
            print(f", Errors: {stats['errors']}", end="")
        print()

    return {"analysis": analysis, "page_counts": page_counts, "stats": stats}


# ── Main ───────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Parse eDiscovery DAT/OPT load files and create/update document records",
        epilog="Environment: Uses SUPABASE_URL and SUPABASE_SERVICE_KEY from services/worker/.env",
    )
    parser.add_argument("volume_dir", help="Path to folder containing DAT/OPT files (single volume or batch)")
    parser.add_argument("--dataset-id", help="Supabase UUID of the dataset to link ALL documents to")
    parser.add_argument("--dataset-number", type=int, help="Dataset number (alternative to --dataset-id, will look up UUID)")
    parser.add_argument("--auto-create", action="store_true", help="Auto-create dataset records for new volumes")
    parser.add_argument("--dry-run", action="store_true", help="Parse and analyze only, don't modify the database")

    args = parser.parse_args()

    volume_path = Path(args.volume_dir)
    if not volume_path.is_dir():
        print(f"ERROR: {args.volume_dir} is not a directory")
        sys.exit(1)

    # Discover all DAT/OPT pairs
    volumes = discover_volumes(volume_path)

    if not volumes:
        print(f"ERROR: No OPT files found in {volume_path}")
        print("  Looked for *.OPT and *.opt recursively")
        sys.exit(1)

    print(f"Directory:   {volume_path}")
    print(f"Volumes:     {len(volumes)} DAT/OPT pair(s) found")
    print(f"Dry run:     {args.dry_run}")
    print(f"Auto-create: {args.auto_create}")
    for v in volumes:
        has_dat = "✓" if v["dat_path"] else "✗"
        print(f"  {v['stem']}  DAT:{has_dat}  OPT:✓")
    print()

    # Connect to Supabase (unless dry-run)
    supabase = None
    if not args.dry_run:
        print("Connecting to Supabase...")
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Resolve dataset ID (if user specified one for all volumes)
    global_dataset_id = args.dataset_id
    if not global_dataset_id and args.dataset_number and supabase:
        ds_result = (
            supabase.table("datasets")
            .select("id")
            .eq("number", args.dataset_number)
            .execute()
        )
        if ds_result.data:
            global_dataset_id = ds_result.data[0]["id"]
            print(f"  All volumes → Dataset {args.dataset_number} ({global_dataset_id})")
        elif args.auto_create:
            # Create it now
            global_dataset_id = auto_create_dataset(supabase, args.dataset_number, f"DS{args.dataset_number}")
            print(f"  Created Dataset {args.dataset_number} → {global_dataset_id}")
        else:
            print(f"  WARNING: Dataset {args.dataset_number} not found. Use --auto-create to create it.")

    # Track per-dataset aggregates for dataset updates
    dataset_aggregates: dict[str, dict] = {}

    # Cache of dataset_number → dataset_id
    dataset_cache: dict[int, str] = {}
    if global_dataset_id and args.dataset_number:
        dataset_cache[args.dataset_number] = global_dataset_id

    # Process totals
    total_stats = {"created": 0, "updated": 0, "skipped": 0, "errors": 0, "volumes": 0}

    for volume in volumes:
        # Determine dataset for this volume
        dataset_id = global_dataset_id

        if not dataset_id and args.auto_create and supabase:
            # Derive dataset number from volume number
            vol_num = extract_volume_number(volume["stem"])
            if vol_num is not None:
                if vol_num in dataset_cache:
                    dataset_id = dataset_cache[vol_num]
                else:
                    # Check if dataset already exists
                    ds_check = (
                        supabase.table("datasets")
                        .select("id")
                        .eq("number", vol_num)
                        .execute()
                    )
                    if ds_check.data:
                        dataset_id = ds_check.data[0]["id"]
                        print(f"  {volume['stem']} → existing Dataset {vol_num}")
                    else:
                        dataset_id = auto_create_dataset(supabase, vol_num, volume["stem"])
                        print(f"  {volume['stem']} → created Dataset {vol_num}")
                    dataset_cache[vol_num] = dataset_id

        result = process_volume(volume, supabase, dataset_id, args.dry_run)

        # Accumulate totals
        for key in ("created", "updated", "skipped", "errors"):
            total_stats[key] += result["stats"][key]
        total_stats["volumes"] += 1

        # Aggregate per-dataset stats for later dataset update
        if dataset_id and not args.dry_run:
            analysis = result["analysis"]
            if dataset_id not in dataset_aggregates:
                dataset_aggregates[dataset_id] = {
                    "bates_range_start": analysis["bates_range_start"],
                    "bates_range_end": analysis["bates_range_end"],
                    "total_files": 0,
                    "total_pages": 0,
                    "notes_parts": [],
                    "volume_labels": [],
                }
            agg = dataset_aggregates[dataset_id]

            # Extend bates range (take earliest start, latest end by numeric comparison)
            if analysis["bates_range_start"]:
                cur_start_num = int(re.sub(r"[^\d]", "", agg["bates_range_start"] or "0") or "0")
                new_start_num = int(re.sub(r"[^\d]", "", analysis["bates_range_start"]) or "0")
                if cur_start_num == 0 or new_start_num < cur_start_num:
                    agg["bates_range_start"] = analysis["bates_range_start"]

            if analysis["bates_range_end"]:
                cur_end_num = int(re.sub(r"[^\d]", "", agg["bates_range_end"] or "0") or "0")
                new_end_num = int(re.sub(r"[^\d]", "", analysis["bates_range_end"]) or "0")
                if new_end_num > cur_end_num:
                    agg["bates_range_end"] = analysis["bates_range_end"]

            agg["total_files"] += analysis["total_documents"]
            agg["total_pages"] += analysis["total_pages"]
            agg["volume_labels"].append(analysis["volume_label"] or volume["stem"])
            agg["notes_parts"].append(
                f"{volume['stem']}: {analysis['total_documents']} docs, {analysis['total_pages']} pages, "
                f"{analysis['metadata_completeness']:.0%} metadata ({analysis['metadata_status']})"
                + (f", {len(analysis['forensic_flags'])} flags" if analysis["forensic_flags"] else "")
            )

    # Update dataset records with aggregated stats
    if dataset_aggregates and supabase:
        print(f"\n{'━' * 60}")
        print("  UPDATING DATASETS")
        print(f"{'━' * 60}")
        for ds_id, agg in dataset_aggregates.items():
            notes_text = "Load file analysis:\n" + "\n".join(f"  {n}" for n in agg["notes_parts"])
            supabase.table("datasets").update({
                "bates_range_start": agg["bates_range_start"],
                "bates_range_end": agg["bates_range_end"],
                "total_files": agg["total_files"],
                "total_pages": agg["total_pages"],
                "notes": notes_text,
            }).eq("id", ds_id).execute()
            print(f"  Dataset {ds_id}:")
            print(f"    Files: {agg['total_files']}, Pages: {agg['total_pages']}")
            print(f"    Bates: {agg['bates_range_start']} → {agg['bates_range_end']}")
            print(f"    Volumes: {', '.join(agg['volume_labels'])}")

    # Final summary
    print(f"\n{'━' * 60}")
    print("  SUMMARY")
    print(f"{'━' * 60}")
    print(f"  Volumes processed: {total_stats['volumes']}")
    print(f"  Documents created: {total_stats['created']}")
    print(f"  Documents updated: {total_stats['updated']}")
    print(f"  Documents skipped: {total_stats['skipped']}")
    if total_stats["errors"] > 0:
        print(f"  Errors:            {total_stats['errors']}")
    if args.dry_run:
        print("\n  DRY RUN — no database changes made.")
    print()


if __name__ == "__main__":
    main()
