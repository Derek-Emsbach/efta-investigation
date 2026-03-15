# EFTA Investigation Platform

## What This Is

A full-stack investigative research platform for the Epstein Files Transparency Act (EFTA) document releases. We are systematically analyzing ~3.5 million pages of DOJ disclosures to uncover operational patterns, evidence of prosecutorial failures, and accountability gaps. This platform replaces manual project files with a searchable, linked, visual database.

## Current Phase

Check `docs/TODO.md` for the current build phase and task list. Always read it before starting work.

## Tech Stack

| Component | Technology | Hosting |
|-----------|-----------|---------|
| Frontend | Next.js 16 (App Router, TypeScript, React 19) | Vercel |
| Styling | Tailwind CSS v4 + custom design system | - |
| Database | PostgreSQL via Supabase | Supabase Cloud |
| File Storage | Cloudflare R2 | Cloudflare |
| Auth | Supabase Auth | Supabase Cloud |
| Search | Supabase Full-Text Search | Supabase Cloud |
| Processing Worker | Python (PyMuPDF polling script) | Railway |
| Monorepo | Turborepo + pnpm 10 | - |
| Visualization | D3.js (graphs), custom React (timelines) | Client-side |
| PDF Viewing | react-pdf (PDF.js worker served from public/) | Client-side |
| AI (Detective) | Claude API with tool use (Supabase queries) | Anthropic API |
| AI (Archer) | Claude API with prompt caching + streaming SSE | Anthropic API |

## Repository Structure

```
efta-investigation/
  apps/
    web/                          # Next.js frontend
      public/                     # Static assets (PDF.js worker, favicon)
      src/
        app/                      # App Router
          (publication)/          # Public pages (warm paper theme, no auth)
            page.tsx              # Homepage (theepsteincrimes.com)
            entities/[slug]/      # Public entity dossier profiles
            stories/[slug]/       # Editorial story articles
            case-files/[slug]/    # Manila-themed case file reports
          (evidence)/             # Public evidence room (dark theme, no auth)
            evidence/             # Tabbed workspace (inner layout with Search/Entities/Network/Timeline tabs)
              entities/           # Entity directory (filterable table)
              entities/[slug]/    # Entity evidence profile (connections, docs, timeline, stories)
              network/            # D3 network graph (public API, path finder)
              timeline/           # Chronological event timeline (public API)
          (legal)/                # Legal pages (minimal layout)
            about/ disclaimer/ terms/ privacy/
          dashboard/              # Auth-protected dashboard (existing dark theme)
            review/               # Document review (3-column: queue | PDF | Archer)
            assistant/            # AI detective assistant
            upload/               # Document upload
            processing/           # Processing pipeline dashboard
            entities/[id]/        # Dashboard entity profiles (by UUID)
            documents/[id]/       # Document viewer
            timeline/             # Event timeline
            search/               # Full-text search
            network/              # Network graph
            datasets/             # Dataset browser
            hierarchy/            # Entity hierarchy
          api/                    # API routes
            public/               # Public API (rate-limited, service role key)
              entities/           # Published entities list + [slug] detail
              stories/            # Published stories list + [slug] detail
              case-files/         # Published case files list + [slug] detail
              evidence/           # Evidence search + stats
              homepage/           # Aggregated homepage data
            review/archer/        # Archer SSE streaming endpoint
            assistant/            # Detective chat endpoint
            upload/               # Presigned URL generation
          login/                  # Standalone login page
        components/               # React components
          ui/                     # Design system (breadcrumbs, theme-toggle)
          layout/                 # Sidebar, footer, mobile toggle
          publication/            # Public site components (~25)
            entity/               # EntityHero, DossierCard, TierBadgePub, etc.
            story/                # StoryHero, StorySidebar, ReadingProgress, etc.
            case-file/            # CaseFileCover, EntityRoster, OpenQuestions, etc.
            home/                 # Masthead, StoryGrid, EntitySpotlight, etc.
          evidence-room/          # EvidenceHeader, SearchInterface, StatsBar
          review/                 # Archer panel, PDF viewer
          timeline/
          entity/
          network/
          documents/
        lib/                      # Utilities
          supabase/               # Server + client Supabase helpers
          ai/                     # AI prompts (archer-prompt, system-prompt, tools)
          r2/                     # Cloudflare R2 presigned URLs
          rate-limit.ts           # In-memory sliding window rate limiter
          markdown-renderer.tsx   # Custom Markdown → React (citations, entities, etc.)
  packages/
    db/                           # Schema + migrations (016 = publication tables)
    shared/                       # Shared types + constants (@efta/shared)
  services/
    worker/                       # Python processing worker (polling script)
      stages/                     # Pipeline stages (classify, entities, crossref, redactions)
    efta-mcp-server/              # MCP server (58 tools, Express + SDK, port 3001)
  scripts/                        # Import + migration + investigation scripts
  docs/
    reference/                    # Architecture + domain reference
    investigation/                # Investigation findings + context
      threads/                    # 6 investigation thread reports
      sources/                    # Deep-read case files (EFTA*/Analysis.md)
      data/                       # Reference data (ENTITIES.md, TIMELINE.md)
    stories/                      # Story markdown files (6 published + growing)
    STORY_QUEUE.md                # Story backlog, workflow, quality checklist
```

## Critical Rules

### Design
- **Three visual themes** via `data-theme` attribute on layout wrappers:
  - **Dashboard** (default dark): #0A0E17 base, #111827 content, #1F2937 elevated. Playfair Display headings, IBM Plex Sans body.
  - **Publication** (`data-theme="publication"`): #faf8f5 cream paper. Source Serif 4 body, DM Sans UI, Playfair Display headings. Gold accent #b8860b.
  - **Manila** (`data-theme="manila"`): #f2ead8 manila paper. Case file reports with stamp watermarks.
  - **Evidence Room** (`data-theme="evidence-room"`): #0d0f11 deep dark. JetBrains Mono throughout, neon accents.
- Dashboard aesthetic: ProPublica meets intelligence briefing. NEVER use generic AI dashboard aesthetics (no purple gradients, no Inter font, no rounded pastel cards).
- Critical red: #DC2626 (dashboard) / #c41e3a (publication) / #e63950 (evidence room)
- **Tailwind v4**: Theme is defined in CSS via `@theme {}` in `globals.css`, NOT in `tailwind.config.ts`. **NEVER use `@theme inline`** — it hardcodes values and breaks multi-theme switching. Use semantic Tailwind classes (`bg-background`, `bg-ink`, `text-text-primary`, `font-sans`, `font-display`). Never use arbitrary value syntax for tokens that exist in `@theme` (no `bg-[#1a1a1a]`, no `font-[var(--font-sans)]`). See `docs/reference/DESIGN_SYSTEM.md` for full styling rules.

### Data Integrity
- Every claim needs a source document. Evidence items link to document records which link to R2 file URLs.
- Entity tier assignments (1-6) reflect evidence strength, NOT guilt. See `docs/reference/ENTITY_TIERS.md`.
- Victim privacy: never expose victim identity unless `is_public = true` on the entity record.
- Redaction categories (A-D) are defined in `docs/reference/REDACTION_FRAMEWORK.md`.

### Database
- Full schema is in `packages/db/schema.sql` — always reference it for table structures.
- Use UUID primary keys everywhere.
- Use JSONB `metadata` fields for flexible/evolving attributes.
- Full-text search via `search_vector` TSVECTOR columns + GIN indexes.
- Row Level Security enabled on all tables.

### Code Style
- TypeScript strict mode, no `any` types.
- Server Components by default, Client Components only when needed (interactivity).
- API routes in `app/api/` for data fetching.
- Supabase client: server-side via `@supabase/ssr`, client-side via `@supabase/supabase-js`.
- All database queries go through `lib/supabase/` helpers, never raw SQL in components.
- **Next.js 16**: Route params are `Promise` — must `await params` in route handlers and dynamic pages.
- Import shared types from `'@efta/shared'`, not deep paths into the package.

### Git Workflow
- Commit after every meaningful step.
- Commit messages: `phase-X: description` (e.g., `phase-1: scaffold monorepo and database schema`)
- Never commit .env files or API keys.
- Push to main triggers Vercel auto-deploy.

### Session Bookkeeping
After completing any task (feature, fix, or refactor):
1. **Update `docs/TODO.md`** — check off completed items, add new items discovered during work, update the phase status summary if significant progress was made.
2. **Update memory** — if the work revealed stable patterns, gotchas, or architectural decisions worth remembering, update the auto memory files. Memory is split into topic files: `MEMORY.md` (index), `technical-notes.md`, `investigation-tracker.md`, `completed-work.md`, `session-log.md`. Only record things that are confirmed and likely to stay relevant across sessions.
3. **Write a story (if applicable)** — if the session produced publishable investigation findings, write a story for The Epstein Crimes following the 7-step workflow and quality checklist in `docs/STORY_QUEUE.md`. Update the queue (move from "Ready to Write" → "Published").
4. **Update case files (if applicable)** — if the session produced investigation findings that relate to an existing case file (see Case File Mapping in `docs/STORY_QUEUE.md`), note the case file ID and findings in TODO.md. When publishing a new story, always assign its `case_file_slug`. If a new topic emerges with enough evidence, create a new case file thread (see `docs/investigation/threads/` for format).
5. **Update timeline (if applicable)** — if the session uncovered datable events, add them to the timeline:
   - **Real-world developments** (arrests, DOJ actions, legislative events): use `create_public_event` MCP tool
   - **Investigation findings** (document-evidenced events): use `create_event` + `link_entity_to_event`
   - **IMPORTANT: No per-entity duplicate events.** If an event involves multiple entities (e.g., "NPA signed"), create ONE event and link all entities via `link_entity_to_event`. Never create separate copies of the same event for each person involved.
   - Before creating an event, use `search_events` to check it doesn't already exist.
6. **Context checkpoint** — when approaching ~90% context compaction (system will warn), proactively:
   - Update `docs/TODO.md` with any completed or discovered items
   - Update memory files with new patterns, gotchas, or investigation findings from the session
   - Update `CLAUDE.md` if any structural changes were made (new routes, tables, tools)
   - Add a session entry to `memory/session-log.md` summarizing what was done
   - Summarize current work-in-progress so the continuation prompt has full context

## Reference Documents

Before building any feature, read the relevant reference doc:

| Doc | Purpose | Read Before |
|-----|---------|-------------|
| `docs/TODO.md` | Current tasks and progress | Every session |
| `docs/reference/ARCHITECTURE.md` | Full system architecture | Any structural work |
| `docs/reference/DATABASE_SCHEMA.md` | Schema details + relationships | Any database work |
| `docs/reference/DESIGN_SYSTEM.md` | Colors, typography, components | Any UI work |
| `docs/reference/ENTITY_TIERS.md` | 6-tier classification system | Entity features |
| `docs/reference/REDACTION_FRAMEWORK.md` | A-D redaction categories | Redaction features |
| `docs/STORY_QUEUE.md` | Story backlog, workflow, quality checklist | Writing stories |
| `docs/reference/PROCESSING_PIPELINE.md` | Document ingestion pipeline | Worker/processing features |
| `docs/reference/WORKFLOW.md` | How data flows: 3 workflows, auto-approve rules, session checklist | Any data import/update work |
| `docs/reference/LOCATION_INTELLIGENCE.md` | Location tracking, entity sightings, day-view timeline, co-location queries | Timeline, location, sighting features |
| `docs/reference/INVESTIGATION_CONTEXT.md` | What this investigation is about | Understanding domain |
| `docs/investigation/data/DS12_SUMMARY.md` | Dataset 12 complete findings | Importing DS12 data |
| `docs/investigation/archive/LEON_BLACK_CASE.md` | Leon Black prosecution failure | Key investigation thread |
| `docs/investigation/data/ENTITIES.md` | All identified entities | Entity import/profiles |
| `docs/investigation/data/TIMELINE.md` | All timeline events | Timeline import |
| `docs/investigation/data/TIMELINE.md` | All timeline events | Timeline import |
| `packages/db/schema.sql` | The actual SQL schema | Database work |

## Key Domain Concepts

- **EFTA**: Epstein Files Transparency Act — the law requiring DOJ to release these files
- **Bates Number**: Unique document identifier (e.g., EFTA02731623)
- **Dataset**: One of 12 numbered collections released by DOJ
- **Entity Tier**: Evidence-strength classification (1=direct evidence through 6=peripheral)
- **Redaction Category**: A=victim protection, B=legal privilege, C=institutional protection, D=perpetrator protection
- **The Five Systems**: Recruitment Pipeline, Logistics Network, Financial Infrastructure, Protection Apparatus, Inner Circle
- **NPA**: 2007 Non-Prosecution Agreement that gave blanket immunity to co-conspirators

## Public API Routes

All public API routes live at `/api/public/*` and share these patterns:
- Use `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS, filters to `is_published`/`profile_published`)
- Rate-limited via `lib/rate-limit.ts`: 120 req/min general, 60 req/min for evidence search
- In-memory caching with TTL (2-min homepage, 5-min search, 10-min stats)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/public/entities` | GET | List published entities |
| `/api/public/entities/[slug]` | GET | Entity profile with connections, docs, events |
| `/api/public/stories` | GET | List published stories (optional `?section=` filter) |
| `/api/public/stories/[slug]` | GET | Story with citations, entities, case file link |
| `/api/public/case-files` | GET | List published case files |
| `/api/public/case-files/[slug]` | GET | Case file with entities, open questions |
| `/api/public/evidence/search` | GET | Full-text search (60/min rate limit) |
| `/api/public/evidence/stats` | GET | Corpus aggregate counts |
| `/api/public/homepage` | GET | Aggregated homepage data |
| `/api/public/timeline` | GET | Public timeline events with published entity links |
| `/api/public/network` | GET | Network graph nodes/edges (published entities) |
| `/api/public/documents/[bates]` | GET | Document detail by Bates number (metadata, entities, events, images, citations, redaction summary) |
| `/api/public/images/[id]/file` | GET | Proxy full-size document image from R2 |
| `/api/public/images/[id]/thumbnail` | GET | Proxy thumbnail document image from R2 |

## AI Assistants

### Detective (Research Assistant)

General-purpose research assistant on the `/detective` page. Has read-only access to the full Supabase database and can:
- Query documents, entities, events, and connections to answer research questions
- Surface missed connections (entity co-occurrence without connection records)
- Detect anomalies (inconsistent redactions, timeline gaps, under-investigated entities)
- Assemble evidence summaries for entity profiles
- Suggest new connections, tier changes, and investigation threads (user approves with one click)

Built using Claude API with tool use (Supabase queries as tools). System prompt in `lib/ai/system-prompt.ts`. Tools defined in `lib/ai/tools.ts`.

### Archer (Document Review Copilot)

Embedded in the `/review` page as a right-side panel. Analyzes the currently-selected document and helps the reviewer:
- Gives a brief first impression, then offers numbered analysis sections (conversational pace — NOT a monologue)
- Highlights entity names and key phrases directly in the PDF via annotation protocol
- Can navigate to specific pages, flag redaction patterns, and assess document significance
- Has access to the same Supabase tools as the Detective (minus platform-meta tools)

Key implementation details:
- **Prompt caching**: System prompt split into `buildArcherStaticPrompt()` (cacheable, ~950 tokens) + `buildArcherDocumentContext(document)` (per-document). Uses `cache_control: { type: 'ephemeral' }` for 90% cost reduction on repeat calls.
- **Streaming**: SSE via `text/event-stream` response. Events: `text`, `tool_start`, `tool_result`, `annotation`, `done`, `error`.
- **Annotation protocol**: Archer emits `[ANNOTATION:{"type":"entity","text":"...","tier":N}]` markers that the panel strips from display text and passes to the PDF viewer for in-document highlighting.
- **History trimming**: Last 10 messages sent per request to prevent token bloat.
- Prompt in `lib/ai/archer-prompt.ts`. Route in `app/api/review/archer/route.ts`.
