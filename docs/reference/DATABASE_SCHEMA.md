# Database Schema Reference

PostgreSQL via Supabase Pro. Full SQL in `packages/db/schema.sql` (core tables) + `packages/db/migrations/` (003-015c). TypeScript types in `packages/shared/src/types/database.ts`.

## Entity Relationship Diagram

```
datasets 1──────────M documents 1─────M document_versions
                        │
                        ├─M redactions
                        ├─M processing_queue
                        ├─M document_images 1──M image_entities ──M entities
                        │                  └──M image_locations ──M locations
                        M
                        │
    entities M────────M entity_documents
       │                │
       ├─M evidence_items M────1 documents
       ├─M external_sources 1──M external_events
       ├─M entity_sightings ──M locations
       │
       M                M
       │                │
    entity_events    event_documents
       │                │
       M                M
       │                │
    events ─────────────┘
       │
       M
       │
    investigations 1──M investigation_documents
                   ├──M investigation_events
                   ├──M investigation_notes
                   └──M entity_investigations ──M entities

    entities M────────M entity_connections ────────M entities

    stories 1──────────M story_entities ──────M entities
    stories 1──────────M story_citations ─────M documents
    stories M──────────1 case_files (optional FK)

    case_files 1───────M case_file_entities ──M entities
    case_files 1───────M open_questions

    suspect_watchlist (staging table, optional FK to entities)
    external_entities (cross-reference registry, no FK to entities)
    research_platforms (global tool registry, standalone)

    profiles (1:1 with auth.users)
    conversations 1──M conversation_messages
    platform_suggestions (standalone)
    api_usage_log (standalone)
    notification_alerts (standalone)
```

## Table Reference

### Core Tables (in `schema.sql`)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `datasets` | DS1-12 collections | `number` (UNIQUE), `status`, `priority`, `reviewed_count` |
| `investigations` | Case threads | `name` (UNIQUE), `status`, `open_questions` TEXT[] |
| `entities` | Persons, orgs, properties, trusts | `name` (UNIQUE), `tier` (1-6), `entity_type`, `slug` (UNIQUE), `financial_summary` JSONB, `profile_published` BOOLEAN, `search_vector` TSVECTOR, `external_urls` JSONB |
| `documents` | Every ingested file (~1.37M rows) | `bates_number` (UNIQUE), `dataset_id` FK, `severity`, `processing_status`, `forensic_metadata` JSONB, `flags` TEXT[], `current_version`, `search_vector` TSVECTOR |
| `events` | Timeline entries | `date`, `event_type`, `location_id` FK, `investigation_id` FK |
| `locations` | Physical places | `name`, `location_type`, `latitude`/`longitude`, `owner_entity_id` FK |
| `entity_sightings` | Entity at location on date | `entity_id`, `location_id`, `date`, `sighting_type`, `confidence`, `with_entities` UUID[] |

### Junction Tables

| Table | Relationship | Extra Columns |
|-------|-------------|---------------|
| `entity_documents` | entity ↔ document | `role_in_document`, `excerpt`, `page_number` |
| `entity_events` | entity ↔ event | `role` |
| `event_documents` | event ↔ document | — |
| `entity_connections` | entity ↔ entity | `relationship_type`, `evidence_strength`, `strength` (0-100), `source_document_ids` UUID[] |
| `entity_investigations` | entity ↔ investigation | `role` |
| `investigation_documents` | investigation ↔ document | `relevance_notes` |
| `investigation_events` | investigation ↔ event | `relevance_notes` |
| `investigation_notes` | notes on investigation | `note_type`, `content`, `created_by` |

### Evidence & Analysis

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `evidence_items` | Specific evidence pieces | `entity_id` FK, `document_id` FK, `strength` (strong/moderate/weak), `category` |
| `redactions` | Redaction analysis per page | `document_id` FK, `page_number`, `category` (A-D), `is_suspect`, `assessment` |

### Processing Pipeline

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `processing_queue` | Worker job queue | `document_id` FK, `status`, `priority` (1-10), `current_step`, `is_reprocess`, `previous_version_id` |
| `document_versions` | Snapshots before re-processing | `document_id` FK, `version_number`, `trigger` (initial_import/reupload/reprocess) |

### Image Pipeline (Migration 006 + 011)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `document_images` | Extracted images from PDFs | `document_id` FK, `page_number`, `r2_key`, `image_type`, `tags` TEXT[] |
| `image_entities` | Image ↔ entity tagging | `image_id` FK, `entity_id` FK, `role`, `confidence` |
| `image_locations` | Image ↔ location tagging | `image_id` FK, `location_id` FK, `confidence` |

### AI & Conversations (in `schema.sql`)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `conversations` | Detective chat sessions | `user_id`, `title`, `pinned` |
| `conversation_messages` | Messages in conversations | `conversation_id` FK, `role` (user/assistant), `content`, `tool_calls` JSONB |
| `platform_suggestions` | AI-proposed improvements | `category`, `title`, `description`, `status` (proposed/accepted/dismissed/completed) |
| `api_usage_log` | Per-request token tracking | `endpoint`, `model`, `input_tokens`, `output_tokens`, `cache_creation_tokens`, `cache_read_tokens` |
| `notification_alerts` | System notifications | `alert_type`, `severity`, `is_read`, `dismissed` |

### External Integration (Migration 004 + 015)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `external_sources` | Wikipedia, news, court records per entity | `entity_id` FK, `source_type`, `source_url`, `verification_status` |
| `external_events` | Events from external sources | `entity_id` FK, `date`, `source_id` FK |
| `research_platforms` | Global registry of research tools | `name` (UNIQUE), `url`, `source_type`, `person_page_template` |
| `external_entities` | Cross-reference from external registries | `source`, `external_id`, `name`, `entity_id` FK (optional) |

### Auth & Access (Migration 008)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `profiles` | User roles | `id` (FK to `auth.users`), `email`, `role` (admin/viewer) |

### Investigation Staging (Migration 013)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `suspect_watchlist` | Pre-entity staging for persons of interest | `name`, `status`, `priority` (P1-P5), `entity_id` FK (after promotion), `external_urls` JSONB |

### Publication Tables (Migration 016)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `stories` | Long-form investigative articles | `slug` (UNIQUE), `title`, `deck`, `section`, `body_markdown`, `byline`, `reading_time_minutes`, `is_published`, `is_featured`, `published_at`, `case_file_id` FK |
| `story_entities` | Story ↔ entity mentions | `story_id` FK, `entity_id` FK, `mention_context` |
| `story_citations` | Inline document citations in stories | `story_id` FK, `citation_number`, `document_id` FK, `description`, `page_reference` |
| `case_files` | Investigation case file reports | `slug` (UNIQUE), `case_id`, `title`, `status`, `classification`, `summary`, `findings_markdown`, `completion_percentage`, `is_published`, `published_at` |
| `case_file_entities` | Case file ↔ entity links | `case_file_id` FK, `entity_id` FK, `role` |
| `open_questions` | Unanswered investigative questions | `case_file_id` FK, `question`, `priority`, `category`, `status`, `context` |

## JSONB Column Schemas

### `documents.forensic_metadata`
```json
{
  "pdf_version": "1.5",
  "pipeline": "standard",
  "metadata_status": "stripped",
  "eof_markers": 2,
  "fonts": ["Helvetica", "Helvetica-Bold"],
  "page_sizes": ["612x792"],
  "has_xmp": false,
  "has_javascript": false,
  "version_diff": { ... }
}
```

### `entities.external_urls`
```json
{
  "jmail": "https://...",
  "jwiki": "https://...",
  "rhowardstone": "https://...",
  "carstensen": "https://...",
  "other": ["https://..."]
}
```

### `entities.metadata`
```json
{
  "evidence_summary": "...",
  "mentions_summary": "...",
  "mentions_summary_timestamp": "2026-02-15T...",
  "tier_change_history": [...]
}
```

## Migration History

| # | File | What It Does |
|---|------|-------------|
| 003 | `003_document_versions.sql` | `document_versions` table, version tracking columns on `documents` |
| 004 | `004_external_sources.sql` | `external_sources` + `external_events` tables |
| 005 | `005_performance_rpcs.sql` | `rebuild_search_vectors`, `estimated_document_count` RPCs |
| 006 | `006_document_images.sql` | `document_images` table for extracted photos |
| 007 | `007_seed_all_datasets.sql` | Seed data for DS1-12 |
| 008 | `008_profiles.sql` | `profiles` table + auto-create trigger on signup |
| 009 | `009_performance_indexes.sql` | 6 composite + partial indexes for documents/processing |
| 010 | `010_cursor_pagination.sql` | `estimated_document_count()` RPC from `pg_class.reltuples` |
| 011 | `011_image_tagging.sql` | `image_entities` + `image_locations` junction tables |
| 012 | `012_dataset_reviewed_counts.sql` | Adds `reviewed_count` column to datasets |
| 013 | `013_suspect_watchlist.sql` | `suspect_watchlist`, `pg_trgm`, `strength` on connections, fuzzy RPCs |
| 014 | `014_public_events.sql` | Public events (details TBD) |
| 015 | `015_phase3_external.sql` | `research_platforms`, `external_entities`, `external_urls` JSONB, location_type expansion |
| 015b | `015b_fix_fuzzy_rpcs.sql` | Fix fuzzy search to include aliases |
| 015c | `015c_fix_fuzzy_rpcs_v2.sql` | Fix `similarity()` return type casting |
| 016 | `016_publication.sql` | `stories`, `story_entities`, `story_citations`, `case_files`, `case_file_entities`, `open_questions` tables + entity `slug`, `financial_summary`, `profile_published` columns |

**Note:** `schema.sql` contains the core tables (datasets through suspect_watchlist) but does NOT include migration-only tables (document_images, image_entities, image_locations, profiles, external_sources, external_events, research_platforms, external_entities). Both must be run for a complete database.

## Common Query Patterns

### Get entity with all related data
```sql
SELECT e.*,
  (SELECT COUNT(*) FROM entity_documents ed WHERE ed.entity_id = e.id) as doc_count,
  (SELECT COUNT(*) FROM entity_events ee WHERE ee.entity_id = e.id) as event_count,
  (SELECT COUNT(*) FROM entity_connections ec WHERE ec.entity_a = e.id OR ec.entity_b = e.id) as connection_count,
  (SELECT COUNT(*) FROM evidence_items ei WHERE ei.entity_id = e.id) as evidence_count
FROM entities e
WHERE e.id = $1;
```

### Full-text search
```sql
SELECT *, ts_rank(search_vector, query) as rank
FROM entities, plainto_tsquery('english', $1) query
WHERE search_vector @@ query
ORDER BY rank DESC;
```

### Cursor pagination (documents, 1.37M rows)
```sql
-- Forward cursor: sort by bates_number ASC
SELECT * FROM documents
WHERE bates_number > $cursor_value
ORDER BY bates_number ASC
LIMIT 50;

-- Estimated count (O(1) via pg_class):
SELECT reltuples::BIGINT FROM pg_class WHERE relname = 'documents';
```

### Atomic queue claiming (worker)
```sql
SELECT * FROM processing_queue
WHERE status = 'queued'
ORDER BY priority ASC, created_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

## Supabase Client Usage

### Server Components (read-only)
```typescript
import { createClient } from '@/lib/supabase/server'

export default async function EntitiesPage() {
  const supabase = await createClient()
  const { data: entities } = await supabase
    .from('entities')
    .select('*')
    .order('name')
  return <EntityList entities={entities} />
}
```

### API Routes (read/write, with admin guard)
```typescript
import { requireAdmin } from '@/lib/supabase/require-admin'

export async function POST(request: Request) {
  const result = await requireAdmin()
  if (result instanceof NextResponse) return result
  const { supabase } = result

  const body = await request.json()
  const { data, error } = await supabase
    .from('entities')
    .insert(body)
    .select()
    .single()

  if (error) return Response.json({ error }, { status: 400 })
  return Response.json(data)
}
```

### Client Components (with auth)
```typescript
'use client'
import { createClient } from '@/lib/supabase/client'

export function SearchBox() {
  const supabase = createClient()

  async function search(query: string) {
    const { data } = await supabase
      .from('entities')
      .select('*')
      .textSearch('search_vector', query)
      .limit(20)
    return data
  }
}
```
