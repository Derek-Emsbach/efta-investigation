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
          (dashboard)/            # Auth-protected dashboard pages
            review/               # Document review (3-column: queue | PDF | Archer)
            assistant/            # AI detective assistant
            upload/               # Document upload
            processing/           # Processing pipeline dashboard
            entities/[id]/        # Entity profiles
            documents/[id]/       # Document viewer
            timeline/             # Event timeline
            search/               # Full-text search
            network/              # Network graph
            datasets/             # Dataset browser
            hierarchy/            # Entity hierarchy
          api/                    # API routes
            review/archer/        # Archer SSE streaming endpoint
            assistant/            # Detective chat endpoint
            upload/               # Presigned URL generation
        components/               # React components
          ui/                     # Design system (breadcrumbs, theme-toggle)
          layout/                 # Sidebar, footer, mobile toggle
          review/                 # Archer panel, PDF viewer
          timeline/
          entity/
          network/
          documents/
        lib/                      # Utilities
          supabase/               # Server + client Supabase helpers
          ai/                     # AI prompts (archer-prompt, system-prompt, tools)
          r2/                     # Cloudflare R2 presigned URLs
  packages/
    db/                           # Schema + migrations
    shared/                       # Shared types + constants (@efta/shared)
  services/
    worker/                       # Python processing worker (polling script)
      stages/                     # Pipeline stages (classify, entities, crossref, redactions)
  scripts/                        # Import + migration scripts
  docs/
    reference/                    # Architecture + domain reference
    investigation/                # Investigation findings + context
```

## Critical Rules

### Design
- **Dark editorial investigative aesthetic** — NOT generic dashboard
- Dark base: #0A0E17, content areas: #111827, elevated: #1F2937
- Critical red: #DC2626, institutional blue: #3B82F6, amber warning: #F59E0B
- Serif display font for headings (Playfair Display), clean sans for body (IBM Plex Sans)
- Every design decision should feel like ProPublica meets an intelligence briefing
- NEVER use generic AI dashboard aesthetics (no purple gradients, no Inter font, no rounded pastel cards)
- **Tailwind v4**: Theme is defined in CSS via `@theme inline {}` in `globals.css`, NOT in `tailwind.config.ts`. Use semantic color names (`bg-background`, `text-text-primary`, `border-border-default`, etc.).

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
2. **Update memory** — if the work revealed stable patterns, gotchas, or architectural decisions worth remembering, update the auto memory files (mainly `MEMORY.md`). Only record things that are confirmed and likely to stay relevant across sessions.

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
| `docs/reference/PROCESSING_PIPELINE.md` | Document ingestion pipeline | Worker/processing features |
| `docs/reference/WORKFLOW.md` | How data flows: 3 workflows, auto-approve rules, session checklist | Any data import/update work |
| `docs/reference/LOCATION_INTELLIGENCE.md` | Location tracking, entity sightings, day-view timeline, co-location queries | Timeline, location, sighting features |
| `docs/reference/INVESTIGATION_CONTEXT.md` | What this investigation is about | Understanding domain |
| `docs/investigation/data/DS12_SUMMARY.md` | Dataset 12 complete findings | Importing DS12 data |
| `docs/investigation/archive/LEON_BLACK_CASE.md` | Leon Black prosecution failure | Key investigation thread |
| `docs/investigation/data/ENTITIES.md` | All identified entities | Entity import/profiles |
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
