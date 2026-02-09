# EFTA Investigation Platform

## What This Is

A full-stack investigative research platform for the Epstein Files Transparency Act (EFTA) document releases. We are systematically analyzing ~3.5 million pages of DOJ disclosures to uncover operational patterns, evidence of prosecutorial failures, and accountability gaps. This platform replaces manual project files with a searchable, linked, visual database.

## Current Phase

Check `docs/TODO.md` for the current build phase and task list. Always read it before starting work.

## Tech Stack

| Component | Technology | Hosting |
|-----------|-----------|---------|
| Frontend | Next.js 14+ (App Router, TypeScript) | Vercel |
| Styling | Tailwind CSS + custom design system | - |
| Database | PostgreSQL via Supabase | Supabase Cloud |
| File Storage | Cloudflare R2 | Cloudflare |
| Auth | Supabase Auth | Supabase Cloud |
| Search | Supabase Full-Text Search | Supabase Cloud |
| Processing Worker | Python (FastAPI + PyMuPDF) | Railway |
| Queue | Supabase Realtime / BullMQ later | - |
| Monorepo | Turborepo + pnpm | - |
| Visualization | D3.js (graphs), custom React (timelines) | Client-side |

## Repository Structure

```
efta-investigation/
  apps/
    web/                          # Next.js frontend
      src/
        app/                      # App Router
          (public)/               # Public-facing pages
          (admin)/                # Auth-protected admin pages
          api/                    # API routes
        components/               # React components
          ui/                     # Design system
          timeline/
          entity/
          network/
          documents/
        lib/                      # Utilities
          supabase/
          r2/
          types/
  packages/
    db/                           # Schema + migrations
    shared/                       # Shared types + constants
  services/
    worker/                       # Python processing worker
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

### Git Workflow
- Commit after every meaningful step.
- Commit messages: `phase-X: description` (e.g., `phase-1: scaffold monorepo and database schema`)
- Never commit .env files or API keys.
- Push to main triggers Vercel auto-deploy.

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
| `docs/investigation/DS12_SUMMARY.md` | Dataset 12 complete findings | Importing DS12 data |
| `docs/investigation/LEON_BLACK_CASE.md` | Leon Black prosecution failure | Key investigation thread |
| `docs/investigation/ENTITIES.md` | All identified entities | Entity import/profiles |
| `docs/investigation/TIMELINE.md` | All timeline events | Timeline import |
| `packages/db/schema.sql` | The actual SQL schema | Database work |

## Key Domain Concepts

- **EFTA**: Epstein Files Transparency Act — the law requiring DOJ to release these files
- **Bates Number**: Unique document identifier (e.g., EFTA02731623)
- **Dataset**: One of 12 numbered collections released by DOJ
- **Entity Tier**: Evidence-strength classification (1=convicted/charged through 6=staff/legal)
- **Redaction Category**: A=victim protection, B=legal privilege, C=institutional protection, D=perpetrator protection
- **The Five Systems**: Recruitment Pipeline, Logistics Network, Financial Infrastructure, Protection Apparatus, Inner Circle
- **NPA**: 2007 Non-Prosecution Agreement that gave blanket immunity to co-conspirators

## AI Assistant (In-Dashboard)

The platform includes an AI research assistant built into the admin dashboard. It has read-only access to the full Supabase database and can:
- Query documents, entities, events, and connections to answer research questions
- Surface missed connections (entity co-occurrence without connection records)
- Detect anomalies (inconsistent redactions, timeline gaps, under-investigated entities)
- Assemble evidence summaries for entity profiles
- Suggest new connections, tier changes, and investigation threads (user approves with one click)

Built using Claude API with tool use (Supabase queries as tools). System prompt includes investigation context, entity tiers, and redaction framework. See `docs/reference/WORKFLOW.md` for interaction examples.
