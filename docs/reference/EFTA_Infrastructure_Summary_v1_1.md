# EFTA Investigation Platform — Infrastructure Summary

**Version: Post-Phase 2 | February 24, 2026**

---

## System Architecture Overview

The EFTA investigation platform is a full-stack system for forensic analysis of 3.5 million pages of DOJ Epstein file releases. It combines a custom database, AI-powered investigation tools, external research corpora, and a web dashboard.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INVESTIGATION LAYER                          │
│                                                                     │
│   Claude.ai / Claude CLI ◄──── MCP Protocol (SSE) ────► MCP Server │
│   (Archer - AI Partner)         53 tools                 (Node.js)  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                         DATA LAYER                                  │
│                                                                     │
│   ┌──────────────┐  ┌───────────────────┐  ┌────────────────────┐  │
│   │  Supabase    │  │  SQLite Corpus    │  │  External Sources  │  │
│   │  PostgreSQL  │  │  (rhowardstone)   │  │                    │  │
│   │              │  │                   │  │  • Jmail (1.4M)    │  │
│   │  17 tables   │  │  • full_text_     │  │  • tommycarstensen │  │
│   │  99 entities │  │    corpus.db      │  │  • DOJ website     │  │
│   │  39 suspects │  │    (6.08 GB)      │  │  • rhowardstone    │  │
│   │  7,435 docs  │  │  • redaction_     │  │    GitHub reports  │  │
│   │  63 events   │  │    analysis_v2.db │  │  • Internet Archive│  │
│   │  45 pub evts │  │    (0.95 GB)      │  │  • Google Drive    │  │
│   │  13 DOJ acts │  │                   │  │    (179 GB DS9)    │  │
│   └──────┬───────┘  │  1.38M documents  │  └────────────────────┘  │
│          │          │  2.77M pages      │                           │
│          │          │  2.59M redactions │                           │
│          │          └───────────────────┘                           │
│          │                                                          │
│   ┌──────┴───────┐  ┌───────────────────┐                          │
│   │ Cloudflare   │  │  Web Dashboard    │                          │
│   │ R2 Storage   │  │  (Next.js 16)     │                          │
│   │ Doc text +   │  │  efta-investiga-  │                          │
│   │ images       │  │  tion.vercel.app  │                          │
│   └──────────────┘  └───────────────────┘                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. MCP Server (Backend API)

| Property | Value |
|----------|-------|
| **Location** | `services/efta-mcp-server/` |
| **Language** | TypeScript (strict mode, ESM) |
| **Runtime** | Node.js + Express |
| **Protocol** | MCP over Stateless Streamable HTTP (JSON-RPC 2.0) |
| **Port** | localhost:3001 |
| **Tunnel** | Cloudflare quick tunnel → `*.trycloudflare.com` (ephemeral) |
| **Auth** | None (authless) — OAuth 2.1 planned for production |
| **Total Tools** | **53** (40 Supabase + 5 SQLite corpus + 8 public events/DOJ) |
| **Dependencies** | `@supabase/supabase-js`, `better-sqlite3`, `@modelcontextprotocol/sdk`, `zod`, `express` |

**Tool Inventory (53 tools):**

| Domain | Tools | Count |
|--------|-------|-------|
| **Entities** | search, get, create, update, delete | 5 |
| **Documents** | search, get, get_full_text, create, update | 5 |
| **Investigation Events** | search, create, link_entity_to_event, update, delete | 5 |
| **Connections** | find, create, update, delete | 4 |
| **Redactions** | search, create_redaction, create_evidence_item | 3 |
| **Links** | link_entity_to_document, batch_link_entities_to_document, unlink_entity_from_document, unlink_entity_from_event | 4 |
| **Utility** | lookup_person, get_investigation_stats, list_datasets, get_schema | 4 |
| **Suspects** | search, create, update, promote, delete | 5 |
| **Sightings** | search_entity_locations, add_entity_location, find_co_locations, get_location_timeline, find_entities_at_location | 5 |
| **Corpus** *(Phase 1)* | corpus_search, corpus_get_document_text, corpus_count_entity_mentions, corpus_search_redactions, corpus_resolve_url | 5 |
| **Public Events** *(Phase 2)* | search_public_events, create_public_event, update_public_event, delete_public_event, search_doj_actions, log_doj_action, update_doj_action, delete_doj_action | 8 |

**File Structure:**
```
services/efta-mcp-server/
├── src/
│   ├── index.ts              # Express server + MCP transport
│   ├── supabase.ts           # Supabase client singleton
│   ├── r2.ts                 # Cloudflare R2 client singleton
│   ├── db/
│   │   └── sqlite.ts         # SQLite connection manager (Phase 1)
│   └── tools/
│       ├── index.ts           # Tool registration hub
│       ├── entities.ts        # Entity CRUD
│       ├── documents.ts       # Document CRUD
│       ├── events.ts          # Investigation events
│       ├── connections.ts     # Entity relationships
│       ├── links.ts           # Entity-document/event linking & unlinking
│       ├── redactions.ts      # Redaction tracking
│       ├── suspects.ts        # Suspect watchlist
│       ├── sightings.ts       # Location tracking
│       ├── utility.ts         # Stats, schema, lookup
│       ├── corpus.ts          # Full-text corpus search (Phase 1)
│       └── public-events.ts   # Public events + DOJ accountability (Phase 2)
├── data/
│   ├── full_text_corpus.db    # 6.08 GB (gitignored)
│   ├── redaction_analysis_v2.db # 0.95 GB (gitignored)
│   ├── download.sh            # DB download script
│   └── README.md
├── scripts/
│   └── seed-public-events.ts  # One-time seed script
├── packages/db/migrations/
│   └── 014_public_events.sql  # Latest migration
└── package.json
```

---

### 2. Supabase PostgreSQL Database

**17 tables** (including 2 new from Phase 2):

| Table | Records | Purpose |
|-------|---------|---------|
| `entities` | 99 | Persons of interest (6-tier classification) |
| `documents` | 7,435 | EFTA documents tracked |
| `events` | 63 | Investigation timeline events |
| `entity_connections` | ~50 | Relationships between entities |
| `entity_documents` | varies | Entity ↔ document links |
| `entity_events` | varies | Entity ↔ event links |
| `redactions` | varies | Redaction records (A-D classification) |
| `evidence_items` | varies | Evidence extracted from documents |
| `suspect_watchlist` | 39 | Persons of interest awaiting EFTA evidence |
| `entity_locations` | 0 | Location/sighting tracking (seeding blocked) |
| `locations` | 0 | Known locations (needs `create_location` tool) |
| `datasets` | 0 | Dataset metadata (not yet seeded) |
| `document_processing_queue` | 7,436 | Processing pipeline status |
| `**public_events**` | **45** | **Real-world EFTA timeline (Phase 2)** |
| `**doj_accountability**` | **13** | **DOJ behavior tracking (Phase 2)** |
| + join tables | varies | entity_documents, entity_events |

**Extensions enabled:** `pg_trgm` (fuzzy text matching), `uuid-ossp`

---

### 3. SQLite Full-Text Corpus (Phase 1)

Downloaded from `rhowardstone/Epstein-research-data` v4.0:

| Database | Size | Contents |
|----------|------|----------|
| `full_text_corpus.db` | 6.08 GB | 1,385,879 documents, 2,770,167 pages, FTS5 indexed |
| `redaction_analysis_v2.db` | 0.95 GB | 2,587,102 redaction records, 849K doc summaries, 39K reconstructed pages, 107K entities |

**Also available for future phases** (downloaded but not yet integrated):
- `knowledge_graph.db` — 524 entities, 2,096 relationships
- `image_analysis.db` — 38,955 images with AI descriptions
- `communications.db` — email/communication metadata
- `transcripts.db` — 1,628 media transcriptions
- `prosecutorial_query_graph.db` — 257 subpoenas
- `persons_registry.json` — 1,536 persons

---

### 4. Cloudflare R2 Storage

| Property | Value |
|----------|-------|
| **Bucket** | `efta-documents` |
| **Content** | Full extracted text + images from processed documents |
| **Access** | Via MCP server (`get_document_full_text` tool, 30K char cap) |

---

### 5. Web Dashboard (Frontend)

| Property | Value |
|----------|-------|
| **Framework** | Next.js 16, React 19, Tailwind v4 |
| **Hosting** | Vercel (`efta-investigation.vercel.app`) |
| **Features** | Entity browser, document viewer, timeline, AI assistant panel |
| **AI Integration** | Claude API with 10 specialized investigation tools |
| **Status** | Deployed but not the primary investigation interface — MCP/CLI is faster |

---

### 6. External Resources (Not Hosted — Linked/Referenced)

| Resource | URL | What We Use It For |
|----------|-----|-------------------|
| **Jmail Suite** | jmail.world | Email viewer, person pages, document browser, flight tracker |
| **rhowardstone/Epstein-research** | github.com/rhowardstone/Epstein-research | 100+ analysis reports with EFTA citations |
| **tommycarstensen.com** | tommycarstensen.com/epstein | Deletion tracker, financial graph, image/video galleries |
| **DOJ Epstein Library** | justice.gov/epstein | Original source PDFs (12 datasets) |
| **Google Drive** | (private) | DS9 raw files (179 GB across 12 volumes) |
| **Internet Archive** | archive.org | Fallback for DOJ-deleted files |

---

## Data Summary

| Metric | Count |
|--------|-------|
| **MCP Tools** | 53 |
| **Supabase Tables** | 17 |
| **Entities (curated)** | 99 (16 Tier 1, 1 Tier 2, 21 Tier 3, 8 Tier 4, 0 Tier 5, 52 Tier 6) |
| **Suspects (watchlist)** | 39 (13 at P1 priority) |
| **Documents (tracked)** | 7,435 |
| **Investigation Events** | 63 |
| **Public Events** | 45 |
| **DOJ Accountability Records** | 13 (8 critical, 5 high) |
| **Corpus Documents (searchable)** | 1,385,879 |
| **Corpus Pages (searchable)** | 2,770,167 |
| **Redaction Records (searchable)** | 2,587,102 |
| **Entity Connections** | ~50 |

---

## Access Patterns

### How Archer (Claude) Accesses the Database

| Interface | Access Level | When |
|-----------|-------------|------|
| **Claude.ai + MCP Connector** | Full read/write via 53 tools | When tunnel is active + connector URL current |
| **Claude CLI + MCP** | Full read/write via 53 tools | When server running locally |
| **Claude.ai (this project chat)** | Read-only via project files | Always (project files are read-only snapshots) |
| **Claude.ai artifacts** | Can call MCP via API if connector active | When building interactive components |

### How Derek Accesses the Database

| Interface | Access Level | When |
|-----------|-------------|------|
| **Supabase Dashboard** | Full SQL access | Always (supabase.com) |
| **Web Dashboard** | Read/write via Next.js API routes | Always (efta-investigation.vercel.app) |
| **Claude Code** | Full filesystem + can run MCP server | When running locally |
| **Direct SQL** | Full access via psql or Supabase SQL editor | Always |

---

## Known Issues & Blockers

| ID | Issue | Severity | Status |
|----|-------|----------|--------|
| BUG-01 | `lookup_person` fuzzy search doesn't match aliases | Medium | Workaround (manual alias additions) |
| BUG-02 | `get_schema` response truncated | Low | Functional enough |
| ENH-04 | No `create_location` tool — blocks sighting system | Medium | Needs implementation |
| ENH-05 | MCP server on ephemeral tunnel — URL rotates every restart | High | Railway deployment planned |
| — | Datasets table empty — no dataset metadata seeded | Low | Needs seed script |
| — | 1 failed document in processing queue | Low | Needs investigation |
| — | DB-to-project-file gap: 99 in Supabase vs 127 in project files | Medium | v2.1/v2.2 addendum entities need sync |

---

## Deployment Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1: Corpus Integration | ✅ Complete | 5 SQLite search tools, 1.38M docs searchable |
| Phase 2: Events & Accountability | ✅ Complete | 8 tools (full CRUD), 45 events, 13 DOJ records seeded |
| CRUD Completion Pass | ✅ Complete | +10 tools — update/delete for events, connections, public events, DOJ actions; unlink for entity-document/event |
| Phase 3: External Research Integration | 📋 Planned | Link entities to Jmail/rhowardstone, import 1,536-person registry |
| Phase 4: Infrastructure | 📋 Planned | Railway deployment, `create_location` tool, OAuth, alias fuzzy fix |

---

*Document compiled February 24, 2026. Reflects state after Phase 1 + Phase 2 + CRUD completion pass (53 tools).*
