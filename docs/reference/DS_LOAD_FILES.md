# eDiscovery Load File (DAT/OPT) Reference

## Overview

The DOJ releases EFTA documents in standard eDiscovery production format: folders containing PDFs plus `.DAT` and `.OPT` load files. These load files are the production manifest — they tell us what documents exist, how pages map to documents, and what metadata the DOJ chose to include (or strip).

We parse these files with `scripts/load_file_parser.py` to create document records in Supabase. PDFs are uploaded separately through the existing presigned URL pipeline.

---

## What Are DAT and OPT Files?

### `.DAT` (Concordance Load File)
- Delimited text file mapping document metadata fields
- Standard delimiter: `þ` (thorn character, `\xfe`) as field separator, `®` (registered sign, `\xae`) as text qualifier
- Alternative: Some DOJ productions use `\x14` (ASCII 20) as delimiter
- First row is the header with field names
- **Critical finding from DS12**: The DOJ's DAT files are severely stripped — only ~2 metadata fields (Bates number ranges) instead of the standard 20-30 fields you'd expect from a normal eDiscovery production. This is itself a forensic finding (RF-FORENSIC-4: metadata suppression).

### `.OPT` (Opticon/Image Load File)
- Maps individual page images to their parent documents
- Format: comma-separated, no header row
- Fields: `BatesNumber,VolumeLabel,ImagePath,DocumentBreak,FolderBreak,PageCount`
- `DocumentBreak` field: `Y` = first page of a new document, empty = continuation page
- This tells us which pages belong to which EFTA document and how many pages each has

### Standard eDiscovery DAT Fields (What We Should Expect)

A properly produced eDiscovery DAT would have fields like:
```
BEGBATES, ENDBATES, BEGATTACH, ENDATTACH, CUSTODIAN, DOCTYPE,
DATECREATED, DATEMODIFIED, DATESENT, AUTHOR, FROM, TO, CC, BCC,
SUBJECT, FILEPATH, FILENAME, FILEEXT, NUMPAGES, CONFIDENTIALITY,
REDACTION_BASIS, PRODUCTION_VOLUME
```

**The DOJ stripped almost all of these.** The parser tracks what fields ARE present vs what's missing — the gap itself is evidence of metadata suppression.

---

## Parser Script

### Location

```
scripts/load_file_parser.py
```

Uses the same `supabase-py` client pattern as the worker (`services/worker/db.py`), connecting with the service role key to bypass RLS.

### Usage

```bash
# From the scripts/ directory
python load_file_parser.py /path/to/volume/folder [--dataset-id UUID] [--dry-run]

# Examples:
python load_file_parser.py ~/datasets/VOL00011 --dry-run
python load_file_parser.py ~/datasets/VOL00011 --dataset-id 550e8400-e29b-41d4-a716-446655440000
```

### Input Folder Structure

The script looks for DAT and OPT files in the provided directory:
```
VOL00011/
  VOL00011.DAT       # Document metadata manifest
  VOL00011.OPT       # Page-to-document mapping
  IMAGES/             # (optional — PDFs, not used by the parser)
```

The script auto-discovers `.DAT` and `.OPT` files by extension. The folder name or volume label doesn't need to match.

### What It Does

1. **Parse DAT** → extract document metadata records (bates numbers, any available fields)
2. **Parse OPT** → map pages to documents, compute page counts per document
3. **Forensic analysis** → compare present vs expected fields, detect Bates gaps, generate flags
4. **Upsert documents** → create or update records in `documents` table (matched by `bates_number`)
5. **Update dataset** → set Bates range, file/page counts on the `datasets` row

### Dry-Run Mode

`--dry-run` parses files and prints the analysis report without touching the database. Always run this first when importing a new volume.

---

## Database Integration

### Documents Table Mapping

The parser creates/updates rows in the existing `documents` table. No new tables or columns needed.

```sql
-- For each DAT record, upsert a document:
INSERT INTO documents (
  bates_number,         -- from BEGBATES field in DAT
  dataset_id,           -- from --dataset-id CLI argument
  title,                -- from SUBJECT if present, else bates_number
  page_count,           -- computed from OPT (count pages per DocumentBreak)
  processing_status,    -- 'queued' for new records
  forensic_metadata     -- JSONB: load file analysis, volume info
) VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (bates_number) DO UPDATE SET
  page_count = EXCLUDED.page_count,
  forensic_metadata = documents.forensic_metadata || EXCLUDED.forensic_metadata,
  updated_at = now();
```

### Column Mapping

| Load File Field | Documents Column | Notes |
|---|---|---|
| BEGBATES | `bates_number` | Unique constraint — triggers upsert |
| (computed from OPT) | `page_count` | Count pages between DocumentBreak markers |
| SUBJECT (if present) | `title` | Usually stripped by DOJ |
| --dataset-id arg | `dataset_id` | Links to datasets table |
| — | `processing_status` | Set to `'queued'` for new records |
| — | `file_url` | NULL until PDF is uploaded via presigned URL flow |

### forensic_metadata JSONB

Load file analysis is stored in `forensic_metadata`, which is already populated by Stage 2 (forensics.py) when a PDF is processed. The parser **merges** its data — it does not overwrite existing forensic analysis.

```json
{
  "source_volume": "VOL00011",
  "metadata_status": "stripped",
  "loadfile_analysis": {
    "dat_fields_present": ["BEGBATES", "ENDBATES"],
    "dat_fields_missing": ["CUSTODIAN", "DOCTYPE", "DATECREATED", "..."],
    "metadata_completeness": 0.09,
    "bates_gaps": [
      { "after": "EFTA02730500", "before": "EFTA02730510", "missing_count": 9 }
    ],
    "forensic_flags": ["RF-FORENSIC-4: Severe metadata suppression in load files"]
  }
}
```

> **Note**: The `forensic_metadata.pipeline` field (standard/alternate/unknown) is set separately by the Stage 2 forensics worker when a PDF is processed. The load file parser does not touch that field.

### Datasets Table Update

The parser also updates the corresponding `datasets` row:

| Datasets Column | Value Source |
|---|---|
| `bates_range_start` | First bates number in OPT |
| `bates_range_end` | Last bates number in OPT |
| `total_files` | Count of documents (DAT records or OPT DocumentBreak=Y) |
| `total_pages` | Total OPT records (one per page) |
| `notes` | Load file forensic analysis summary (text) |

---

## Forensic Analysis

After parsing, the script automatically analyzes what the DOJ provided vs. what they should have.

### Expected Fields

```python
EXPECTED_EDISCOVERY_FIELDS = [
    "BEGBATES", "ENDBATES", "BEGATTACH", "ENDATTACH",
    "CUSTODIAN", "DOCTYPE", "DATECREATED", "DATEMODIFIED",
    "DATESENT", "AUTHOR", "FROM", "TO", "CC", "BCC",
    "SUBJECT", "FILEPATH", "FILENAME", "FILEEXT",
    "NUMPAGES", "CONFIDENTIALITY", "REDACTION_BASIS",
    "PRODUCTION_VOLUME",
]
```

### Metadata Completeness Score

```
completeness = fields_present / len(EXPECTED_EDISCOVERY_FIELDS)
```

- **< 30%**: `stripped` — RF-FORENSIC-4 flag triggered
- **30-80%**: `partial`
- **> 80%**: `present`

### Bates Gap Detection

The parser extracts numeric portions from Bates numbers, sorts them, and checks for gaps. A gap means documents in that range were withheld from the production.

```
EFTA02730265 → 2730265
EFTA02730266 → 2730266
EFTA02730268 → 2730268  ← gap: EFTA02730267 missing
```

Gaps are stored in `forensic_metadata.loadfile_analysis.bates_gaps`.

### Anomaly Detection

If a new volume suddenly has MORE DAT fields than previous volumes, that's notable — it suggests inconsistent redaction/stripping practices across the DOJ production team. The parser logs this.

---

## How Load Files Relate to the Processing Pipeline

```
Load File Parser                    Existing Upload + Processing Pipeline
─────────────────                   ─────────────────────────────────────
1. Parse DAT/OPT                    1. User uploads PDF via web UI
2. Create document records          2. Presign route creates document record
   (bates_number, page_count,       3. Browser uploads to R2
    forensic_metadata, dataset_id)   4. Confirm route verifies R2 receipt
3. Update dataset metadata          5. Worker runs 8 processing stages
                                    6. Document goes to review queue
         │
         └─── Records matched by bates_number ───┘
```

The load file parser runs **before or alongside** the upload pipeline:
- If a document **already exists** (uploaded via web UI), the parser updates it with OPT page counts and load file analysis
- If a document **doesn't exist yet**, the parser creates a placeholder. When the PDF is later uploaded, the presign route detects the existing `bates_number` and handles it as a re-upload (versioning + re-queue)

This means you can import load files first (to get the full manifest), then upload the PDFs in batches. Or upload PDFs first, then run the parser to enrich records with production metadata.

---

## Important Notes

- The thorn (`þ`) and registered (`®`) delimiters are specific to Concordance load file format — the standard in federal eDiscovery productions
- VOL numbers correspond to production volumes. Each volume is a batch of documents.
- The EFTA number IS the Bates number — they are the same thing (e.g., EFTA02730265)
- Page counts from OPT should match what PyMuPDF finds when the PDF is processed (Stage 1). Discrepancies are a red flag and get flagged.
- Some volumes might use slightly different DAT delimiters or field names — the parser auto-detects both common formats
- If a new volume has MORE fields than DS12, that's notable and gets logged as an anomaly

---

## Testing

Test with the VOL00011 files from Dataset 12:

```bash
# Dry run first
python load_file_parser.py ~/datasets/VOL00011 --dry-run

# Then import
python load_file_parser.py ~/datasets/VOL00011 --dataset-id <ds12-uuid>
```

After running:
1. Verify Bates numbers match known DS12 range (EFTA02730265 – EFTA02731744)
2. Check page counts against OPT data
3. Confirm forensic analysis correctly identifies stripped metadata fields
4. Verify document records in Supabase have correct `bates_number`, `page_count`, `forensic_metadata`
5. Verify dataset record has updated `bates_range_start`, `bates_range_end`, `total_files`, `total_pages`

---

## Reference

| Doc | Read for |
|-----|----------|
| `packages/db/schema.sql` | Full table definitions |
| `docs/reference/DATABASE_SCHEMA.md` | Schema docs and relationships |
| `docs/reference/PROCESSING_PIPELINE.md` | How documents flow through the worker |
| `services/worker/db.py` | Supabase client pattern (service role key) |
| `services/worker/stages/forensics.py` | Stage 2 — PDF forensic analysis (populates `forensic_metadata`) |
