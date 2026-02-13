# EFTA Investigation Platform

A full-stack investigative research platform for analyzing the Epstein Files Transparency Act (EFTA) document releases. Built to systematically process, analyze, and cross-reference ~3.5 million pages of DOJ disclosures, uncovering operational patterns, prosecutorial failures, and accountability gaps.

> This is a private research tool. Not a public-facing website.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS v4 (CSS-based config) |
| Database | PostgreSQL via Supabase |
| File Storage | Cloudflare R2 (S3-compatible) |
| Auth | Supabase Auth (email/password) |
| Processing Worker | Python 3 (PyMuPDF, boto3) |
| AI Assistant | Claude API (tool use + streaming) |
| Monorepo | Turborepo + pnpm |
| Hosting | Vercel (web) |

---

## Repository Structure

```
efta-investigation/
  apps/web/                    Next.js frontend
    src/app/                   App Router pages
      (dashboard)/             All authenticated pages
        assistant/             AI research detective
        documents/             Document browser + detail viewer
        entities/              Entity browser + profiles
        timeline/              Event timeline
        network/               D3 force-directed graph
        hierarchy/             Org chart / tree view
        datasets/              Dataset progress tracking
        search/                Full-text search
        upload/                Drag-and-drop upload (files + folders)
        processing/            Processing queue dashboard
        review/                Document review with Archer AI
      api/                     API routes
        assistant/             AI chat + suggestion apply endpoints
        documents/[id]/file/   Auth-gated R2 file proxy
        documents/[id]/reprocess/  Re-queue for processing
        upload/presign/        Presigned URL generation
        upload/confirm/        Upload verification
        processing/            Queue status
        review/                Review actions + Archer AI
    src/components/            React components
      ui/                      Design system (TierBadge, SeverityMarker, etc.)
      layout/                  Sidebar, footer, breadcrumbs
    src/lib/                   Utilities
      supabase/                Server/client/admin/middleware clients
      r2/                      S3 client for Cloudflare R2
      ai/                      AI prompts, tools, assistant logic
  packages/
    db/                        SQL schema + migrations
    shared/                    TypeScript types + constants
  services/
    worker/                    Python processing worker
      stages/                  8 processing stages
      main.py                  Polling loop
      db.py                    Supabase client
      storage.py               R2/S3 client
      config.py                Environment config
  scripts/                     Data import scripts
  docs/
    reference/                 Architecture + domain docs
    investigation/             Investigation findings
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+
- Python 3.10+
- Supabase project (with schema deployed)
- Cloudflare R2 bucket

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

Create `apps/web/.env.local` (or symlink from the root):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=efta-documents
R2_PUBLIC_URL=https://your-account.r2.cloudflarestorage.com/efta-documents

ANTHROPIC_API_KEY=your-anthropic-key
```

Create `services/worker/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=efta-documents

POLL_INTERVAL=5
```

### 3. Run the database schema

In the Supabase SQL Editor, run:
1. `packages/db/schema.sql` (creates all tables, indexes, RLS policies)
2. `packages/db/migrations/003_document_versions.sql` (versioning support)
3. The `claim_next_queued()` RPC function (see [Processing Pipeline docs](docs/reference/PROCESSING_PIPELINE.md#atomic-queue-claiming))

### 4. Start the web app

```bash
pnpm dev
```

Opens at `http://localhost:3000`. Log in with your Supabase Auth credentials.

### 5. Start the processing worker

```bash
cd services/worker
pip install -r requirements.txt
python3 main.py
```

The worker polls the `processing_queue` table every 5 seconds and processes documents through up to 8 stages.

---

## How It Works

### The Data Model

Everything connects back to **documents** (PDFs identified by Bates number). Documents link to **entities** (people, organizations), **events** (timeline entries), **evidence items** (specific claims with sources), and **redactions** (detected censored regions). Entities connect to each other via **entity_connections** with relationship types and evidence strength.

```
Documents ──┬── Entity Documents ── Entities
            ├── Event Documents ── Events
            ├── Evidence Items
            ├── Redactions
            └── Document Versions (re-upload history)

Entities ──┬── Entity Connections (relationships)
           ├── Entity Events
           ├── Entity Sightings (locations)
           └── Entity Investigations

Datasets ── Documents (1-to-many, DS1 through DS12)
```

### Upload Flow

1. User drags PDF files or folders onto the **Upload** page
2. Folders are recursively scanned for PDFs using the FileSystemEntry API
3. Files are batched (50 per request) and sent to `/api/upload/presign`
4. The presign route creates a `documents` record + `processing_queue` entry, then returns a presigned R2 URL
5. Browser uploads directly to R2 via the presigned URL (no file size limit)
6. `/api/upload/confirm` verifies files exist in R2
7. If a bates number already exists, the system creates a **version snapshot** of the current state, clears pipeline-generated data, and re-queues for processing (re-upload flow)

### Processing Pipeline

Documents flow through an 8-stage pipeline run by the Python worker. See [docs/reference/PROCESSING_PIPELINE.md](docs/reference/PROCESSING_PIPELINE.md) for the full breakdown.

**Quick summary:**

| Stage | Name | What It Does |
|---|---|---|
| 1 | Ingest | Download PDF, count pages, generate thumbnail |
| 2 | Forensics | PDF version, metadata analysis, pipeline detection |
| 3 | Extract | Text extraction, document type classification, date detection |
| 4 | Entities | Match text against entity catalog (exact + fuzzy) |
| 5 | Redactions | Detect black rectangles, classify A-D categories |
| 6 | Cross-Ref | Find related docs by entity overlap + timeline proximity |
| 7 | Classify | Score 0-100, assign severity, determine if review needed |
| 8 | Diff | Compare against previous version (re-uploads only) |

Stages 1-3 run on **every** document. Stages 4-7 are **gated** — they only run on non-trivial documents (>3 pages, non-blank, meaningful text). Stage 8 is **conditional** — only for re-uploaded or re-processed documents.

### Review Workflow

Documents scoring high enough are flagged `needs_review`. The **Review** page provides:

- **3-column layout**: document queue | PDF viewer | Archer AI panel
- **Archer AI copilot**: Claude-powered assistant that reads the document and surfaces entities, key quotes, redaction analysis, and cross-references. Recommends approve/flag/reject.
- **Review actions**: Approve (marks `reviewed`), Flag (adds flags), Reject (marks `failed`). Editable fields for title, type, date, severity, classification, and notes.

### AI Research Assistant

The **Detective** (`/assistant`) is a Claude-powered chat interface with read-only access to the full database via 7 query tools + 5 suggestion tools:

**Query tools**: search entities, search documents, search events, get entity profile, get document detail, query connections, cross-reference analysis

**Suggestion tools**: suggest connection, suggest tier change, suggest evidence item, suggest platform improvement, get platform context

Suggestions appear as interactive cards — approve with one click to write to the database.

### Network Graph

The **Network** page renders a D3 force-directed graph of all entity connections. Nodes are color-coded by tier, sized by connection degree. Edges show relationship type with opacity mapped to evidence strength. Includes search-to-zoom, path-finding between entities, and multi-axis filtering.

### Entity Tier System

Entities are classified into 6 tiers based on evidence strength (not guilt):

| Tier | Label | Criteria |
|---|---|---|
| 1 | Convicted / Charged | Criminal charges filed or convicted |
| 2 | Accused (Evidence) | Multiple documented allegations with corroboration |
| 3 | Alleged (Single Source) | Single-source allegations, unverified |
| 4 | Connected | Business/social ties, present at locations, no allegations |
| 5 | Peripheral | Mentioned in passing, tangential |
| 6 | Staff / Legal | Employees, attorneys, law enforcement |

### Redaction Categories

Documents released under EFTA contain redactions. The platform classifies them:

| Category | Purpose | Legitimacy |
|---|---|---|
| A | Victim protection | Generally appropriate |
| B | Legal privilege | Context-dependent |
| C | Institutional protection | Often suspect — hides DOJ/FBI decision-making |
| D | Perpetrator protection | Suspect — hides names, finances, travel |

Categories C and D are automatically flagged as `suspect` when detected near high-tier entity names or decision-making language.

---

## Running Multiple Workers

The processing queue uses PostgreSQL `FOR UPDATE SKIP LOCKED` via an RPC function for atomic job claiming. You can safely run multiple workers in parallel:

```bash
# Terminal 1
cd services/worker && python3 main.py

# Terminal 2
cd services/worker && python3 main.py

# Terminal 3...
cd services/worker && python3 main.py
```

Each worker claims one document at a time. No two workers will process the same document. 5-6 concurrent workers is a reasonable ceiling before database connection overhead dominates.

---

## Key Commands

```bash
# Development
pnpm dev                          # Start Next.js dev server
pnpm build                        # Production build
pnpm lint                         # Run linting

# Worker
cd services/worker
python3 main.py                   # Start processing worker

# Data import (if seeding from investigation docs)
pnpm --filter @efta/scripts import:all
```

---

## Documentation

| Document | Description |
|---|---|
| [PROCESSING_PIPELINE.md](docs/reference/PROCESSING_PIPELINE.md) | Detailed pipeline stages, scoring, gating logic |
| [ARCHITECTURE.md](docs/reference/ARCHITECTURE.md) | System architecture overview |
| [DATABASE_SCHEMA.md](docs/reference/DATABASE_SCHEMA.md) | Schema details + relationships |
| [DESIGN_SYSTEM.md](docs/reference/DESIGN_SYSTEM.md) | Colors, typography, components |
| [ENTITY_TIERS.md](docs/reference/ENTITY_TIERS.md) | 6-tier classification system |
| [REDACTION_FRAMEWORK.md](docs/reference/REDACTION_FRAMEWORK.md) | A-D redaction categories |
| [WORKFLOW.md](docs/reference/WORKFLOW.md) | Data flow and operational workflows |
| [INVESTIGATION_CONTEXT.md](docs/reference/INVESTIGATION_CONTEXT.md) | What this investigation is about |

---

## License

Private repository. All rights reserved.
