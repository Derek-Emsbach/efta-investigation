# Architecture Reference

## System Overview

```
┌───────────────────────────────────────────────────────────────┐
│                      VERCEL (Frontend)                         │
│  Next.js 16 App Router + React 19 + Tailwind v4              │
│  ├── (publication)/ — Public pages (/, /entities/[slug], etc)│
│  ├── (evidence)/ — Evidence room (/evidence, dark theme)     │
│  ├── (legal)/ — Legal pages (/disclaimer, /terms, /privacy)  │
│  ├── dashboard/ — Auth-protected admin pages (role-gated)    │
│  └── api/ — REST + Public API endpoints                      │
└───────┬──────────────────────┬────────────────────────────────┘
        │                      │
        │ Supabase SDK         │ Anthropic SDK
        │                      │
┌───────▼────────┐     ┌──────▼───────────────────────────────┐
│   SUPABASE     │     │          ANTHROPIC CLAUDE API         │
│   (Pro tier)   │     │                                       │
│  PostgreSQL    │     │  Detective: claude-sonnet (tool use)  │
│  Auth          │     │  Archer: claude-sonnet (SSE stream)   │
│  Full-text     │     │  Prompt caching (ephemeral)           │
│  search        │     └───────────────────────────────────────┘
└───────▲────────┘
        │                      ┌─────────────────────────────────┐
        │                      │      CLOUDFLARE R2               │
        │                      │                                  │
        │                      │  /datasets/{dsN}/{bates}.pdf    │
        │                      │  /text/{bates}.txt              │
        │                      │  /thumbnails/{doc_id}.jpg       │
        │                      │  /images/{doc_id}/page_{N}.jpg  │
        │                      └──────────▲──────────────────────┘
        │                                 │
        │                                 │ boto3 (S3-compat)
        │ Supabase SDK                    │
        │                                 │
┌───────┴─────────────────────────────────┴────────────────────┐
│              PROCESSING WORKER (Python)                        │
│  Simple polling script (NOT FastAPI)                          │
│  ├── main.py — while True: poll → claim → process → update   │
│  ├── Stages 1-3 (Tier A): ingest, forensics, extract         │
│  ├── Stages 4-7 (Tier B): entities, redactions, crossref,    │
│  │                         classify                           │
│  └── Stage 8 (conditional): version diff                     │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│              MCP SERVER (Node.js/Express)                      │
│  @modelcontextprotocol/sdk — StreamableHTTP transport         │
│  Port 3001 — connects Claude.ai to live investigation data   │
│  ├── 58 tools across 13 domain modules                       │
│  ├── Supabase SDK → PostgreSQL (read/write)                  │
│  ├── R2 SDK → document text retrieval                        │
│  └── better-sqlite3 → SQLite corpus (6.3GB full text +      │
│                        940MB redaction analysis)              │
└──────────────────────────────────────────────────────────────┘
```

## Components

### Frontend (Next.js 16 on Vercel)

Dual-mode app: public publication at `/` (no auth) + private dashboard at `/dashboard/*` (auth-gated). Four route groups apply different CSS themes via `data-theme` attribute on the layout wrapper.

| Route Group | Theme | Purpose |
|-------------|-------|---------|
| `(publication)/` | `publication` (#faf8f5 cream paper) | Public-facing editorial pages |
| `(evidence)/` | `evidence-room` (#0d0f11 deep dark) | Evidence room search |
| `(legal)/` | default | Legal pages (disclaimer, terms, privacy) |
| `dashboard/` | default (dark) | Auth-protected admin dashboard |

**Publication Pages (public, no auth):**

| Route | Purpose |
|-------|---------|
| `/` | Editorial homepage — masthead, stats, story grid, entity spotlight |
| `/entities` | Published entity index (tiers 1-4, `profile_published = true`) |
| `/entities/[slug]` | Dossier-style entity profile (11 components) |
| `/stories` | Story index |
| `/stories/[slug]` | Long-form investigative articles with custom markdown |
| `/case-files` | Case file index |
| `/case-files/[slug]` | Manila-themed investigation reports |
| `/evidence` | Dark-mode document search interface |
| `/disclaimer` | Legal disclaimer |
| `/terms` | Terms of service |
| `/privacy` | Privacy policy |

**Dashboard Pages (auth-gated, role-separated):**

| Route | Purpose | Access |
|-------|---------|--------|
| `/dashboard` | Dashboard with stats, tier distribution, open questions | All auth |
| `/dashboard/entities` | Entity browser with filters (tier, category, type) | All auth |
| `/dashboard/entities/[id]` | Entity profile (tabs: evidence, timeline, docs, connections) | All auth |
| `/dashboard/documents` | Document browser (cursor pagination for 1.37M rows) | All auth |
| `/dashboard/documents/[id]` | Document viewer (text + PDF, metadata, entities, redactions) | All auth |
| `/dashboard/timeline` | Global timeline with date range, entity, dataset filters | All auth |
| `/dashboard/search` | Full-text search with faceted results | All auth |
| `/dashboard/network` | D3.js force-directed entity graph with path-finding | All auth |
| `/dashboard/datasets` | Dataset progress cards with review counts | All auth |
| `/dashboard/hierarchy` | Tree layout for institutional/business relationships | All auth |
| `/dashboard/forensics` | Forensic dashboard | All auth |
| `/dashboard/photos` | Image gallery with entity/location tagging | All auth |
| `/dashboard/locations` | Location browser | All auth |
| `/dashboard/investigations` | Investigation case builder | All auth |
| `/dashboard/upload` | Drag-and-drop PDF upload (presigned URLs → R2) | Admin |
| `/dashboard/processing` | Processing pipeline dashboard (auto-refresh) | Admin |
| `/dashboard/review` | 3-column review: queue \| PDF \| Archer AI copilot | Admin |
| `/dashboard/assistant` | AI Detective research assistant (chat + tool use) | Admin |
| `/dashboard/admin` | User management, role toggles | Admin |
| `/dashboard/settings` | App settings | Admin |

**Dashboard API Routes (auth-gated):**

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/stats` | GET | Dashboard statistics |
| `/api/entities` | GET | Entity list with filters, FTS |
| `/api/entities/[id]` | GET | Full entity with relations |
| `/api/entities/[id]/sources` | GET | External sources (news, court records) |
| `/api/documents` | GET | Document list (cursor + offset pagination) |
| `/api/documents/[id]` | GET | Full document with relations |
| `/api/documents/[id]/file` | GET | Auth-gated R2 file proxy |
| `/api/documents/[id]/reprocess` | POST | Re-queue for processing |
| `/api/timeline` | GET | Events with type/entity/date filters |
| `/api/search` | GET | Unified FTS + ilike across all types |
| `/api/network` | GET | Graph data (nodes + edges) |
| `/api/upload/presign` | POST | Presigned URL generation |
| `/api/upload/confirm` | POST | Confirm R2 upload |
| `/api/processing` | GET | Processing queue status |
| `/api/review` | GET, POST | Review queue + approve/reject/flag |
| `/api/review/archer` | POST | Archer SSE streaming endpoint |
| `/api/assistant` | POST | Detective SSE streaming + tool use |
| `/api/assistant/conversations` | GET, POST | List + create conversations |
| `/api/assistant/conversations/[id]` | GET, PATCH, DELETE | Load + rename/pin + delete |
| `/api/assistant/conversations/[id]/messages` | POST | Save message |

**Public API Routes (no auth, service role key, rate-limited):**

| Route | Methods | Purpose | Rate Limit |
|-------|---------|---------|------------|
| `/api/public/entities` | GET | Published entity list | 120/min |
| `/api/public/entities/[slug]` | GET | Full entity profile by slug | 120/min |
| `/api/public/stories` | GET | Published story list | 120/min |
| `/api/public/stories/[slug]` | GET | Full story with citations | 120/min |
| `/api/public/case-files` | GET | Published case file list | 120/min |
| `/api/public/case-files/[slug]` | GET | Full case file with entities + open questions | 120/min |
| `/api/public/evidence/search` | GET | Full-text document search | 60/min |
| `/api/public/evidence/stats` | GET | Evidence room statistics | 120/min |
| `/api/public/homepage` | GET | Aggregated homepage data | 120/min |

Rate limiting uses in-memory sliding window (`lib/rate-limit.ts`). Public API routes use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS, filtering to `is_published`/`profile_published` records only. Search responses are cached in-memory (5-min TTL for search, 2-min for homepage, 10-min for stats).

### Database (Supabase Pro)

PostgreSQL with ~1.37M document records, full-text search via TSVECTOR + GIN indexes, Row Level Security enabled on all tables (currently all-authenticated = full access).

**23+ tables** across core schema + 15 migrations. See `DATABASE_SCHEMA.md` for full reference.

Key patterns:
- UUID primary keys everywhere
- JSONB `metadata` fields for flexible/evolving attributes
- `search_vector` TSVECTOR columns with weighted triggers
- Cursor pagination on documents (O(1) at any depth via `estimated_document_count()` RPC)
- Atomic queue claiming via `claim_next_queued()` RPC (`FOR UPDATE SKIP LOCKED`)

### File Storage (Cloudflare R2)

S3-compatible object storage. Browser uploads via presigned URLs (no server file size limit).

```
R2 Bucket: efta-documents
├── datasets/{dsN}/{bates}.pdf    # Original PDFs
├── text/{bates}.txt              # Full extracted text (worker joins pages with \n\n)
├── thumbnails/{doc_id}.jpg       # First-page thumbnails (150 DPI)
├── images/{doc_id}/              # Extracted images per document
│   ├── page_{N}_img_{M}.jpg
│   └── page_{N}_img_{M}_thumb.jpg
└── profiles/                     # Entity profile images
```

### Processing Worker (Python)

Simple polling script at `services/worker/main.py`. **Not a web server.** Communicates exclusively through Supabase — reads queue items, downloads from R2, writes results back to DB.

- Polls `processing_queue` every 5 seconds via `claim_next_queued()` RPC
- 8 pipeline stages (see `PROCESSING_PIPELINE.md` for full details)
- Multiple workers can run in parallel (atomic claiming via `FOR UPDATE SKIP LOCKED`)
- `.env` at `services/worker/.env` (separate from app `.env.local`)
- Currently runs locally; Railway deployment planned

### AI Assistants (Anthropic Claude API)

Two AI personas using the Claude API with tool use:

**Detective** (`/assistant` page):
- General research assistant with full DB read access
- 12 Supabase query tools + 5 suggestion tools (connections, tiers, evidence, platform)
- Conversation persistence in `conversations` + `conversation_messages` tables
- SSE streaming with tool call visualization

**Archer** (`/review` page, right panel):
- Document review copilot analyzing the currently-selected document
- System prompt enriched with R2 full text (30K chars) + `get_document_text` tool for on-demand access
- Prompt caching (`cache_control: ephemeral`) — ~90% cost reduction on messages 2+
- Write tools: `suggest_new_entity`, `suggest_event`, `suggest_entity_document_link`
- Annotation protocol for in-PDF entity highlighting

### MCP Server (Node.js/Express)

At `services/efta-mcp-server/`. Bridges Claude.ai desktop to live investigation data.

- Express + `@modelcontextprotocol/sdk` with StreamableHTTP transport on port 3001
- 58 tools across 13 domain modules (`src/tools/`): entities, documents, events, connections, suspects, sightings, external, links, redactions, corpus, utility, public-events
- Connects to: Supabase (read/write), R2 (text retrieval), SQLite corpus (full-text search)
- Separate `.env` with `MCP_AUTH_TOKEN`

### SQLite Corpus (Local Only)

Two SQLite databases from researcher's v4.0 processing — accessed by the MCP server only:

| Database | Size | Purpose |
|----------|------|---------|
| `data/full_text_corpus.db` | 6.3 GB | Full text of all pages, FTS5 search |
| `data/redaction_analysis_v2.db` | 940 MB | Redaction hidden text (OCR) |

Uses `better-sqlite3` npm package (native addon, synchronous API, bundles FTS5). The MCP server provides 5 `corpus_*` tools for document text retrieval and full-text search.

## Data Flow

### Document Upload → Processing → Review
1. Browser sends metadata to `POST /api/upload/presign`
2. Server creates `documents` row + `processing_queue` row, returns presigned R2 URL
3. Browser uploads PDF directly to R2 via PUT
4. Browser calls `POST /api/upload/confirm`
5. Worker claims queue item via `claim_next_queued()` RPC
6. Worker runs stages 1-8, updating results in Supabase
7. High-value docs flagged as `needs_review` → appear in review queue
8. Admin reviews with Archer AI copilot → approve/flag/reject

### MCP Investigation Workflow
1. Open Claude.ai with MCP server connected
2. Use `corpus_search` / `corpus_get_document_text` for raw document reads
3. Use `lookup_person` to find/create entity records
4. Use write tools (`create_event`, `link_entity_to_document`, `create_connection`) to lock findings into DB
5. Changes appear immediately in the web app

### Auth Flow
1. Request arrives at middleware
2. Public paths (`/`, `/entities/*`, `/stories/*`, `/case-files/*`, `/evidence`, `/disclaimer`, `/terms`, `/privacy`) → pass through without auth check
3. Dashboard paths (`/dashboard/*`) → check Supabase session
4. No session → redirect to `/login`
5. Session valid → check role from `profiles` table
6. Viewer role → blocked from admin paths (`/dashboard/upload`, `/dashboard/processing`, `/dashboard/review`, `/dashboard/assistant`, `/dashboard/admin`, `/dashboard/settings`)
7. RLS policies: all authenticated = full access (enforcement is application-layer)
8. Public API routes use `SUPABASE_SERVICE_ROLE_KEY` directly (no user auth)

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx         # Server-side only

# Cloudflare R2
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=efta-documents

# Anthropic
ANTHROPIC_API_KEY=xxx                 # Claude API for Detective + Archer

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Worker (.env at services/worker/.env)
# SUPABASE_URL, SUPABASE_SERVICE_KEY, R2 credentials, POLL_INTERVAL

# MCP Server (.env at services/efta-mcp-server/.env)
# SUPABASE_URL, SUPABASE_SERVICE_KEY, R2 credentials, MCP_AUTH_TOKEN, PORT
```
