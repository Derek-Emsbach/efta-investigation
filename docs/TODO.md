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
- [ ] Push to GitHub

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
- [ ] Create R2 bucket: `efta-documents`
- [ ] Generate API token with read/write
- [x] Create `lib/r2/client.ts` with upload/download/delete helpers (S3-compatible via `@aws-sdk/client-s3`)
- [ ] Set up CORS policy for Vercel domain
- [ ] Test: upload and retrieve a test file

> **Blocked:** User needs to create R2 bucket and API token. Client code is written.

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
- [ ] Push to GitHub
- [ ] Connect repo to Vercel
- [ ] Set environment variables in Vercel dashboard
- [ ] Deploy and verify live site
- [ ] Test auth on production

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
  - [ ] By entity (show only events involving selected person)
  - [ ] By dataset
  - [ ] By severity
  - [ ] Date range picker
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
- [ ] Filters: dataset, entity type, date range, severity
- [ ] Highlight search terms in results

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
  - [ ] Filter by tier, relationship type, time period
  - [ ] Search to highlight specific entity
  - [ ] "Find path between" — highlight shortest connection path between two entities
- [ ] **Clusters:** automatic grouping by relationship density

### 3.2 Org Chart / Hierarchy
- [ ] Tree layout for institutional/business relationships (`/hierarchy`)
- [ ] Shell companies and trusts as nodes
- [ ] Ownership/employment relationships as edges
- [ ] Money flows indicated by edge labels
- [ ] Properties as location nodes
- [ ] Agencies (FBI, SDNY, DANY, CRU) as institutional nodes
- [ ] Toggle between: business hierarchy, institutional hierarchy, property network

### 3.3 Dataset Progress
- [ ] Dataset overview page (`/datasets`)
- [ ] Card per dataset: name, size, file count, progress bar, priority badge
- [ ] Click card → filtered document list for that dataset
- [ ] Summary stats: total files, reviewed, critical findings per dataset

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
- [ ] Actionable suggestions: "Create connection?" → one-click approve writes to DB
- [ ] Suggested queries based on current page context
- [ ] Conversation persistence (save/load chat history)

---

## Phase 4: Processing Pipeline (Target: Weeks 5-6)

**Goal:** Automated document ingestion and analysis with human review.

### 4.1 Python Worker
- [ ] FastAPI server in `services/worker/`
- [ ] Supabase client for Python
- [ ] R2 client for Python (boto3 with S3-compatible endpoint)
- [ ] Pipeline stages:
  - [ ] `ingest.py` — unpack zip, create document records, upload originals to R2
  - [ ] `forensics.py` — PDF metadata extraction (version, pipeline, EOF, permissions)
  - [ ] `extract.py` — text extraction (PyMuPDF) + image rendering (200 DPI) + OCR fallback
  - [ ] `entities.py` — name detection, match against existing entity DB, flag new names
  - [ ] `redactions.py` — detect redacted regions, estimate coverage, classify A-D
  - [ ] `crossref.py` — match dates, names, case numbers against existing documents
  - [ ] `classify.py` — document type classification, evidence value scoring, priority flagging
- [ ] Each stage updates document `processing_status` in Supabase
- [ ] Queue management: process one document at a time, report progress
- [ ] Error handling: failed documents marked with error message, retryable

### 4.2 Admin Upload UI
- [ ] `/admin/processing` page
- [ ] Upload zone: drag-and-drop zip file or folder
- [ ] Google Drive URL input (for large datasets)
- [ ] Real-time processing queue dashboard
  - [ ] Total documents in queue
  - [ ] Currently processing (which document, which step)
  - [ ] Completed count
  - [ ] Failed count (with error details)
- [ ] Per-document status cards with progress indicators

### 4.3 Admin Review UI
- [ ] `/admin/review` page
- [ ] Queue of documents with `status = 'needs_review'`
- [ ] Split-pane review interface:
  - [ ] Left: PDF viewer
  - [ ] Right: extracted data (entities found, classifications, redactions, cross-refs)
- [ ] Review actions:
  - [ ] Confirm/edit entity matches
  - [ ] Adjust tier assignments
  - [ ] Add/edit evidence items
  - [ ] Add connections
  - [ ] Flag redactions
  - [ ] Add review notes
  - [ ] Mark as reviewed → publishes to frontend
- [ ] Keyboard shortcuts for fast review

### 4.4 Tiered Processing
- [ ] **Tier A (automatic, all documents):**
  - [ ] Metadata extraction
  - [ ] Text extraction
  - [ ] File size, page count, PDF version
  - [ ] Upload to R2
  - [ ] Basic document type classification
- [ ] **Tier B (AI-assisted, flagged documents):**
  - [ ] Entity name extraction
  - [ ] Redaction detection and classification
  - [ ] Cross-reference matching
  - [ ] Evidence value scoring
- [ ] **Tier C (human review, high-value documents):**
  - [ ] Full forensic analysis
  - [ ] Manual entity verification
  - [ ] Evidence item creation
  - [ ] Connection mapping
  - [ ] Narrative writing (for entity profiles)
- [ ] Priority scoring algorithm:
  - [ ] File size > 10 pages = +2 priority
  - [ ] Known entity names detected = +3 priority
  - [ ] Redaction density > 30% = +2 priority
  - [ ] Document type = prosecution memo or FBI 302 = +5 priority

### 4.5 Deploy Worker
- [ ] Create Dockerfile for Python worker
- [ ] Deploy to Railway
- [ ] Set environment variables (Supabase URL/key, R2 credentials)
- [ ] Test: upload DS12 zip, verify processing

---

## Phase 5: Polish & Scale (Target: Weeks 7-8)

**Goal:** Production-ready, visually striking, performant.

### 5.1 Visual Design Pass
- [ ] Full dark theme implementation
- [ ] Custom loading states and skeleton screens
- [ ] Micro-animations: page transitions, data updates, hover effects
- [ ] Empty states for pages with no data
- [ ] Error states with helpful messages
- [ ] Responsive layout (works on tablet, graceful on mobile)
- [ ] Favicon and meta tags

### 5.2 Performance
- [ ] Database indexes audit (EXPLAIN ANALYZE on common queries)
- [ ] Pagination on all list pages (cursor-based for large tables)
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

### Public Access
- [ ] Toggle pages from private to public
- [ ] Public entity profiles (non-victim, non-sensitive)
- [ ] Public timeline
- [ ] SEO optimization for public pages

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
