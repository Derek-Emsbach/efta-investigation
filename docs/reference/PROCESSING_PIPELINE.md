# Document Processing Pipeline

## Overview

Every document uploaded to the platform flows through an automated processing pipeline. The pipeline extracts metadata, text, entity references, redaction patterns, and cross-references, then scores the document for investigative value and determines whether it needs human review.

The pipeline is implemented as a **Python worker** (`services/worker/`) that polls the `processing_queue` table and processes documents through up to 8 stages. The worker communicates exclusively through Supabase — it reads queue items, downloads files from R2, and writes results back to the database.

---

## Architecture

```
Browser                        Supabase                     Worker
  │                              │                            │
  ├─ Upload file ──────────────> │ documents row created       │
  │  (presigned URL → R2)        │ processing_queue row created│
  │                              │                            │
  │                              │ <── poll every 5s ─────────┤
  │                              │     claim_next_queued()     │
  │                              │                            │
  │                              │     ┌─ Stage 1: Ingest     │
  │                              │     ├─ Stage 2: Forensics  │
  │                              │     ├─ Stage 3: Extract    │
  │                              │     │  (Tier B gate)       │
  │                              │     ├─ Stage 4: Entities   │
  │                              │     ├─ Stage 5: Redactions │
  │                              │     ├─ Stage 6: Cross-Ref  │
  │                              │     ├─ Stage 7: Classify   │
  │                              │     └─ Stage 8: Diff       │
  │                              │                            │
  │                              │ <── update results ────────┤
  │  Processing dashboard ──────>│    (current_step, results)  │
  │  (polls every 5s)            │                            │
```

### Key design decisions

- **No direct communication** between the web app and worker. They share only the database. This means you can restart, scale, or replace the worker without touching the web app.
- **Atomic queue claiming** via PostgreSQL RPC (`FOR UPDATE SKIP LOCKED`). Multiple workers can run safely in parallel.
- **Presigned URL uploads** — the browser uploads directly to R2. The worker downloads from R2 using boto3. The web app never handles file bytes.

---

## Worker Configuration

The worker reads from `services/worker/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key    # Bypasses RLS

R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=efta-documents

POLL_INTERVAL=5                               # Seconds between polls (default: 5)
```

### Starting the worker

```bash
cd services/worker
pip install -r requirements.txt
python3 main.py
```

The worker prints a `.` for each empty poll cycle and logs each document as it processes.

### Running multiple workers

You can run multiple worker instances in separate terminals:

```bash
# Terminal 1                    # Terminal 2                    # Terminal 3
python3 main.py                 python3 main.py                 python3 main.py
```

Each worker atomically claims one job at a time using the `claim_next_queued()` PostgreSQL function. The function uses `FOR UPDATE SKIP LOCKED`, which means:
- If Worker A grabs document 1, Worker B skips it and grabs document 2
- No two workers ever process the same document
- No race conditions, no duplicate work

**Recommended**: 3-6 concurrent workers. Beyond that, database connection overhead and R2 download contention outweigh the parallelism benefit.

### Atomic Queue Claiming

The `claim_next_queued()` PostgreSQL function (run this in the Supabase SQL Editor):

```sql
CREATE OR REPLACE FUNCTION claim_next_queued()
RETURNS SETOF processing_queue
LANGUAGE plpgsql
AS $$
DECLARE
  claimed processing_queue;
BEGIN
  SELECT * INTO claimed
  FROM processing_queue
  WHERE status = 'queued'
  ORDER BY priority ASC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE processing_queue
  SET status = 'processing', started_at = now()
  WHERE id = claimed.id;

  claimed.status := 'processing';
  claimed.started_at := now();
  RETURN NEXT claimed;
END;
$$;
```

If this function doesn't exist, the worker falls back to a two-step fetch-then-lock approach (works but is race-prone with multiple workers).

---

## Pipeline Stages

### Tier A: Always Run (Stages 1-3)

Every document goes through these three stages regardless of content.

---

### Stage 1: Ingest

**File**: `services/worker/stages/ingest.py`

**What it does**:
1. Downloads the PDF from R2 (with retry logic — the file may still be uploading via presigned URL)
2. Opens with PyMuPDF, counts pages
3. Generates a JPEG thumbnail of the first page at 150 DPI
4. Uploads thumbnail to R2 at `thumbnails/{document_id}.jpg`
5. Updates the document record: `page_count`, `file_size_bytes`, `thumbnail_url`

**Retry logic**: If the file isn't in R2 yet (presigned upload still in progress), the worker retries with exponential backoff — 2s, 4s, 8s, 16s, 32s — up to 5 attempts.

**Output**: `{ page_count, file_size_bytes, thumbnail_generated }`

---

### Stage 2: Forensic Analysis

**File**: `services/worker/stages/forensics.py`

**What it does**:
1. Reads the raw PDF binary to detect the PDF version (`%PDF-1.5`)
2. Counts `%%EOF` markers (Standard pipeline = 2, Alternate = 3)
3. Extracts metadata fields: CreationDate, ModDate, Creator, Producer
4. Detects which DOJ processing pipeline produced the document:
   - **Standard**: PDF 1.5, metadata stripped, 2 EOF markers → multi-page emails/memos
   - **Alternate**: PDF 1.3, CreationDate retained, 3 EOF markers → single-page photos
   - **Unknown**: anything else (potentially anomalous)
5. Catalogs fonts used across the first 10 pages
6. Checks for special features: XMP metadata, JavaScript, forms, embedded files
7. Records page dimensions

**Output**: Populates the document's `forensic_metadata` JSONB field:
```json
{
  "pdf_version": "1.5",
  "pipeline": "standard",
  "metadata_status": "stripped",
  "eof_markers": 2,
  "permissions": -4,
  "fonts": ["Helvetica", "Helvetica-Bold", "Times-Roman"],
  "page_sizes": ["612x792"],
  "has_xmp": false,
  "has_javascript": false,
  "has_forms": false,
  "has_embedded_files": false,
  "creation_date": null,
  "mod_date": null,
  "creator": null,
  "producer": null
}
```

**Two-pipeline baseline** (from DS12 forensic analysis):

| Attribute | Standard | Alternate |
|---|---|---|
| PDF Version | 1.5 | 1.3 |
| Metadata | Fully stripped | CreationDate retained |
| EOF Markers | 2 | 3 |
| Content | Multi-page emails, memos | Single-page photos |
| Fonts | Helvetica + Bold + Times-Roman/Arial/Courier | Helvetica + Bold only |

Documents deviating from both patterns should be investigated.

---

### Stage 3: Text Extraction

**File**: `services/worker/stages/extract.py`

**What it does**:
1. Extracts text from every page using PyMuPDF
2. Flags pages with < 50 characters as `needs_ocr`
3. Detects **document type** from content patterns:
   - `fbi_302` — contains "FEDERAL BUREAU OF INVESTIGATION" or "FD-302"
   - `email` — has From/To/Subject/Date headers (2+ matches)
   - `prosecution_memo` — contains "prosecution memo" or "prosecutive memo"
   - `court_filing` — contains "United States District Court" or "Case No."
   - `financial` — contains 3+ dollar amounts (`$X,XXX.XX`)
   - `legal_report` — contains "memorandum" or "privileged"
   - `senate_letter` — contains "United States Senate" or "Congress"
   - `photo` — less than 50 characters total
   - `blank` — zero characters
4. Detects **document date** from text (first 5000 chars), supporting formats:
   - `January 15, 2005` / `01/15/2005` / `2005-01-15` / `15 Jan 2005`
5. Updates: `extracted_text`, `document_type`, `original_date`, `flags`

**Output**: `{ total_chars, page_count, low_text_pages, document_type, document_date, flags }`

---

### Tier B Gate

After Stage 3, the worker decides whether to run the advanced stages (4-7). The document **skips** to `needs_review` if ALL of these are true:
- 3 or fewer pages
- Document type is `photo` or `blank`
- Less than 500 characters of extracted text

Otherwise, stages 4-7 run. This prevents wasting processing time on single-page photos or blank separator pages.

```python
def should_run_advanced(document, extract_results):
    if page_count > 3: return True
    if doc_type not in ("photo", "blank"): return True
    if total_chars > 500: return True
    return False
```

---

### Stage 4: Entity Extraction

**File**: `services/worker/stages/entities.py`

**What it does**: Matches the document's extracted text against every entity in the database (names + aliases). Uses a two-pass approach:

**Pass 1 — Exact regex matching**:
1. Builds regex patterns for all entity names and aliases, sorted longest-first (so "Jeffrey Epstein" matches before "Epstein")
2. Runs each pattern against the original text
3. Also runs against **whitespace-normalized** text to catch OCR artifacts like "T rump" → "Trump" or "Ep stein" → "Epstein"

**Pass 2 — Fuzzy matching**:
1. For entities not found in Pass 1, tries fuzzy matching using `SequenceMatcher`
2. Uses a sliding window of N tokens (matching the word count of the entity name)
3. Dynamic similarity threshold based on name length:
   - 5 chars or less: 90% similarity required
   - 6-10 chars: 85%
   - 11+ chars: 80%
4. Only fuzzy-matches primary names (not aliases) to avoid false positives on short common words
5. Fuzzy matches are annotated in the excerpt: `[fuzzy: "Dershowits"]`

**For each match**:
- Estimates which page the match falls on
- Extracts a ~200 char context excerpt
- Detects role: `author` (From: header, signed by), `recipient` (To:/Cc:), `subject` (first entity in FBI 302s), or `mentioned`
- Creates an `entity_documents` junction record (upsert to handle re-runs)

**Also detects**: FBI case numbers (`50D-NY-3027571`) and court case numbers.

**Output**: `{ entities_found, entity_ids, high_tier_entities, fuzzy_matches, case_numbers }`

---

### Stage 5: Redaction Detection

**File**: `services/worker/stages/redactions.py`

**What it does**: Analyzes the PDF for redacted regions and classifies them.

**Detection methods**:
1. **Filled black rectangles** in PDF drawings (area > 100 square points)
2. **Redact annotations** (PDF annotation type 12)

**Per page with redactions**:
1. Calculates coverage percentage (redacted area / page area)
2. Extracts text near the largest redacted rectangle (50pt margin)
3. Classifies the redaction using keyword analysis of surrounding text:

| Category | Keywords | Interpretation |
|---|---|---|
| **A** (Victim) | minor, victim, age, school, recruit, girl, child, massage, underage | Generally appropriate |
| **B** (Legal) | privilege, attorney, counsel, work product, confidential, legal | Context-dependent |
| **C** (Institutional) | doj, fbi, department, office, bureau, decision, policy, prosecut | Often suspect |
| **D** (Perpetrator) | payment, wire, transfer, account, trust, fund, flight, travel, passport | Suspect |

**Special rules**:
- If a Tier 1-2 entity name appears near a redaction → automatically Category D + `is_suspect = true`
- Category C with decision/prosecution language → `decision_text_redacted` red flag
- Category D → always `is_suspect = true`

**Redaction levels** (average across all pages):
- `none` (0%), `low` (≤10%), `moderate` (≤30%), `heavy` (≤60%), `very_heavy` (>60%)

**Document flags added**: `redacted`, `heavy_redaction`, `suspect_redaction`, `near_high_tier_entity`, `decision_text_redacted`, `perpetrator_context`

**Output**: `{ total_pages_with_redactions, overall_level, avg_redaction_pct, categories, is_suspect }`

---

### Stage 6: Cross-Reference

**File**: `services/worker/stages/crossref.py`

**What it does**: Finds relationships between this document and the existing corpus.

**Three analysis passes**:

1. **Entity co-occurrence**: Finds other documents that share entities with this one. Ranks by number of shared entities. Returns top 10 related documents.

2. **Timeline matching**: If the document has an `original_date`, finds all events within ±30 days. Links the document to matching timeline entries.

3. **Text similarity (duplicate detection)**: Compares the first 500 characters against all other documents in the same dataset using character 4-gram Jaccard similarity. Documents with ≥80% similarity are flagged as possible duplicates.

**Output**: `{ related_docs, timeline_matches, possible_duplicates, crossref: { related_documents, timeline_matches, possible_duplicates } }`

---

### Stage 7: Classification

**File**: `services/worker/stages/classify.py`

**What it does**: Computes an evidence value score and determines the document's investigative importance.

#### Scoring Formula (0-100)

| Factor | Points | Condition |
|---|---|---|
| Document type | +20 | FBI 302 or prosecution memo |
| Document type | +10 | Email, court filing, legal report, financial |
| Entity count | +5 per entity | Up to 25 max |
| High-tier entities | +15 per Tier 1-2 entity | Up to 30 max |
| Redaction level | +10/+20/+25 | moderate / heavy / very_heavy |
| Suspect redaction | +15 | Category C or D detected |
| Related documents | +5 per related doc | Up to 15 max |
| Timeline matches | +10 | Any timeline event matched |
| Text volume | +5 | More than 5000 characters |
| **Maximum** | **100** | |

#### Classification mapping

| Score | Classification |
|---|---|
| 70-100 | `high` |
| 40-69 | `medium` |
| 0-39 | `low` |

#### Severity mapping

| Score | Additional Condition | Severity |
|---|---|---|
| 85+ | AND (has Tier 1-2 entity OR suspect redaction) | `extreme_critical` |
| 70+ | — | `critical` |
| 40+ | — | `high` |
| 0-39 | — | `routine` |

#### Priority (1-10, lower = more urgent)

```
priority = max(1, 10 - score // 10)
```

A score of 85 → priority 2. A score of 15 → priority 9.

#### Needs Review?

A document is flagged for human review (`needs_review`) if ANY of:
- Priority ≤ 5
- Has a Tier 1-2 entity
- Severity is `extreme_critical` or `critical`
- Has a suspect redaction (Category C/D)
- Has a timeline match

Documents that don't trigger any of these criteria are set to `extracted` (auto-approved as routine).

**Output**: `{ score, classification, severity, priority, needs_review, review_reasons, reasons }`

---

### Stage 8: Version Diff (Conditional)

**File**: `services/worker/stages/diff.py`

**When it runs**: Only for re-uploaded or re-processed documents (when `is_reprocess = true` and `previous_version_id` exists on the queue item).

**What it does**: Compares the current processing results against the **previous version snapshot** stored in `document_versions`.

**Diff computed**:

1. **Redaction changes**: Per-category (A/B/C/D) count comparison. Redaction *decreases* are significant — they mean content that was previously censored is now visible.

2. **Entity changes**: Which entity links were added or removed between versions.

3. **Classification / severity changes**: Did the document become more or less important?

4. **Text length change**: Proxy for whether the content substantially changed.

**Significant findings** (automatically flagged):

| Finding | Trigger | Severity |
|---|---|---|
| `redaction_decrease` | Total redacted pages decreased | high |
| `category_redaction_decrease` (Cat C) | Institutional redactions removed | critical |
| `category_redaction_decrease` (Cat D) | Perpetrator protection redactions removed | critical |
| `new_entities_found` | New entity links in re-processed version | medium |

**Document flags added**: `redaction_decrease`, `unredacted_names`

The diff results are stored in `forensic_metadata.version_diff` and displayed as alert cards on the document detail page. Re-processed documents always go to `needs_review` so the reviewer can see the diff.

---

## Processing Status Flow

```
queued ─→ processing ─→ extracted ─→ needs_review ─→ reviewed
              │              │
              │              └─→ (auto-approved routine docs stay at 'extracted')
              │
              └─→ failed (with error_message, retryable)
```

| Status | Meaning |
|---|---|
| `queued` | Waiting for a worker to pick it up |
| `processing` | Worker has claimed it, stages running |
| `extracted` | Pipeline complete, auto-approved (low value) |
| `needs_review` | Pipeline complete, flagged for human review |
| `reviewed` | Human approved via review page |
| `failed` | Stage threw an error (message stored, can retry) |
| `published` | Ready for public access (future feature) |

---

## Upload → Processing Flow

### New document upload

1. Browser sends file metadata to `POST /api/upload/presign`
2. Server creates `documents` row (status: `queued`) + `processing_queue` row (priority: 5)
3. Server returns a presigned R2 URL
4. Browser uploads PDF directly to R2 via PUT
5. Browser calls `POST /api/upload/confirm` to verify R2 receipt
6. Worker picks up the queue item and runs stages 1-8

### Re-upload (same bates number)

1. Presign route detects bates number conflict (PostgreSQL error `23505`)
2. Creates a **version snapshot** in `document_versions`:
   - Copies: file_url, page_count, extracted_text, document_type, classification, severity, flags, review_notes, etc.
   - Aggregates: redaction summary, entity IDs, processing results
3. **Deletes** pipeline-generated data: `entity_documents` and `redactions` rows
4. **Updates** the document record: new file_url, reset processing fields, increment `current_version`
5. **Preserves**: classification, severity, review_notes, reviewed_by, dataset_id
6. Creates `processing_queue` entry with `is_reprocess = true`, `previous_version_id = snapshot.id`, priority 3 (higher than new uploads)
7. Worker processes all stages + Stage 8 (diff)

### Re-process (no new PDF)

1. `POST /api/documents/[id]/reprocess` is called
2. Same snapshot/cleanup/re-queue flow as re-upload, but `trigger = 'reprocess'` and file_url stays the same
3. Worker re-runs all stages against the existing PDF in R2

---

## Queue Priority

| Priority | Meaning | When assigned |
|---|---|---|
| 1 | Most urgent | Score 90-100 |
| 2 | Very high | Score 80-89 |
| 3 | High (re-uploads) | Re-uploaded documents |
| 5 | Normal | New uploads (default) |
| 9-10 | Low | Low-scoring routine docs |

Workers process the lowest priority number first (most urgent first), with ties broken by `created_at` (oldest first).

---

## Error Handling

If any stage throws an exception:
- The queue item is marked `failed` with the error message
- The document's `processing_status` is set to `failed`
- The full traceback is printed to the worker's stdout
- The worker continues polling for the next document

Failed documents can be re-queued via the re-process API or by uploading the PDF again.

---

## Monitoring

### Processing dashboard (`/processing`)

The web app's processing page polls `GET /api/processing` every 5 seconds and displays:
- Summary stats: queued / processing / completed / failed / needs_review
- Queue table with status badges, current step, priority, timestamps
- Filter by status
- Click any row to navigate to the document detail

### Worker stdout

The worker logs to stdout:
```
============================================================
EFTA Document Processing Worker
Poll interval: 5s
Stages: 1-3 (all docs) + 4-7 (Tier B gated)
============================================================

....
Processing: EFTA02731623
  Stage 1: Ingest — documents/EFTA02731623.pdf
  Stage 2: Forensics
  Stage 3: Text Extraction
  Stage 4: Entity Extraction
    Found 7 entities
  Stage 5: Redaction Detection
    Level: moderate
  Stage 6: Cross-Reference
    Related: 3 docs, 2 events
  Stage 7: Classification
  Done — score=72, severity=critical, status=needs_review
..
Processing: EFTA02731624
  Stage 1: Ingest — documents/EFTA02731624.pdf
  Stage 2: Forensics
  Stage 3: Text Extraction
  Done (basic) — skipped advanced stages, ready for review
```

Each `.` represents an empty poll cycle (no queued documents).

---

## File Reference

| File | Purpose |
|---|---|
| `services/worker/main.py` | Main polling loop + stage orchestration |
| `services/worker/config.py` | Environment variable loading |
| `services/worker/db.py` | Supabase client + all database operations |
| `services/worker/storage.py` | R2/S3 download/upload/exists operations |
| `services/worker/stages/ingest.py` | Stage 1: Download, page count, thumbnail |
| `services/worker/stages/forensics.py` | Stage 2: PDF structure analysis |
| `services/worker/stages/extract.py` | Stage 3: Text extraction + type/date detection |
| `services/worker/stages/entities.py` | Stage 4: Entity matching (exact + fuzzy) |
| `services/worker/stages/redactions.py` | Stage 5: Redaction detection + A-D classification |
| `services/worker/stages/crossref.py` | Stage 6: Entity co-occurrence + timeline + duplicates |
| `services/worker/stages/classify.py` | Stage 7: Scoring + severity + review gating |
| `services/worker/stages/diff.py` | Stage 8: Version diff for re-processed docs |
