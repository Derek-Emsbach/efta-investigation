# Plan: Import v5.0 + v5.1 Corpus Databases (MCP-Only)

## Overview

Integrate 4 new SQLite databases from `rhowardstone/Epstein-research-data` v5.0/v5.1 releases into the MCP server as read-only research tools. Update the existing full-text corpus to v5.0 (adds 23 DS12 expansion documents). No Supabase schema changes needed.

## What's New

| Release | Asset | Size | Content |
|---------|-------|------|---------|
| v5.0 | `full_text_corpus.db` (updated) | ~6.3 GB | +23 DS12 expansion docs (EFTA02731790–EFTA02858497, 1,046 pages) |
| v5.1 | `concordance_complete.db` | 729 MB | DOJ production metadata, 1.38M rows (custodians, emails, folder paths) |
| v5.1 | `alteration_results.db` | 557 MB | 212,730 document change units (what DOJ modified between releases) |
| v5.1 | `image_analysis.db` | 762 MB | 92,095 images analyzed by Qwen2-VL vision model |
| v5.1 | `handwriting_transcriptions.db` | 248 KB | 54 handwritten FBI/AUSA pages from 14 MCC inmate witnesses |

## Implementation Steps

### Step 1: Download Script
**File:** `services/efta-mcp-server/data/download.sh`

Create a bash script that:
- Downloads v5.0 corpus parts (`full_text_corpus.db.gz.part_aa` + `part_ab`), concatenates, decompresses
- Downloads v5.1 assets: `concordance_complete.db.gz`, `alteration_results.db.gz`, `image_analysis.db.gz`, `handwriting_transcriptions.db.gz`
- Decompresses all `.gz` files
- Verifies file integrity with row count checks
- Uses `curl -L` with GitHub release URLs
- Idempotent (skips already-downloaded files)

### Step 2: Update `sqlite.ts` — Add 4 New Database Singletons
**File:** `services/efta-mcp-server/src/db/sqlite.ts`

Add lazy-init singletons for:
- `_concordance` → `concordance_complete.db`
- `_alteration` → `alteration_results.db`
- `_imageAnalysis` → `image_analysis.db`
- `_handwriting` → `handwriting_transcriptions.db`

Export: `getConcordanceDb()`, `getAlterationDb()`, `getImageAnalysisDb()`, `getHandwritingDb()`

Same pattern as existing `getCorpusDb()` / `getRedactionDb()`.

### Step 3: Update DS12 Range in `corpus.ts`
**File:** `services/efta-mcp-server/src/tools/corpus.ts`

Update `DATASET_RANGES` for DS12:
```
{ ds: 12, min: 2640993, max: 2858497 }  // was 2731785
```

This ensures `corpus_resolve_url` correctly resolves the 23 new DS12 expansion documents.

### Step 4: New Tool File — `concordance.ts`
**File:** `services/efta-mcp-server/src/tools/concordance.ts`

3 tools:

1. **`concordance_lookup`** — Look up DOJ production metadata for a document by EFTA number. Returns original filename, folder path, author, custodian, dates, email headers.

2. **`concordance_search`** — Search concordance by custodian, author, email sender/recipient, or filename. Useful for mapping document custody chains and identifying who held what documents.

3. **`concordance_email_threads`** — Search email thread metadata (email_from, email_to, email_cc, email_subject) to reconstruct communication patterns.

### Step 5: New Tool File — `alterations.ts`
**File:** `services/efta-mcp-server/src/tools/alterations.ts`

2 tools:

1. **`alteration_lookup`** — Look up all tracked changes for a specific EFTA document. Returns diff types, categories of changes, removed names, LLM classification of sensitivity/justification, and anomaly flags.

2. **`alteration_search`** — Search across all 212K alteration records by diff type, sensitivity level, anomaly flag, or removed names. Critical for identifying which documents the DOJ modified between dataset releases and why.

### Step 6: New Tool File — `image-analysis.ts`
**File:** `services/efta-mcp-server/src/tools/image-analysis.ts`

2 tools:

1. **`image_analysis_lookup`** — Get all analyzed images from a specific EFTA document. Returns vision model descriptions: people identified, text content, objects, settings, activities, and notable observations.

2. **`image_analysis_search`** — FTS5 full-text search across 92K image descriptions. Search by people, objects, settings, or any descriptive text. Extremely valuable for finding photos of specific people, locations, or activities across the entire corpus.

### Step 7: New Tool File — `handwriting.ts`
**File:** `services/efta-mcp-server/src/tools/handwriting.ts`

2 tools:

1. **`handwriting_lookup`** — Get transcriptions for a specific EFTA document. Returns page-level transcripts of handwritten FBI/AUSA notes including subject, interview date, location, redaction count, and unclear markings.

2. **`handwriting_search`** — Search across all 54 transcribed handwritten pages by subject name, location, case number, or transcript content. These are FBI interview notes from 14 MCC inmate witnesses — potentially critical evidence.

### Step 8: Register New Tools
**File:** `services/efta-mcp-server/src/tools/index.ts`

Add imports and registrations for:
- `registerConcordanceTools`
- `registerAlterationTools`
- `registerImageAnalysisTools`
- `registerHandwritingTools`

### Step 9: Update TODO.md
Add a new section under "MCP Server Upgrades" tracking this work.

## New Tool Summary (9 tools)

| Tool | Database | Purpose |
|------|----------|---------|
| `concordance_lookup` | concordance_complete.db | DOJ metadata for a document |
| `concordance_search` | concordance_complete.db | Search by custodian/author/filename |
| `concordance_email_threads` | concordance_complete.db | Email communication patterns |
| `alteration_lookup` | alteration_results.db | What changed in a specific document |
| `alteration_search` | alteration_results.db | Find modified/suspicious documents |
| `image_analysis_lookup` | image_analysis.db | Image descriptions for a document |
| `image_analysis_search` | image_analysis.db | FTS5 search across all image descriptions |
| `handwriting_lookup` | handwriting_transcriptions.db | Transcription for a document |
| `handwriting_search` | handwriting_transcriptions.db | Search handwritten FBI notes |

## Files Changed

| File | Action |
|------|--------|
| `services/efta-mcp-server/data/download.sh` | **CREATE** — download script |
| `services/efta-mcp-server/src/db/sqlite.ts` | **EDIT** — add 4 new DB singletons |
| `services/efta-mcp-server/src/tools/corpus.ts` | **EDIT** — update DS12 range |
| `services/efta-mcp-server/src/tools/concordance.ts` | **CREATE** — 3 concordance tools |
| `services/efta-mcp-server/src/tools/alterations.ts` | **CREATE** — 2 alteration tools |
| `services/efta-mcp-server/src/tools/image-analysis.ts` | **CREATE** — 2 image analysis tools |
| `services/efta-mcp-server/src/tools/handwriting.ts` | **CREATE** — 2 handwriting tools |
| `services/efta-mcp-server/src/tools/index.ts` | **EDIT** — register new tool modules |
| `docs/TODO.md` | **EDIT** — track progress |

## Investigation Value

- **Concordance**: Finally know who authored/custodied every document. Email metadata enables communication network reconstruction without reading full text.
- **Alterations**: The DOJ has been modifying documents between releases. 212K change units let us identify exactly what was removed/changed and flag anomalous alterations.
- **Image Analysis**: 92K images with AI descriptions. Search for photos of specific people, locations, or activities — massive for establishing who was where.
- **Handwriting**: FBI interview notes from 14 MCC inmates — these are firsthand witness accounts that may not exist in any typed form.
- **Corpus Update**: 23 new DS12 documents including FBI case files and grand jury testimony that weren't in the previous release.
