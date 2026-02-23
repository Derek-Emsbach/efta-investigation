# EFTA Investigation Platform — Build TODO

> **Update this file as tasks are completed.** Check off items with `[x]`. Add notes on blockers or changes.

---

## Phase 1: Foundation (Target: Week 1)

**Goal:** Working database with DS12 data loaded, basic web interface, auth, deployed to Vercel.

### 1.1 Scaffold & Setup
- [x] Initialize Turborepo monorepo with pnpm
- [x] Create Next.js app at `apps/web` (Next.js 16 + React 19 + Tailwind v4)
- [x] Create `packages/db/` with `schema.sql` and `package.json`
- [x] Create `packages/shared/` with TypeScript types matching schema
  - Types: `database.ts` (all 15 table interfaces + union literal types for CHECK constraints)
  - Constants: `tiers.ts` (TIER_CONFIG), `severity.ts` (SEVERITY_CONFIG + REDACTION_CATEGORIES)
- [x] Create `services/worker/` placeholder with `requirements.txt`
- [x] Create `scripts/` directory with import scripts package
- [x] Set up `.gitignore` (node_modules, .env*, .next, dist, __pycache__)
- [x] Create `.env.local.example` with all required variable names
- [x] Initial commit
- [x] Push to GitHub

> **Note:** Using Next.js 16 (not 14) with React 19 and Tailwind v4 (CSS-based config, not tailwind.config.ts).

### 1.2 Database Setup
- [x] Create Supabase project
- [x] Run `packages/db/schema.sql` in Supabase SQL editor
- [x] Verify all tables created with correct columns
- [x] Enable Row Level Security on all tables
- [x] Create RLS policies (admin full access, anon read for public entities/events)
- [x] Create database indexes (search vectors, bates_number, entity name, etc.)
- [x] Set up full-text search triggers on entities and documents
- [x] Test queries in Supabase dashboard
- [x] Added UNIQUE constraints on `entities.name` and `investigations.name`

### 1.3 Supabase Client Integration
- [x] Install `@supabase/supabase-js` and `@supabase/ssr`
- [x] Create `lib/supabase/client.ts` (browser client — `createBrowserClient`)
- [x] Create `lib/supabase/server.ts` (server component client — `createServerClient` with cookies)
- [x] Create `lib/supabase/middleware.ts` (auth middleware — session refresh + route protection)
- [x] Create `lib/supabase/admin.ts` (service role client — bypasses RLS for scripts)
- [x] Create `middleware.ts` (Next.js middleware wiring)
- [x] Set up environment variables in `.env.local`
- [x] Test connection: query entities table from a server component

### 1.4 Cloudflare R2 Setup
- [x] Create R2 bucket: `efta-documents`
- [x] Generate API token with read/write
- [x] Create `lib/r2/client.ts` with upload/download/delete helpers (S3-compatible via `@aws-sdk/client-s3`)
- [x] Set up CORS policy for Vercel domain (localhost:3000 + efta-investigation.vercel.app)
- [x] Defensive `.trim()` on all `process.env` reads (Vercel env vars had trailing newlines)
- [x] Test: upload and retrieve a test file

### 1.5 Auth
- [x] Set up Supabase Auth (email/password)
- [x] Create admin user in Supabase dashboard
- [x] Build `/login` page (dark editorial design, email+password, `signInWithPassword()`)
- [x] Create auth middleware to protect all routes except `/login`
- [x] Build logout button component (`signOut()` + redirect)
- [x] Test login/logout flow

### 1.6 Base Layout & Design System
- [x] Install fonts: Playfair Display (display), IBM Plex Sans (body), IBM Plex Mono (metadata)
- [x] Set up Tailwind v4 theme in `globals.css` (`@theme inline {}`) with custom colors, fonts, animations
- [x] Create base layout: 240px fixed dark sidebar + main content area
- [x] Build UI components:
  - [x] TierBadge (color-coded entity tier chip — "TIER 1 · CONVICTED")
  - [x] SeverityMarker (colored dot + label, pulse on extreme_critical)
  - [x] EvidenceStrength (3-dot fill indicator: ●●●, ●●○, ●○○)
  - [x] DocumentCard (severity border, bates# mono, title, metadata)
  - [x] EntityCard (avatar initials, name Playfair, tier badge, stats)
  - [x] DataTable (dark header, alternating rows, sortable, paginated — Client Component)
  - [x] SearchInput (debounced with search icon)
  - [x] PageHeader (Playfair title + subtitle + action slot)
  - [x] StatCard (metric card for dashboard)
  - [x] FilterBar (horizontal dropdown filter row)
  - [x] Skeleton (shimmer loading placeholder)

> **Note:** Tailwind v4 uses CSS-based config, not `tailwind.config.ts`. Theme defined in `globals.css` with `@theme inline {}`.

### 1.7 Core Pages (Basic Versions)
- [x] `/` — Dashboard (Server Component)
  - [x] Investigation stats (total entities, documents, events, datasets)
  - [x] Tier distribution with colored badges
  - [x] Dataset progress (DS12: 137/152 reviewed)
  - [x] Open questions list
- [x] `/entities` — Entity Browser (Client Component)
  - [x] DataTable with columns: Name, Tier, Category, Status, Doc Count, Event Count
  - [x] Filter by: tier, category, entity_type
  - [x] Search by name (FTS via API)
  - [x] Click row → navigate to `/entities/[id]`
- [x] `/documents` — Document Browser (Client Component)
  - [x] DataTable with columns: Bates #, Dataset, Type, Date, Severity, Pages
  - [x] Filter by: dataset, type, severity, status
  - [x] Search by bates number or content (FTS via API)
  - [x] Click row → navigate to `/documents/[id]`
- [x] `/entities/[id]` — Entity Profile (Server Component)
  - [x] Hero: name (Playfair), tier badge, category, status, avatar initials
  - [x] Stats row: doc count, evidence count, event count, connection count
  - [x] Tab bar placeholders: Evidence, Timeline, Documents, Connections
  - [x] Quick facts sidebar: datasets, aliases, investigations
- [x] `/documents/[id]` — Document Detail (Server Component)
  - [x] Bates number (large, mono), severity marker
  - [x] Metadata grid: dataset, type, date, pages, classification, status
  - [x] Summary text
  - [x] PDF viewer placeholder ("Coming in Phase 2")
  - [x] Linked entities list (clickable)
  - [x] Source events list

### 1.8 Data Import
- [x] Create `scripts/src/seed-dataset.ts` — seeds DS12 dataset + Leon Black investigation
- [x] Create `scripts/src/import-entities.ts` — parses `ENTITIES.md` (3 tier sections, ~51 entities)
- [x] Create `scripts/src/import-documents.ts` — extracts Bates numbers from all MDs, enriches from TIMELINE.md (~80 docs)
- [x] Create `scripts/src/import-events.ts` — parses `TIMELINE.md` + creates event_documents/entity_events junctions (~32 events)
- [x] Create `scripts/src/import-connections.ts` — 15 curated connections with source citations
- [x] Create `scripts/src/import-all.ts` — master script runs all 5 in dependency order
- [x] Create `scripts/src/utils/markdown-parser.ts` — shared parsing utilities
- [x] Run all import scripts (`pnpm --filter @efta/scripts import:all`)
- [x] Verify data appears correctly in web UI (51 entities, 55 docs, 30 events, 15 connections)

### 1.9 Deploy
- [x] Configure Vercel build settings (transpilePackages, build commands)
- [x] Verify `pnpm build` succeeds locally (all 12 routes compile)
- [x] Push to GitHub
- [x] Connect repo to Vercel
- [x] Set environment variables in Vercel dashboard
- [x] Deploy and verify live site
- [x] Test auth on production

---

## Phase 2: Entity Profiles & Timeline (Target: Weeks 2-3)

**Goal:** Deep entity profiles with evidence cases, interactive timeline, document viewer, search.

> **Status:** Core features complete. Entity profile tabs, document viewer, timeline, search, network graph, and enhanced dashboard all shipped. Remaining items are enhancements (advanced filters, day view, parallel timelines, etc.).

### 2.1 Entity Profiles
- [x] Full entity profile page (`/entities/[id]`)
  - [x] Hero section: name, tier badge, category, status, profile image
  - [x] Bio/narrative section (compiled from investigation findings)
  - [x] **Evidence Tab** (non-victims):
    - [x] Evidence inventory table (type, description, strength, source doc link)
    - [x] Each evidence item links to the source document
    - [ ] Images/photos displayed inline with captions
    - [ ] Financial evidence with amounts and dates
  - [ ] **Story Tab** (victims, only if `is_public = true`):
    - [ ] Narrative format, not clinical
    - [ ] Privacy notice if entity is protected
  - [x] **Timeline Tab:**
    - [x] Per-entity timeline of their involvement
    - [x] Events linked to source documents
  - [x] **Documents Tab:**
    - [x] All documents mentioning this entity
    - [x] Role in each document (subject, mentioned, author, etc.)
    - [x] Excerpt/quote from each document
  - [x] **Connections Tab:**
    - [ ] Mini network graph centered on this entity
    - [x] List of connections with relationship type and evidence strength
    - [x] Click any connection → navigate to that entity's profile
  - [ ] **Locations Tab:**
    - [ ] Interactive map with pins at all known locations for this entity
    - [ ] Sighting timeline: date, location, type, source document
    - [ ] Co-location analysis: other entities at same place/time
    - [ ] Movement patterns summary

### 2.2 Document Viewer
- [x] Dual-mode viewer: extracted text view + native PDF embed
  - [x] Text view with in-document search, font size controls, character count
  - [x] PDF view via `<object>` + `<iframe>` fallback (activates when file_url exists)
  - [x] Forensic metadata toggle panel
  - [x] API proxy route (`/api/documents/[id]/file`) for auth-gated R2 streaming
- [x] Metadata panel:
  - [x] Bates number, dataset, type, date, pages, severity
  - [x] Forensic metadata (PDF version, pipeline, EOF markers)
  - [x] Processing status
- [x] Entities panel: all entities found in this document (clickable)
- [x] Redactions panel: any redaction analysis for this document (color-coded A-D categories)
- [x] Evidence items panel with strength indicators
- [ ] Cross-references panel: related documents
- [ ] Upload actual DS12 PDFs to R2 and link in database

### 2.3 Global Timeline
- [x] Vertical timeline page (`/timeline`) with event filtering and search
- [x] Events grouped by month with sticky headers
- [x] Color-coded by event type (legal=blue, evidence=amber, etc.)
- [x] Linked entities shown as tier-colored chips
- [x] **Filters:**
  - [x] By event type
  - [x] Search by title/description
  - [x] By entity (show only events involving selected person)
  - [x] By dataset
  - [ ] By severity
  - [x] Date range picker (from/to date inputs)
- [ ] Interactive horizontal timeline component (zoomable: year → month → day)
- [ ] **Day View** (click any date for full daily intelligence briefing)
- [ ] **Parallel view:** stack 2-3 entities to compare timelines side-by-side
- [ ] Click any event → see source documents

### 2.4 Search
- [x] Full-text search page (`/search`)
- [x] Search across: documents (extracted text), entities (name, bio), events (title, description)
- [x] Dual strategy: FTS for stemmed matches + ilike for substring/Bates number matching
- [x] Faceted results: grouped by Entities, Documents, Events with count badges
- [x] Click any result → navigate to detail page
- [ ] Supabase `ts_rank` scoring for relevance ordering
- [x] Client-side facet filters: entity tier, document type/severity, event type
- [x] Highlight search terms in results (word-splitting + `<mark>` wrapping)

### 2.5 API Routes
- [x] `GET /api/entities` — list with filters, pagination, FTS search *(built in Phase 1)*
- [x] `GET /api/entities/[id]` — full entity with relations (docs, events, connections, evidence) *(built in Phase 1)*
- [x] `GET /api/documents` — list with filters, pagination, FTS search *(built in Phase 1)*
- [x] `GET /api/documents/[id]` — full document with relations (entities, redactions, evidence, events) *(built in Phase 1)*
- [x] `GET /api/timeline` — events list with type filter, search, entity joins *(built in Phase 2)*
- [x] `GET /api/search` — unified FTS + ilike search across entities, documents, events *(built in Phase 2)*
- [x] `GET /api/network` — graph data (connected entities + edges) *(built in Phase 2)*
- [x] `GET /api/documents/[id]/file` — auth-gated R2 file proxy *(built in Phase 2)*
- [x] `GET /api/stats` — dashboard statistics *(built in Phase 1, enhanced in Phase 2)*
- [x] `POST /api/assistant` — AI research assistant with SSE streaming + tool use *(built in Phase 3)*
- [x] `POST /api/assistant/apply` — apply AI suggestions (connections, tiers, evidence, platform) *(built in Phase 3)*
- [x] `GET/POST /api/assistant/conversations` — list + create conversations *(built in Phase 3)*
- [x] `GET/PATCH/DELETE /api/assistant/conversations/[id]` — load + rename/pin + delete *(built in Phase 3)*
- [x] `POST /api/assistant/conversations/[id]/messages` — save message to conversation *(built in Phase 3)*
- [x] `PATCH /api/assistant/conversations/[id]/messages/[messageId]` — update message (suggestion status) *(built in Phase 3)*
- [x] `POST /api/upload/presign` — presigned URL generation + re-upload detection *(built in Phase 4)*
- [x] `POST /api/upload/confirm` — confirm R2 uploads completed *(built in Phase 4)*
- [x] `GET /api/processing` — processing queue with status filtering *(built in Phase 4)*
- [x] `GET/POST /api/review` — review queue + approve/reject/flag actions *(built in Phase 4)*
- [x] `POST /api/review/archer` — Archer AI analysis for document review *(built in Phase 4)*
- [x] `POST /api/documents/[id]/reprocess` — re-queue document for processing *(built in Phase 4)*

---

## Phase 3: Network Graph & Org Chart (Target: Week 4)

**Goal:** Visual relationship mapping, dataset tracking.

### 3.1 Network Graph
- [x] D3.js force-directed graph (`/network`)
- [x] Nodes = entities
  - [x] Sized by connection degree
  - [x] Colored by tier (Tier 1=red, Tier 2=amber, etc.)
  - [x] Labeled with name
- [x] Edges = entity_connections
  - [x] Opacity by evidence_strength (documented > alleged > circumstantial)
  - [x] Labeled on hover (relationship type)
- [x] **Interactions:**
  - [x] Click node → navigate to entity profile
  - [x] Drag nodes to rearrange
  - [x] Zoom and pan
  - [x] Hover to highlight connected edges + fade unconnected nodes
  - [x] Tooltip with tier badge + category
  - [x] Filter by tier (clickable legend + checkbox panel)
  - [x] Filter by relationship type (checkbox panel)
  - [x] Filter by evidence strength (documented/alleged/circumstantial)
  - [x] Search to highlight specific entity (autocomplete dropdown + zoom-to-node)
  - [x] Quick filters: "High-risk only", "Documented only", "Reset all"
  - [x] Stats show filtered/total counts
  - [x] "Find path between" — highlight shortest connection path between two entities (BFS)
- [ ] **Clusters:** automatic grouping by relationship density

### 3.2 Org Chart / Hierarchy
- [x] Tree layout for institutional/business relationships (`/hierarchy`)
- [x] Shell companies and trusts as nodes
- [x] Ownership/employment relationships as edges
- [ ] Money flows indicated by edge labels
- [ ] Properties as location nodes
- [ ] Agencies (FBI, SDNY, DANY, CRU) as institutional nodes
- [ ] Toggle between: business hierarchy, institutional hierarchy, property network

### 3.3 Dataset Progress
- [x] Dataset overview page (`/datasets`)
- [x] Card per dataset: name, size, file count, progress bar, priority badge
- [x] Click card → filtered document list for that dataset
- [x] Summary stats: total files, reviewed, critical findings per dataset

### 3.4 AI Research Assistant
- [x] Chat interface at `/assistant` with full-height layout
- [x] Claude API integration (`claude-sonnet-4-5-20250929`) via `@anthropic-ai/sdk`
- [x] System prompt with investigation context, entity tiers, redaction framework, critical rules
- [x] SSE streaming with real-time text display and tool call visualization
- [x] Tool use: 7 read-only Supabase query tools
  - [x] `search_entities` — name/tier/category/type/status filters, FTS + ilike
  - [x] `search_documents` — bates/title/type/severity/keyword/date range, FTS + ilike
  - [x] `search_events` — keyword/event_type/date range with linked entity names
  - [x] `get_entity_profile` — full profile with connections, evidence, docs, events
  - [x] `get_document_detail` — full detail with linked entities, redactions, evidence
  - [x] `query_connections` — both directions, relationship/strength filters
  - [x] `cross_reference` — missing connections detector (co-occurrence analysis)
- [x] Victim privacy enforced (non-public victim bios redacted)
- [x] Welcome panel with 6 suggested queries
- [x] Collapsible tool call blocks showing params + results
- [x] Conversation history within session
- [x] Sidebar navigation with sparkles icon (7th nav item)
- [x] **Detective Partner role** — proactive investigator persona with theory-building, brainstorming, and investigation priorities
- [x] **Actionable suggestions** — 5 new tools for proposing database changes + platform improvements
  - [x] `get_platform_context` — returns current platform state, features, gaps, and live stats
  - [x] `suggest_connection` — proposes entity connections with validation + duplicate detection
  - [x] `suggest_tier_change` — proposes entity tier reclassification with justification
  - [x] `suggest_evidence_item` — proposes evidence records linked to entities + documents
  - [x] `suggest_platform_improvement` — proposes platform features/tracking/tools saved to backlog
  - [x] Interactive SuggestionCard components (4 card variants: connection, tier change, evidence, platform)
  - [x] Approve/dismiss with one click → writes to database via POST `/api/assistant/apply`
  - [x] `platform_suggestions` table for backlog tracking
- [x] **Conversation persistence** — full chat history saved to database
  - [x] `conversations` + `conversation_messages` tables with incremental saves
  - [x] Auto-create conversation on first message, auto-title from message content
  - [x] Collapsible conversation panel (280px, left side) with time-grouped list
  - [x] Pin/unpin, rename (inline edit), delete (with confirmation)
  - [x] URL sync via `?c=<uuid>` query param for deep-linking
  - [x] Suggestion states (approved/dismissed) persist across page reloads
  - [x] 4 API route files: conversations CRUD, messages save, message update
- [ ] Suggested queries based on current page context

---

## Phase 4: Processing Pipeline (Target: Weeks 5-6)

**Goal:** Automated document ingestion and analysis with human review.

> **Status:** Core pipeline complete. 8-stage worker (ingest → forensics → extract → entities → redactions → crossref → classify → version diff), upload with re-upload detection + folder upload, processing dashboard, review page with Archer AI copilot (3-column layout, markdown rendering, prompt caching, image navigation, scoring display, auto-advance, toast notifications), document versioning and diff, atomic multi-worker support, live dataset progress tracking. Remaining: worker deployment, zip upload, entity/evidence editing in review.

### 4.1 Python Worker
- [x] Python polling worker in `services/worker/` (simple script, not FastAPI)
- [x] Supabase client for Python (`db.py` — service role key, bypasses RLS)
- [x] R2 client for Python (`storage.py` — boto3 with S3-compatible endpoint)
- [x] Pipeline stages (1-3):
  - [x] `ingest.py` — download from R2, page count, file size, thumbnail generation (150 DPI)
  - [x] `forensics.py` — PDF version, metadata, EOF markers, pipeline detection, fonts, XMP/JS/forms
  - [x] `extract.py` — text extraction (PyMuPDF), document type classification, date detection
- [x] Pipeline stages (4-7):
  - [x] `entities.py` — two-pass entity matching (exact regex + fuzzy/edit-distance), OCR whitespace normalization, role detection, case number extraction
  - [x] `redactions.py` — page-level redaction detection, coverage estimation, A-D category classification, suspect redaction flagging
  - [x] `crossref.py` — match dates, entities, case numbers against existing documents/events; creates event_documents links
  - [x] `classify.py` — evidence value scoring (0-100), severity assignment, auto-approve low-value docs, flag high-value for review
- [x] Pipeline stage 8 (conditional):
  - [x] `diff.py` — version diff for re-processed documents; compares redactions, entities, classification, severity against previous version snapshot; flags redaction decreases
- [x] Each stage updates document `processing_status` in Supabase
- [x] Queue management: process one document at a time, report progress
- [x] Atomic queue claiming via Postgres RPC (`FOR UPDATE SKIP LOCKED`) — safe for multiple parallel workers
- [x] Error handling: failed documents marked with error message, retryable
- [x] Entity catalog TTL cache (5-min refresh) — worker picks up newly added entities without restart

### 4.2 Admin Upload UI
- [x] `/upload` page with drag-and-drop PDF upload
- [x] Presigned URL upload (browser → R2 direct, no file size limit)
- [x] Dataset selector dropdown
- [x] Per-file progress bars (XHR for progress events)
- [x] Parallel uploads (up to 5 concurrent)
- [x] Folder upload: recursive directory scanning (FileSystemEntry API + `webkitdirectory`) with batched presigning (50 per batch)
- [x] Bates number auto-detection from filename
- [x] Re-upload detection: duplicate bates numbers trigger version snapshot + re-queue instead of rejection
- [x] Re-upload UI: amber "Re-upload v{N}" badges, distinct success banner with re-upload count
- [ ] Upload zone: zip file support
- [ ] Google Drive URL input (for large datasets)

### 4.2b Processing Dashboard
- [x] `/processing` page with auto-refreshing queue (5s polling)
- [x] Summary stats: queued, processing, completed, failed, needs_review
- [x] Queue table with status badges, current step, priority, timestamps
- [x] Filter by status
- [x] Click row → navigate to document detail
- [x] Re-process button on document detail page (queues without new PDF upload)
- [x] Retry failed documents (individual + bulk via `/api/processing/retry`)
- [x] Bulk actions (retry all failed, clear completed, checkbox multi-select)

### 4.3 Admin Review UI
- [x] `/review` page with 3-column layout (collapsible queue | PDF + form bar | Archer panel)
- [x] Left panel: document queue (needs_review status, collapsible to icon-width)
- [x] Center panel: PDF viewer (full height) + collapsible review form bar at bottom
- [x] Right panel: Archer AI copilot (full height, 380px)
- [x] Editable fields: title, document_type, date, severity, classification
- [x] Review notes textarea
- [x] Actions: Approve, Flag, Reject (always visible in collapsed form bar)
- [x] Toast notifications on review actions (Approved/Flagged/Rejected with doc name)
- [x] Auto-advance to next document in queue after approve/flag/reject
- [x] Evidence value score, severity, and classification badges on queue list items
- [x] Score breakdown panel (point-by-point reasons + review triggers) shown when document is selected
- [x] Live dataset reviewed counts (RPC replaces stale `reviewed_count` column)
- [x] Processing dashboard: "Needs Review" count from documents table, review banner link
- [ ] Confirm/edit entity matches
- [ ] Adjust tier assignments
- [ ] Add/edit evidence items
- [x] Keyboard shortcuts for fast review (j/k nav, a/f/r actions, q/e toggle panels, ? help)
- [x] **Archer Review Copilot** — AI investigative partner embedded in review page
  - [x] Full-height right-side panel with markdown rendering (react-markdown + remark-gfm)
  - [x] Conversational pace: brief first impression → numbered section menu → drill-down per section
  - [x] Quick actions as 2-column card grid (welcome state) + horizontal scroll (after messages)
  - [x] Contextual prompts: "Who is mentioned?", "What's significant?", "Cross-references?", etc.
  - [x] Surfaces entities, key quotes, evidence-grade information, and connections
  - [x] Recommends review action (approve/flag/reject) with reasoning
  - [x] Conversation persists per document (revisit later to continue analysis)
  - [x] Actionable suggestion cards (apply/dismiss connections, tier changes, evidence)
  - [x] **Write tools**: suggest_new_entity, suggest_event, suggest_entity_document_link — one-click entity/event creation from review
  - [x] "Catalog all entities" quick action — auto-search + create/link every entity in a document
  - [x] **Full document text access**: system prompt enriched with R2 text (30K chars, up from 2K DB preview)
  - [x] `get_document_text` tool — on-demand page-range text retrieval from R2 for long documents (>30K chars)
  - [x] Base64 noise stripping (`stripBinaryNoise`) — removes MIME-encoded attachments before AI sees text
  - [x] **MIME attachment decoding** (worker): decodes base64 PDF/text attachments and extracts content at extraction time
  - [x] Prompt caching (`cache_control: ephemeral`) — ~90% cost reduction on messages 2+
  - [x] Conversation history trimming (last 10 messages to prevent token bloat)
  - [x] PDF annotation protocol (`<!--ANNOTATION:...-->`) — tier-colored entity highlights, key text, page navigation
  - [x] Image navigation in PDF toolbar (pages with images dropdown from forensic metadata)

### 4.4 Tiered Processing
- [x] **Tier A (automatic, all documents — stages 1-3):**
  - [x] R2 download, page count, file size, thumbnail (stage 1)
  - [x] PDF forensic metadata extraction (stage 2)
  - [x] Text extraction + document type + date detection + MIME attachment decoding (stage 3)
- [x] **Tier B (gated, non-blank documents — stages 4-7):**
  - [x] Entity name extraction (regex + fuzzy matching) (stage 4)
  - [x] Redaction detection and A-D classification (stage 5)
  - [x] Cross-reference matching (dates, entities, case numbers) (stage 6)
  - [x] Evidence value scoring (0-100), severity, auto-approve (stage 7)
- [x] **Tier B skip reason flags:** `tier_b_skipped`, `blank_page`, `photo_only` written to document flags when advanced stages are skipped — reviewers can distinguish blank separators from handwritten notes with bad OCR
- [ ] **Tier C (human review, high-value documents):**
  - [ ] Full forensic analysis
  - [ ] Manual entity verification
  - [ ] Evidence item creation
  - [ ] Connection mapping
  - [ ] Narrative writing (for entity profiles)
- [x] Priority scoring algorithm:
  - [x] Page count, entity tier, redaction severity, document type all contribute
  - [x] Score 0-100 → severity mapping (routine/high/critical/extreme_critical)
  - [x] Documents scoring ≥75 auto-set to `needs_review`

### 4.5 Document Versioning & Re-Upload
- [x] `document_versions` table for snapshot history
- [x] Re-upload handling: duplicate bates numbers create version snapshot + re-queue
- [x] Re-process API: `/api/documents/[id]/reprocess` (no new PDF needed)
- [x] Version diff stage (stage 8): redaction changes, entity changes, classification/severity changes
- [x] Version badge on document detail page (v2, v3, etc.)
- [x] Collapsible version history panel
- [x] Version diff alert card with significant findings
- [x] Flags: `redaction_decrease`, `unredacted_names` for DOJ re-release detection
- [x] Migration SQL run in Supabase SQL Editor (`packages/db/migrations/003_document_versions.sql`) + `claim_next_queued()` RPC function
- [x] Cross-dataset reconciliation script (`scripts/reconcile-cross-dataset.py`) — detects same-Bates-number documents across datasets, triggers version diff pipeline
- [ ] Pre-DS9 scaling: replace 100-candidate Jaccard duplicate detection with MinHash LSH or Bates-number index for cross-referencing at 500K+ document scale

### 4.6 Deploy Worker
- [ ] Create Dockerfile for Python worker
- [ ] Deploy to Railway
- [ ] Set environment variables (Supabase URL/key, R2 credentials)
- [ ] Test: upload DS12 zip, verify processing

---

## Phase 5: Polish & Scale (Target: Weeks 7-8)

**Goal:** Production-ready, visually striking, performant.

### 5.1 Visual Design Pass
- [x] Full dark theme implementation
- [x] Light/dark mode toggle with localStorage persistence and FOUC prevention
- [x] Custom loading states and skeleton screens (loading.tsx for dashboard, entity profile, document detail)
- [x] Micro-animations: page transitions (fade-in-up on MainContent), shimmer skeletons, toast notifications
- [x] Empty states for pages with no data (EmptyState component on photos, datasets, hierarchy + existing on entities, documents, timeline, network, processing, review)
- [x] Error states with helpful messages (error.tsx global boundary + not-found.tsx 404 page)
- [x] Responsive layout (works on tablet, graceful on mobile — hamburger sidebar)
- [x] Favicon and meta tags (icon.svg, Open Graph metadata)
- [x] Legal infrastructure: footer with disclaimer, /disclaimer, /terms, /privacy pages
- [x] Skip-to-content link for keyboard accessibility
- [x] Breadcrumb navigation on entity and document detail pages
- [x] robots.txt (disallow all — private tool)
- [x] aria-current on active nav links, aria-hidden on decorative icons
- [x] Copyright notice (© Cyclops Digital LLC) in sidebar + footer

### 5.2 Performance
- [ ] Database indexes audit (EXPLAIN ANALYZE on common queries)
- [x] Cursor-based pagination on documents page (1.37M rows) — cursor encode/decode, estimated count RPC, server-side sort
- [ ] Pagination on remaining list pages (entities, events, locations use offset — fine at current scale)
- [ ] Image optimization (Next.js Image component, R2 transforms)
- [ ] Edge caching for public pages
- [ ] Lazy loading for below-fold content
- [ ] Bundle analysis and code splitting

### 5.3 Export & Reporting
- [ ] Export entity profile as PDF
- [ ] Export timeline as PNG/SVG
- [ ] Export evidence package per entity (zip with docs + summary)
- [ ] Export network graph as image
- [ ] Print-friendly stylesheets

### 5.4 Monitoring
- [ ] Error tracking (Sentry or similar)
- [ ] Basic analytics (page views, search queries)
- [ ] Database monitoring via Supabase dashboard
- [ ] Worker health checks

### 5.5 Automated Analysis Reports
- [ ] Nightly cron job (Supabase Edge Function or worker) that generates:
  - [ ] **Missing connections report:** Entities that co-occur in 3+ documents but have no connection record
  - [ ] **Under-investigated entities:** Tier 3+ entities with fewer than 3 source documents
  - [ ] **Redaction inconsistencies:** Same entity redacted in one document but visible in another
  - [ ] **Timeline gaps:** Date ranges with known entity activity but no events logged
  - [ ] **Stale reviews:** Documents in `needs_review` status for more than 7 days
- [ ] Reports surface on admin dashboard as notification cards
- [ ] Click any finding → relevant entity/document/search

---

## Future Phases (Backlog)

### Infrastructure Scaling (Supabase Pro + Bulk Import)
> Full plan: `.claude/plans/hashed-herding-beaver.md`
- [x] Upgrade Supabase to Pro ($25/mo) — 8 GB database, 100K MAUs
- [x] Migration `008_profiles.sql` — profiles table with role column (admin/viewer), auto-create trigger, RLS
- [x] Admin user seeded in profiles table
- [ ] `user_profiles` table expansion: subscription_tier (free/pro/enterprise), Stripe fields, AI query metering
- [ ] Replace all 18+ RLS policies: public read on data tables, admin-only on admin tables, own-user on conversations
- [x] Performance indexes (migration 009): 6 composite + partial indexes for documents, processing_queue, events
- [ ] Grant anon access to RPC functions (from migration 005)
- [x] Fix load_file_parser.py encoding (UTF-8 first, ALT_DELIM priority, thorn stripping)
- [x] Clean up ~1.37M corrupted docs from encoding bug (cleanup_corrupted_docs.py)
- [x] Bulk import large volumes: VOL09 (531,307) + VOL10 (503,154) + VOL11 (331,655) = 1,366,069 created
- [x] Bulk import small volumes: VOL01/03/04/05/06/07/12 = 3,679 updated (existing seed docs)
- [x] Rebuild search vectors (1,366,537 via RPC + Python batching script)
- [x] VACUUM ANALYZE documents
- [x] Verify DB size stays under 8 GB in Supabase dashboard (3.61 GB / 8 GB = 45%)

### Public Access & User Signup
> Full plan: `.claude/plans/hashed-herding-beaver.md` (Phase C + F)
- [ ] Update middleware — define PROTECTED_PATHS, allow anonymous browsing on public pages
- [ ] Update dashboard layout — anonymous-friendly (no admin section, "Sign In" button)
- [ ] Update sidebar — conditionally show admin links based on user role
- [ ] Access control utility (`lib/access-control.ts`) — canViewPDF, canUseDetective, canUpload
- [ ] Signup page (`/signup`) — email/password, email verification, Turnstile bot prevention
- [ ] Password reset page (`/reset-password`) — uses Supabase built-in flow
- [ ] OAuth sign-in (Google) — enable in Supabase dashboard + Google Cloud Console
- [ ] Update login page — add "Create Account", "Forgot Password" links, OAuth buttons
- [ ] Account settings page — display name, change password, delete account (GDPR)
- [ ] Gate API routes: public GET routes remove auth check, write routes keep auth + role check
- [ ] Content tiers: anon (browse only), free (full text), pro (PDF + AI), admin (upload/review)

### Security Hardening
> Full plan: `.claude/plans/hashed-herding-beaver.md` (Phase E)
- [ ] Rate limiting — Upstash Redis + `@upstash/ratelimit` (free tier: 10K/day)
- [ ] API rate limit: 60 req/min per IP, AI rate limit: 10 req/min per user, auth: 5 attempts/min
- [ ] Email verification — enable "Confirm email" in Supabase Auth settings
- [ ] Bot prevention — Cloudflare Turnstile (free) on signup + login
- [ ] Security headers — X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- [ ] Anthropic API spend cap — set monthly budget in Anthropic Console ($50/mo initially)
- [ ] Error monitoring — Sentry (free tier: 5K events/mo)
- [ ] Vercel Attack Challenge Mode — keep off normally, enable during active attacks

### Monetization (Stripe + Pro Tier)
> Full plan: `.claude/plans/hashed-herding-beaver.md` (Phase D)
- [ ] Stripe integration — `stripe` + `@stripe/stripe-js` packages
- [ ] Stripe webhook handler (`/api/webhooks/stripe`) — subscription lifecycle events
- [ ] Checkout route (`/api/billing/checkout`) — create Stripe Checkout session
- [ ] Billing portal route (`/api/billing/portal`) — manage subscription
- [ ] AI query metering — check `ai_queries_used` vs `ai_queries_limit` before Claude API calls
- [ ] Monthly usage reset via `ai_queries_reset_at`
- [ ] Billing settings page — current plan, usage meter, upgrade/manage buttons
- [ ] Add `estimated_cost` column to `api_usage_log` table

### AI-Assisted Analysis (Phase 2 of processing)
- [ ] Train entity extraction on our reviewed data
- [ ] Automated cross-referencing with confidence scores
- [ ] Anomaly detection (unusual redaction patterns, timeline gaps)
- [ ] Suggested connections based on co-occurrence analysis

### Additional Data Sources
- [ ] Giuffre v. Maxwell court records import
- [ ] House Oversight materials import
- [ ] FOIA release comparison tools
- [ ] Congressional oversight monitoring

### Photo Album & Image Pipeline
- [x] Image extraction pipeline stage (Stage 1.5) — PyMuPDF `page.get_images()`, upload to R2 `images/{doc_id}/`, scan detection (skip >85% page coverage)
- [x] `document_images` table — document_id, page_number, r2_key, thumbnail_r2_key, tags[], caption, metadata JSONB, image_type, is_redacted
- [x] Photo Album page (`/photos`) — global gallery grid, type/tag filters, pagination, lightbox viewer with metadata sidebar
- [x] Entity photo tab — Photos tab on entity detail page (lazy-loaded via API)
- [x] Document images strip — horizontal scrollable thumbnails on document detail page
- [x] Image tagging: entities + locations (junction tables, API endpoints, search-select components, lightbox tagging UI, photos page filters)
- [ ] Image tagging: dates, evidence type, redaction level (future enhancement)

### Rich Entity Profiles
- [x] AI-generated mentions summary (Claude-powered, cached in entity metadata, role distribution chips)
- [x] External sources section on entity profile (news, court records, flight logs from `external_sources` table)
- [x] Wikipedia bio section with cached thumbnail and verification badge
- [x] Profile picture sourcing (Wikipedia thumbnail → `profile_image_url` → initials fallback)
- [x] External sources API route (`GET /api/entities/[id]/sources`)
- [x] News article fetching (Google News RSS → `external_sources`, auto-triggered from entity profile)

### Access Control & Roles
- [x] `profiles` table with `role` column (admin/viewer) + auto-create trigger on signup
- [x] `getUserRole()` server helper + `requireAdmin()` API route guard
- [x] Middleware route guards — viewers redirected from admin paths (/upload, /processing, /review, /assistant, /admin, /settings)
- [x] API guards on mutating endpoints (presign, retry, clear, review PATCH, assistant POST)
- [x] Sidebar hides admin section for viewers, shows role badge
- [x] User management table on `/admin` page with role toggle
- [ ] RLS policy rewrite (future — currently application-layer enforcement only)

### MCP Server Upgrades
- [x] Migration 013: `suspect_watchlist` table + `pg_trgm` extension + `strength` column on `entity_connections` + fuzzy search RPCs
- [x] Split monolithic `tools.ts` (812 lines) into 10 domain modules under `src/tools/`
- [x] Fix 4 critical bugs: `connections` → `entity_connections`, remove `document_cross_references`, remove `entity_evidence_items`, fix `get_schema` RPC fallback
- [x] Standardize all tool responses: `toolResponse()` / `errorResponse()` helpers, `{success, count, total_count, data, message, id}` envelope
- [x] Enhanced `safeJson`: truncation metadata `[TRUNCATION_INFO: {shown_chars, total_chars}]`
- [x] 5 suspect watchlist tools: search, create, update, promote (→ entities), delete (soft/hard)
- [x] 5 entity sighting tools (using existing `entity_sightings` + `locations` tables): search_entity_locations, add_entity_location, find_co_locations, get_location_timeline, find_entities_at_location
- [x] `lookup_person`: unified fuzzy name search across entities + suspects (exact + ilike + pg_trgm trigram)
- [x] `batch_link_entities_to_document`: upsert multiple entity-doc links in one call
- [x] All search tools enhanced with `total_count` and `summary` mode
- [x] All write tools return `{success, id, data, message}` consistently
- [x] `link_entity_to_document` uses upsert (no error on duplicate)
- [x] `get_schema` rewritten with hardcoded `TABLE_INFO` map (purposes + FK relationships)
- [x] Entity/document search uses FTS via `search_vector` with ilike fallback
- [x] `SuspectWatchlist` types added to `@efta/shared`
- [x] Run migration 013 in Supabase SQL Editor
- [x] Deploy updated MCP server
