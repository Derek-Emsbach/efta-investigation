# The Epstein Record — Implementation Plan

**From Design Templates to Production Platform**

Created: February 26, 2026
Status: Planning
Stack: Next.js 16, React 19, Tailwind v4, Supabase PostgreSQL, Cloudflare R2

---

## Current State

**What exists:**
- Next.js app deployed at `efta-investigation.vercel.app` with entity browser, document viewer, timeline, AI assistant panel
- Supabase: 20 tables, 99 entities, 7,435 documents, 63 events, 50+ connections
- MCP server: 58 tools, corpus search (1.38M docs), redaction analysis (2.59M records)
- Cloudflare R2: Full extracted text + images for 7,435 documents
- SQLite corpus: 6.08 GB full-text, 0.95 GB redaction analysis

**What we designed (5 HTML prototypes):**
1. Homepage — editorial front page
2. Story Page — investigative article with inline evidence
3. Entity Profile — dossier-style person page
4. Case File Report — formal investigation report
5. Evidence Room — dark-mode research interface

**The gap:** The existing dashboard is a functional investigation tool. The new designs transform it into a public-facing investigative publication. This isn't a reskin — it's a fundamentally different information architecture layered on top of the same data.

---

## Architecture Decision: Dual-Mode App

Rather than replacing the existing dashboard, add the publication layer alongside it.

```
efta-investigation.vercel.app/
├── /                          → NEW: The Epstein Record homepage
├── /stories/[slug]            → NEW: Story pages (Layer 1)
├── /case-files/[id]           → NEW: Case file reports (Layer 2)
├── /entities/[slug]           → REBUILD: Entity profiles (new design)
├── /evidence/                 → NEW: Evidence Room (Layer 3)
│   ├── /evidence/documents    → Document search
│   ├── /evidence/entities     → Entity browser
│   ├── /evidence/redactions   → Redaction analyzer
│   ├── /evidence/timeline     → Timeline explorer
│   └── /evidence/network      → Network graph
├── /dashboard/                → EXISTING: Move current pages here
│   ├── /dashboard/entities    → Current entity browser
│   ├── /dashboard/documents   → Current document viewer
│   ├── /dashboard/timeline    → Current timeline
│   └── /dashboard/assistant   → AI assistant panel
└── /api/                      → EXISTING: API routes (shared)
```

**Why dual-mode:** The dashboard is your investigation workbench — raw, fast, functional. The publication is the public-facing output. Same data, different presentation layers. Both need to coexist.

---

## Database Schema Additions

New tables needed for the publication layer:

```sql
-- Stories (Layer 1 editorial content)
CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  kicker TEXT,                    -- Section label: "Follow the Money", "The Cover-Up", etc.
  section TEXT NOT NULL,           -- money, coverup, network, operation, voices
  body_mdx TEXT NOT NULL,          -- MDX content with evidence components
  featured_image_url TEXT,
  author TEXT DEFAULT 'EFTA Investigation Team',
  status TEXT DEFAULT 'draft',     -- draft, published, archived
  published_at TIMESTAMPTZ,
  case_file_id UUID REFERENCES case_files(id),  -- Link to Layer 2
  meta JSONB DEFAULT '{}',         -- SEO, OG tags, etc.
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Story-Entity junction (which entities appear in which stories)
CREATE TABLE story_entities (
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  mention_count INT DEFAULT 1,
  PRIMARY KEY (story_id, entity_id)
);

-- Story-Document citations (inline evidence references)
CREATE TABLE story_citations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id),
  efta_number TEXT,
  citation_index INT,              -- Position in story (1, 2, 3...)
  description TEXT,                -- "DANY Financial Summary — $158M payment timeline"
  page_ref TEXT                    -- Specific page reference
);

-- Case Files (Layer 2 investigation reports)
CREATE TABLE case_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_number TEXT UNIQUE NOT NULL,  -- EFTA-IR-2026-004
  title TEXT NOT NULL,
  subtitle TEXT,
  dataset_id INT REFERENCES datasets(id),
  body_mdx TEXT NOT NULL,
  status TEXT DEFAULT 'active',     -- active, complete, archived
  sessions TEXT[],                  -- ['1','2','3','4']
  date_range TEXT,                  -- 'Feb 5-6, 2026'
  completion_pct DECIMAL,
  docs_reviewed INT,
  docs_total INT,
  bates_start TEXT,
  bates_end TEXT,
  findings_extreme INT DEFAULT 0,
  findings_critical INT DEFAULT 0,
  findings_high INT DEFAULT 0,
  findings_routine INT DEFAULT 0,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Case File-Entity junction
CREATE TABLE case_file_entities (
  case_file_id UUID REFERENCES case_files(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  role TEXT,                        -- 'primary_subject', 'mentioned', 'investigator'
  PRIMARY KEY (case_file_id, entity_id)
);

-- Open Questions (tracked across case files)
CREATE TABLE open_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id TEXT UNIQUE NOT NULL,  -- OQ-01, OQ-02...
  question TEXT NOT NULL,
  context TEXT,
  priority TEXT DEFAULT 'high',
  status TEXT DEFAULT 'open',       -- open, investigating, resolved
  case_file_id UUID REFERENCES case_files(id),
  efta_numbers TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Entities table additions** (ALTER existing):
```sql
ALTER TABLE entities ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS financial_summary JSONB;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS profile_published BOOLEAN DEFAULT false;
```

---

## Implementation Phases

### Phase 0: Foundation (1-2 sessions)
**Goal:** Set up the dual-mode routing and shared design system.

- [ ] Run database migrations (new tables above)
- [ ] Generate slugs for existing entities
- [ ] Create the shared design system as a Tailwind config + CSS variables file matching our prototypes
- [ ] Set up font loading (Playfair Display, Source Serif 4, DM Sans, JetBrains Mono)
- [ ] Move existing dashboard pages under `/dashboard/` prefix
- [ ] Create layout components:
  - `PublicationLayout` — warm paper theme, editorial header/footer
  - `EvidenceRoomLayout` — dark theme, terminal header
  - `DashboardLayout` — existing (preserved)
- [ ] Build shared components:
  - `TierBadge` — entity tier indicator (colored dots + labels)
  - `EFTADocLink` — inline document reference with hover preview
  - `EntityMention` — gold-underlined entity name with hover card
  - `RedactionBlock` — visible redaction placeholder with category
  - `SectionLabel` — "Follow the Money", "The Cover-Up", etc.

### Phase 1: Entity Profiles (2-3 sessions)
**Goal:** Replace existing entity browser with the new dossier-style profiles.

**Why first:** Entity profiles are the connective tissue. Every story, case file, and document links back to entities. Building these first gives you navigation targets for everything else.

- [ ] Build `/entities/[slug]/page.tsx` with tab-based layout
- [ ] Components needed:
  - `EntityHero` — name, tier badge, role, summary, stats row
  - `DossierCard` — sidebar structured data card
  - `EvidenceTimeline` — chronological evidence entries with type badges
  - `FinancialSummaryCard` — grid of financial data (entity-specific)
  - `ConnectionsGrid` — linked entity cards with tier dots and strength
  - `EntityStories` — list of stories mentioning this entity
  - `EntityCaseFiles` — investigation reports involving this entity
  - `EntityDocuments` — sortable document table
  - `EntityTimeline` — date-ordered events
  - `TierExplanation` — contextual tier methodology box
- [ ] API routes:
  - `GET /api/entities/[slug]` — full entity with connections, docs, events
  - `GET /api/entities/[slug]/documents` — paginated docs for entity
  - `GET /api/entities/[slug]/stories` — stories mentioning entity
- [ ] Data pipeline: Populate `financial_summary` JSONB for Leon Black (pilot entity)
- [ ] Generate entity slugs from names (leon-black, jeffrey-epstein, etc.)

### Phase 2: Case File Reports (2 sessions)
**Goal:** Build the Layer 2 investigation report template.

- [ ] Build `/case-files/[id]/page.tsx`
- [ ] Components:
  - `CaseFileCover` — manila background, metadata grid, watermark stamp
  - `FindingsSummaryTable` — severity breakdown with color-coded badges
  - `EvidenceCatalog` — grid of categorized evidence items
  - `ProsecutorialTimeline` — timeline with failure-node highlighting
  - `EntityRoster` — grid of identified persons with tier badges
  - `OpenQuestions` — amber-bordered lead cards
  - `ReportSidebar` — sticky nav, session info, linked stories, downloads
- [ ] Seed initial case file: EFTA-IR-2026-004 (DS12 complete analysis)
- [ ] API routes:
  - `GET /api/case-files/[id]` — full report with entities, questions
  - `GET /api/case-files` — list all case files with status
- [ ] Content: Convert DS12 Complete Analysis docx into structured case file data

### Phase 3: Evidence Room (3-4 sessions)
**Goal:** Build the dark-mode research interface with full-text search.

This is the heaviest lift because it needs to connect to the SQLite corpus (1.38M docs).

**Architecture decision:** The SQLite databases (6+ GB) can't run in Vercel serverless. Options:

1. **Proxy through MCP server** — Evidence Room calls your MCP server (on Railway, once deployed) for corpus queries. MCP already has the 5 corpus tools. Clean separation.
2. **Separate search API** — Deploy a lightweight Express/Fastify service on Railway that wraps the SQLite corpus and exposes REST endpoints. Evidence Room calls this.
3. **Supabase full-text search** — Migrate the most-accessed corpus data into Supabase with `tsvector` FTS. Limited to curated subset, not full 1.38M.

**Recommended: Option 1 (MCP proxy)** for now, **Option 2 (dedicated search service)** for production scale. Option 1 gets you running immediately using infrastructure you already have.

- [ ] Build `/evidence/page.tsx` — main search interface
- [ ] Build `/evidence/documents/page.tsx` — document search
- [ ] Components:
  - `SearchBar` — full-text input with filter chips
  - `FacetPanel` — left sidebar with dataset, type, entity, redaction category filters
  - `ResultCard` — document result with EFTA number, type badge, excerpt with highlighting, entity dots, redaction count
  - `DocumentPreview` — right sidebar with metadata, extracted text, entities, redaction analysis, action buttons
  - `StatsBar` — corpus-wide metrics (1.38M docs, 2.77M pages, etc.)
- [ ] API routes:
  - `GET /api/evidence/search` — proxies to corpus search (MCP or dedicated service)
  - `GET /api/evidence/document/[efta]` — full document text + metadata
  - `GET /api/evidence/facets` — aggregate counts for filter UI
- [ ] **Prerequisite: Deploy MCP server to Railway** (ENH-05 from TODO list). Without this, Evidence Room has no search backend on Vercel.

### Phase 4: Story Pages (2 sessions)
**Goal:** Build the editorial article template with inline evidence mechanics.

- [ ] Build `/stories/[slug]/page.tsx`
- [ ] Components:
  - `StoryHero` — headline, kicker, byline, date, reading time
  - `InlineCitation` — red numbered circle, hover reveals EFTA doc + description
  - `InlineEntityMention` — gold underline, hover shows tier + role + doc count
  - `DocumentEmbed` — rendered card with EFTA number and redactions
  - `RedactionAnalysisBlock` — dark background showing Category D analysis
  - `KeyFindingBox` — highlighted conclusion callout
  - `DataCallout` — oversized statistic with context
  - `PullQuote` — styled quote with attribution
  - `StorySidebar` — TOC, source case file, documents cited, people in story
  - `MethodologyNote` — footer disclosure
- [ ] Content system: MDX with custom components for evidence markup
  - `<Citation index={1} efta="02731623" desc="DANY Financial Summary" />`
  - `<Entity name="Leon Black" tier={3} />`
  - `<Redacted category="D">dollar amount</Redacted>`
- [ ] Seed pilot story: "$158 Million" Leon Black financial relationship
- [ ] API routes:
  - `GET /api/stories/[slug]` — full story with citations + entities
  - `GET /api/stories` — list by section, paginated

### Phase 5: Homepage (1-2 sessions)
**Goal:** Build the editorial front page pulling everything together.

**Why last:** The homepage is an aggregation surface. It needs stories, case files, entities, and the Evidence Room to exist before it can link to them.

- [ ] Build `/page.tsx` (replace current landing)
- [ ] Components:
  - `Masthead` — branding, date, edition info
  - `BreakingNewsTicker` — latest findings with live indicator
  - `HeroStoryGrid` — main story + sidebar latest
  - `InvestigationStats` — 3.5M pages, 97+ entities, etc.
  - `SectionGrid` — stories organized by section (Network, Money, Cover-Up, etc.)
  - `FeaturedInvestigation` — promo card for deep-dive feature
  - `CaseFilesPreview` — latest investigation reports with status badges
  - `TimelinePreview` — critical events strip
  - `EntitySpotlight` — featured entity cards
  - `EvidenceRoomPromo` — search CTA
- [ ] API routes:
  - `GET /api/homepage` — aggregated data: latest stories, case files, stats, featured entities

### Phase 6: Polish & Integration (1-2 sessions)
- [ ] Cross-linking verification: every entity mention links to profile, every EFTA number links to Evidence Room, every story links to case file
- [ ] Responsive testing across all 5 templates
- [ ] SEO: Open Graph tags, structured data (Article, Person, Dataset)
- [ ] Performance: Image optimization, lazy loading, code splitting
- [ ] Analytics: Basic page view tracking
- [ ] 404/error pages in publication style
- [ ] "Back to Newsroom" / "Enter Evidence Room" transition animations

---

## Prerequisite: Infrastructure Tasks

These need to happen before or during Phase 0:

| Task | Blocks | Effort | Notes |
|------|--------|--------|-------|
| Deploy MCP server to Railway | Phase 3 (Evidence Room search) | 1 session | ENH-05. Need OAuth too for production. |
| Sync DB entities (99 → 127) | Phase 1 (Entity Profiles need complete data) | 30 min | ENH-08. Import v2.1/v2.2 addendum entities. |
| Seed stories + case_files tables | Phase 4-5 (need content to display) | 1 session | Convert existing analysis docs into structured records. |
| MDX setup in Next.js | Phase 4 (Story pages) | 30 min | `next-mdx-remote` or `@next/mdx` for custom components. |

---

## Content Pipeline (Ongoing)

The platform is only as good as what's in it. Design is done. Data exists. The bridge is turning investigation findings into publishable content:

```
Investigation session
  → Findings documented (MCP tools update DB)
    → Case file report created/updated
      → Newsworthy items written as stories (MDX)
        → Entity profiles auto-update (DB-driven)
          → Homepage reflects latest state
```

**First content to seed:**
1. Case File: EFTA-IR-2026-004 (DS12 — already written as docx)
2. Story: "$158 Million" (Leon Black financial relationship)
3. Entity Profiles: Leon Black, Jeffrey Epstein, Ghislaine Maxwell (highest doc counts)
4. Open Questions: OQ-01 through OQ-05 (already documented)

---

## Estimated Timeline

| Phase | Sessions | Calendar (est.) | Dependencies |
|-------|----------|-----------------|--------------|
| Phase 0: Foundation | 1-2 | Week 1 | None |
| Phase 1: Entity Profiles | 2-3 | Week 1-2 | Phase 0 |
| Phase 2: Case Files | 2 | Week 2 | Phase 0 |
| Phase 3: Evidence Room | 3-4 | Week 2-3 | Phase 0 + Railway deploy |
| Phase 4: Stories | 2 | Week 3 | Phase 0 + MDX setup |
| Phase 5: Homepage | 1-2 | Week 3-4 | Phases 1-4 |
| Phase 6: Polish | 1-2 | Week 4 | All |
| **Total** | **12-17 sessions** | **~4 weeks** | |

This assumes focused sessions on the publication build. Investigation work (DS9 review, etc.) runs in parallel on separate sessions.

---

## Risk Factors

**SQLite corpus on Vercel.** Vercel's serverless can't host 6+ GB SQLite databases. The Evidence Room search MUST proxy through an external service. Railway deployment (ENH-05) is the critical path blocker.

**Content creation bottleneck.** The design and infrastructure can move fast. Writing stories and populating case files requires editorial effort. Consider: start with auto-generated entity profiles (DB-driven) and case file skeletons, then layer in editorial content.

**Scope creep.** Five templates is already ambitious. Resist adding new page types until these five are solid. The design system is flexible enough to extend later.

**Dual-mode complexity.** Running two frontends (dashboard + publication) in one app adds routing complexity. Keep them cleanly separated with distinct layouts and don't share UI components between modes.

---

## Decision Points

Before starting, lock these down:

1. **Domain:** Keep `efta-investigation.vercel.app` or set up `theepsteinrecord.com`?
2. **Auth:** Is the publication fully public, or does the Evidence Room need login?
3. **Railway timing:** Deploy MCP server first (blocks Evidence Room), or build other pages first?
4. **Content format:** MDX for stories (developer-friendly) or a CMS-like editor in the dashboard (author-friendly)?
5. **Entity sync:** Import the 28 missing entities before or during Phase 1?

---

*This is a working document. Update as implementation progresses.*
