# EFTA Investigation Platform — Build TODO

> **Update this file as tasks are completed.** Check off items with `[x]`. Add notes on blockers or changes.

---

## Phase 1: Foundation (Target: Week 1)

**Goal:** Working database with DS12 data loaded, basic web interface, auth, deployed to Vercel.

### 1.1 Scaffold & Setup
- [ ] Initialize Turborepo monorepo with pnpm
  ```
  npx create-turbo@latest . --package-manager pnpm
  ```
- [ ] Create Next.js app at `apps/web`
  ```
  pnpm create next-app apps/web --typescript --tailwind --app --src-dir
  ```
- [ ] Create `packages/db/` with `schema.sql` and `package.json`
- [ ] Create `packages/shared/` with TypeScript types matching schema
- [ ] Create `services/worker/` placeholder with `requirements.txt`
- [ ] Create `scripts/` directory with placeholder import scripts
- [ ] Set up `.gitignore` (node_modules, .env*, .next, dist, __pycache__)
- [ ] Create `.env.local.example` with all required variable names
- [ ] Initial commit and push to GitHub

### 1.2 Database Setup
- [ ] Create Supabase project
- [ ] Run `packages/db/schema.sql` in Supabase SQL editor
- [ ] Verify all tables created with correct columns
- [ ] Enable Row Level Security on all tables
- [ ] Create RLS policies (admin full access, anon read for public entities/events)
- [ ] Create database indexes (search vectors, bates_number, entity name, etc.)
- [ ] Set up full-text search triggers on entities and documents
- [ ] Test queries in Supabase dashboard

### 1.3 Supabase Client Integration
- [ ] Install `@supabase/supabase-js` and `@supabase/ssr`
- [ ] Create `lib/supabase/client.ts` (browser client)
- [ ] Create `lib/supabase/server.ts` (server component client)
- [ ] Create `lib/supabase/middleware.ts` (auth middleware)
- [ ] Set up environment variables in `.env.local`
- [ ] Test connection: query entities table from a server component

### 1.4 Cloudflare R2 Setup
- [ ] Create R2 bucket: `efta-documents`
- [ ] Generate API token with read/write
- [ ] Create `lib/r2/client.ts` with upload/download helpers
- [ ] Set up CORS policy for Vercel domain
- [ ] Test: upload and retrieve a test file

### 1.5 Auth
- [ ] Set up Supabase Auth (email/password)
- [ ] Create admin user in Supabase dashboard
- [ ] Build `/login` page with Supabase Auth UI
- [ ] Create auth middleware to protect `/admin/*` routes
- [ ] Test login/logout flow

### 1.6 Base Layout & Design System
- [ ] Install fonts: Playfair Display (display), IBM Plex Sans (body)
- [ ] Set up Tailwind config with custom colors, fonts, spacing
- [ ] Create base layout: dark sidebar nav + main content area
- [ ] Build UI components: (reference `docs/reference/DESIGN_SYSTEM.md`)
  - [ ] TierBadge (color-coded entity tier chip)
  - [ ] SeverityMarker (EXTREME/CRITICAL/HIGH/ROUTINE)
  - [ ] EvidenceStrength (filled dots indicator)
  - [ ] DocumentCard (bates number, date, type, severity)
  - [ ] EntityCard (name, tier, category, status)
  - [ ] DataTable (sortable, filterable table component)
  - [ ] SearchInput
  - [ ] PageHeader
  - [ ] StatCard (for dashboard metrics)

### 1.7 Core Pages (Basic Versions)
- [ ] `/` — Dashboard
  - [ ] Investigation stats (total entities, documents, events, datasets)
  - [ ] Dataset progress bars
  - [ ] Recent findings feed (latest documents/events added)
  - [ ] Open questions list
- [ ] `/entities` — Entity Browser
  - [ ] DataTable with columns: Name, Tier, Category, Status, Documents Count
  - [ ] Filter by: tier, category, dataset
  - [ ] Search by name
  - [ ] Click row → navigate to `/entities/[id]`
- [ ] `/documents` — Document Browser
  - [ ] DataTable with columns: Bates #, Dataset, Type, Date, Severity, Pages
  - [ ] Filter by: dataset, type, severity, processing status
  - [ ] Search by bates number or content
  - [ ] Click row → navigate to `/documents/[id]`
- [ ] `/entities/[id]` — Entity Profile (skeleton)
  - [ ] Name, tier badge, category, status, bio
  - [ ] Placeholder tabs: Evidence, Timeline, Documents, Connections
- [ ] `/documents/[id]` — Document Detail (skeleton)
  - [ ] Metadata display
  - [ ] Placeholder for PDF viewer
  - [ ] Linked entities list

### 1.8 Data Import
- [ ] Create `scripts/import-ds12-entities.ts` — reads entity data, inserts to Supabase
- [ ] Create `scripts/import-ds12-documents.ts` — reads document data, inserts to Supabase
- [ ] Create `scripts/import-ds12-events.ts` — reads timeline data, inserts to Supabase
- [ ] Create `scripts/import-ds12-connections.ts` — reads connections, inserts junction tables
- [ ] Run all import scripts
- [ ] Verify data appears correctly in web UI

### 1.9 Deploy
- [ ] Connect repo to Vercel
- [ ] Set environment variables in Vercel dashboard
- [ ] Deploy and verify live site
- [ ] Test auth on production

---

## Phase 2: Entity Profiles & Timeline (Target: Weeks 2-3)

**Goal:** Deep entity profiles with evidence cases, interactive timeline, document viewer, search.

### 2.1 Entity Profiles
- [ ] Full entity profile page (`/entities/[id]`)
  - [ ] Hero section: name, tier badge, category, status, profile image
  - [ ] Bio/narrative section (compiled from investigation findings)
  - [ ] **Evidence Tab** (non-victims):
    - [ ] Evidence inventory table (type, description, strength, source doc link)
    - [ ] Each evidence item links to the source document
    - [ ] Images/photos displayed inline with captions
    - [ ] Financial evidence with amounts and dates
  - [ ] **Story Tab** (victims, only if `is_public = true`):
    - [ ] Narrative format, not clinical
    - [ ] Privacy notice if entity is protected
  - [ ] **Timeline Tab:**
    - [ ] Per-entity timeline of their involvement
    - [ ] Events linked to source documents
  - [ ] **Documents Tab:**
    - [ ] All documents mentioning this entity
    - [ ] Role in each document (subject, mentioned, author, etc.)
    - [ ] Excerpt/quote from each document
  - [ ] **Connections Tab:**
    - [ ] Mini network graph centered on this entity
    - [ ] List of connections with relationship type and evidence strength
    - [ ] Click any connection → navigate to that entity's profile
  - [ ] **Locations Tab:**
    - [ ] Interactive map with pins at all known locations for this entity
    - [ ] Sighting timeline: date, location, type, source document
    - [ ] Co-location analysis: other entities at same place/time
    - [ ] Movement patterns summary

### 2.2 Document Viewer
- [ ] Inline PDF viewer using `@react-pdf-viewer/core` or `pdf.js`
- [ ] Split-pane layout: PDF on left, metadata on right
- [ ] Metadata panel:
  - [ ] Bates number, dataset, type, date, pages, severity
  - [ ] Forensic metadata (PDF version, pipeline, EOF markers)
  - [ ] Processing status
- [ ] Entities panel: all entities found in this document (clickable)
- [ ] Redactions panel: any redaction analysis for this document
- [ ] Cross-references panel: related documents
- [ ] Upload actual DS12 PDFs to R2 and link in database

### 2.3 Global Timeline
- [ ] Interactive horizontal timeline component
- [ ] Zoomable: year → month → day granularity
- [ ] Events displayed as markers with expandable detail cards
- [ ] Color-coded by event type (legal=blue, evidence=amber, communication=gray, institutional=red, travel=purple, financial=green)
- [ ] **Day View** (click any date for full daily intelligence briefing):
  - [ ] Movements section: where every tracked entity was that day (from entity_sightings)
  - [ ] Events section: all events on that date
  - [ ] Documents section: all documents dated that day
  - [ ] Communications section: emails, texts, calls from that date
  - [ ] Financial section: transactions on that date
  - [ ] Co-locations highlighted: "Entity A and Entity B both at Location X"
- [ ] **Filters:**
  - [ ] By entity (show only events involving selected person)
  - [ ] By event type
  - [ ] By dataset
  - [ ] By severity
  - [ ] Date range picker
- [ ] **Parallel view:** stack 2-3 entities to compare timelines side-by-side
- [ ] Click any event → see source documents
- [ ] Click any entity name → navigate to profile

### 2.4 Search
- [ ] Full-text search page (`/search`)
- [ ] Search across: documents (extracted text), entities (name, bio), events (title, description)
- [ ] Supabase `ts_rank` scoring for relevance
- [ ] Faceted results: tabs for Documents, Entities, Events
- [ ] Filters: dataset, entity type, date range, severity
- [ ] Highlight search terms in results
- [ ] Click any result → navigate to detail page

### 2.5 API Routes
- [ ] `GET /api/entities` — list with filters, pagination, search
- [ ] `GET /api/entities/[id]` — full entity with relations
- [ ] `GET /api/documents` — list with filters, pagination, search
- [ ] `GET /api/documents/[id]` — full document with relations
- [ ] `GET /api/events` — list with filters, pagination
- [ ] `GET /api/search` — unified search across all types
- [ ] `GET /api/stats` — dashboard statistics

---

## Phase 3: Network Graph & Org Chart (Target: Week 4)

**Goal:** Visual relationship mapping, dataset tracking.

### 3.1 Network Graph
- [ ] D3.js force-directed graph (`/network`)
- [ ] Nodes = entities
  - [ ] Sized by evidence count (more evidence = larger node)
  - [ ] Colored by tier (Tier 1=red, Tier 2=amber, etc.)
  - [ ] Labeled with name
- [ ] Edges = entity_connections
  - [ ] Weighted by evidence_strength
  - [ ] Colored by relationship_type
  - [ ] Labeled on hover
- [ ] **Interactions:**
  - [ ] Click node → popup with entity summary + link to profile
  - [ ] Drag nodes to rearrange
  - [ ] Zoom and pan
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

### 3.4 AI Research Assistant (Admin Dashboard)
- [ ] Chat interface in admin sidebar or dedicated `/admin/assistant` page
- [ ] Claude API integration (`claude-sonnet-4-20250514`)
- [ ] System prompt with investigation context, entity tiers, redaction framework
- [ ] Tool use: read-only Supabase queries
  - [ ] Search entities by name, tier, category
  - [ ] Search documents by bates number, content, date range
  - [ ] Query connections for an entity
  - [ ] Query timeline events with filters
  - [ ] Run cross-reference queries (co-occurrence without connection)
  - [ ] Run anomaly queries (under-documented entities, redaction inconsistencies)
- [ ] Actionable suggestions: "Create connection?" → one-click approve writes to DB
- [ ] Conversation history within session
- [ ] Suggested queries based on current page context (e.g., viewing Entity X → "What am I missing about Entity X?")

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
