# EFTA MCP Server — Codebase Audit Report

**Date**: 2026-02-24
**Tool count**: 58 (12 modules)
**Source files**: 16 TypeScript files in `src/`, 4 seed scripts
**Data files**: 2 SQLite DBs (~7.3 GB), 1 persons registry JSON (388 KB)

---

## Summary

The MCP server is structurally sound. All 12 tool modules are imported and registered. The dual-source architecture (Supabase + SQLite corpus) is clearly separated with proper graceful degradation. Two functional bugs were found, one of which is critical (C1). Several cleanup items are documented below.

---

## Critical (breaks functionality)

### C1. `nearby_entities` column does not exist on `redactions` table

**File**: `src/tools/redactions.ts:53,59`

The `create_redaction_record` tool accepts a `nearby_entities` parameter and passes it directly to `sb.from('redactions').insert(params)`. The `redactions` table has no `nearby_entities` column. Calling this tool with the parameter will cause a PostgreSQL column-not-found error at runtime.

**Fix**: Either add `nearby_entities TEXT[]` column to `redactions` via migration, or remove the parameter from the Zod schema and destructure it out before insert.

---

## Warning (should fix)

### W1. `title` silently dropped in `create_evidence_item`

**File**: `src/tools/redactions.ts:83-106`

The tool accepts `title: z.string()` but the `evidence_items` table has no `title` column. The value is destructured and used only in the success message — never stored. Users think they're saving a title but nothing is persisted.

**Fix**: Either add `title TEXT` column to `evidence_items`, or map `title` → `description` (which does exist).

### W2. Dead export: `getDocumentPdfUrl`

**File**: `src/r2.ts:50`

Exported but never imported anywhere. Generates presigned S3 URLs for PDF files. Could become a tool later but is currently dead code.

### W3. Unused import: `safeJson` in utility.ts

**File**: `src/tools/utility.ts:3`

Imported from `supabase.js` but never directly used in function bodies. All responses go through `toolResponse()` which calls `safeJson` internally.

### W4. `data/` gitignore too broad

**File**: `.gitignore:6`

The rule `data/` excludes the entire directory including `data/README.md` and `data/download.sh`. Anyone cloning the repo has no instructions for obtaining the corpus databases.

**Fix**: Add negation rules: `!data/README.md` and `!data/download.sh`.

### W5. `find_co_locations` silent truncation

**File**: `src/tools/sightings.ts:229`

Hard limit of 100 co-sightings with no truncation warning in the response. If a busy location has >100 co-sightings on a date, the caller has no indication results are incomplete.

### W6. `get_investigation_stats` swallows sub-query failures

**File**: `src/tools/utility.ts:215-324`

10 parallel Supabase queries run concurrently. If any individual query fails (e.g., missing table, RPC timeout), the error is silently dropped and the relevant field is absent from output. No indication to the caller that a failure occurred.

### W7. Stale documentation: tool count

README, MEMORY.md, and recent commit messages reference "34 tools". Actual count is **58 tools** across 12 modules.

---

## Info (nice to know)

### I1. `noUnusedLocals` / `noUnusedParameters` not enabled

**File**: `tsconfig.json`

Adding these flags would surface W2 and W3 automatically at compile time.

### I2. `TABLE_INFO` references non-existent `event_documents` table

**File**: `src/tools/utility.ts:21`

The hardcoded schema metadata lists `event_documents (event_id)` as a relationship on `events`. This table does not exist. The `get_schema` tool will include this misleading reference.

### I3. Explicit `any` types with eslint-disable

**Files**: `suspects.ts:116-125`, `connections.ts:64`

Multiple `any` type suppressions. Harmless at runtime but bypasses TypeScript safety.

### I4. R2 errors indistinguishable from missing files

**File**: `src/r2.ts:38-44`

Both `NoSuchKey` (file doesn't exist) and other errors (network failure, auth expired) return `null`. The `get_document_full_text` tool cannot distinguish "not yet extracted" from "R2 unavailable".

### I5. `@aws-sdk/s3-request-presigner` only used by dead code

**File**: `package.json:13`

This dependency is only used by the dead `getDocumentPdfUrl` function. If that function is removed, this 800KB dependency tree can be dropped.

### I6. Corpus tools vs Supabase tools — naming clarity

`corpus_get_document_text` vs `get_document_full_text` and `search_redactions` vs `corpus_search_redactions` require the caller to understand the two-source architecture. The tool descriptions handle this well with explicit "use X instead of Y for Z" guidance.

### I7. 7.3 GB data directory blocks ephemeral deployment

The SQLite corpus databases require an external volume or `CORPUS_DATA_DIR` env var. Cannot deploy to storage-limited hosts (Railway free tier, Render free tier) without separate volume mounting.

---

## Tool Inventory (58 tools, 12 modules)

| Module | Tools | Count |
|--------|-------|-------|
| `connections.ts` | create_connection, update_connection, delete_connection, find_connections | 4 |
| `corpus.ts` | corpus_search, corpus_get_document_text, corpus_count_entity_mentions, corpus_search_redactions, corpus_resolve_url | 5 |
| `documents.ts` | search_documents, get_document, create_document_record, update_document, get_document_full_text | 5 |
| `entities.ts` | search_entities, get_entity, create_entity, update_entity, delete_entity | 5 |
| `events.ts` | search_events, create_event, update_event, delete_event, link_entity_to_event | 5 |
| `external.ts` | search_research_platforms, get_entity_external_links, search_external_entities, link_external_entity | 4 |
| `links.ts` | link_entity_to_document, batch_link_entities_to_document, unlink_entity_from_document, unlink_entity_from_event | 4 |
| `public-events.ts` | search_public_events, create_public_event, update_public_event, delete_public_event, search_doj_actions, log_doj_action, update_doj_action, delete_doj_action | 8 |
| `redactions.ts` | search_redactions, create_redaction_record, create_evidence_item | 3 |
| `sightings.ts` | create_location, search_entity_locations, add_entity_location, find_co_locations, get_location_timeline, find_entities_at_location | 6 |
| `suspects.ts` | search_suspects, create_suspect, update_suspect, promote_suspect, delete_suspect | 5 |
| `utility.ts` | lookup_person, get_investigation_stats, list_datasets, get_schema | 4 |

**Verified**: No duplicate tool registrations. `link_entity_to_event` is in `events.ts` only; `unlink_entity_from_event` is in `links.ts` only. Tool naming split is logical: `events.ts` handles event CRUD + linking, `links.ts` handles document linking + event unlinking.

---

## Recommended Next Actions

1. **Fix C1** — Remove `nearby_entities` from `create_redaction_record` schema (or add column to DB)
2. **Fix W1** — Map `title` → `description` in `create_evidence_item`, or add column
3. **Update MEMORY.md** — tool count 34 → 58
5. **Enable `noUnusedLocals`** in tsconfig to catch dead code automatically
6. **Fix `.gitignore`** — unignore `data/README.md` and `data/download.sh`
