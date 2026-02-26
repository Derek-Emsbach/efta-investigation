# EFTA MCP Server — Phase 3: External Integration + Infrastructure Fixes + Codebase Audit

## Context

The EFTA MCP server (`services/efta-mcp-server/`) has 43 tools after Phase 1 (5 corpus tools) and Phase 2 (4 public events/DOJ accountability tools). Phase 3 has three goals:

1. **External research integration** — Connect entities/suspects to Jmail, rhowardstone, tommycarstensen. Import the rhowardstone 1,536-person registry as a cross-reference layer.
2. **Infrastructure fixes** — `create_location` tool (ENH-04), `datasets` table seeding, `lookup_person` alias bug fix (BUG-01).
3. **Codebase audit** — Identify dead/obsolete code now that the rhowardstone corpus replaces our document processing pipeline.

**Tool count: 43 → 49** (6 new tools)

## Stack Reminder
- TypeScript (strict mode), ESM modules (`"type": "module"`)
- All local imports use `.js` extension (Node16 resolution)
- Supabase PostgreSQL via `@supabase/supabase-js`
- SQLite read-only via `better-sqlite3` (for corpus)
- Existing patterns: Zod schemas, `toolResponse()` / `errorResponse()`, `safeJson()`
- npm (not pnpm)
- Express server on port 3001
- `Accept: application/json, text/event-stream` header required on all MCP curl tests
- **IMPORTANT:** Before starting the server, always kill stale processes: `lsof -ti:3001 | xargs kill -9`

---

## Part A: Schema Migrations

Run all SQL in the Supabase SQL Editor (or via the MCP `execute_sql` tool if available). These are additive, non-breaking changes.

### A1: Add `external_urls` column to `entities` + `suspect_watchlist`

```sql
ALTER TABLE entities ADD COLUMN IF NOT EXISTS external_urls JSONB DEFAULT '{}';
ALTER TABLE suspect_watchlist ADD COLUMN IF NOT EXISTS external_urls JSONB DEFAULT '{}';

COMMENT ON COLUMN entities.external_urls IS 'Links to external research tools. Shape: { "jmail": "url", "jwiki": "url", "rhowardstone": "url", "carstensen": "url", "other": ["url1"] }';
COMMENT ON COLUMN suspect_watchlist.external_urls IS 'Same schema as entities.external_urls';
```

### A2: Create `external_sources` table

Registry of external research tools and data sources we use.

```sql
CREATE TABLE external_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'search_platform', 'research_repo', 'tracker', 'government',
    'archive', 'media', 'court_records', 'data_corpus', 'community', 'other'
  )),
  description TEXT,
  capabilities TEXT[] DEFAULT '{}',
  person_page_template TEXT,           -- URL template with {slug} or {SLUG} placeholder
  api_available BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unreliable', 'offline', 'deprecated')),
  last_checked TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_external_sources_type ON external_sources(source_type);
```

### A3: Create `external_entities` table

Cross-reference layer for the rhowardstone 1,536-person registry. This is separate from our curated 99-entity `entities` table — it's a lookup resource, not our investigation data.

```sql
CREATE TABLE external_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'rhowardstone',
  source_id TEXT,
  name TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  entity_type TEXT,                    -- 'person', 'organization', 'property', 'aircraft'
  occupation TEXT,
  legal_status TEXT,                   -- 'convicted', 'charged', 'named', 'associated'
  mention_count INTEGER,
  matched_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  matched_suspect_id UUID REFERENCES suspect_watchlist(id) ON DELETE SET NULL,
  match_status TEXT DEFAULT 'unmatched' CHECK (match_status IN (
    'unmatched', 'matched', 'new_lead', 'not_relevant'
  )),
  raw_data JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ext_entities_source ON external_entities(source);
CREATE INDEX idx_ext_entities_name ON external_entities USING gin(to_tsvector('english', name));
CREATE INDEX idx_ext_entities_match ON external_entities(match_status);
CREATE INDEX idx_ext_entities_matched_entity ON external_entities(matched_entity_id);
```

---

## Part B: External Tools Module (`src/tools/external.ts`)

Create a new tool module with 4 tools. Follow the existing patterns in `src/tools/corpus.ts` or `src/tools/public-events.ts`.

### Tool 1: `search_external_sources` (read)

Search the `external_sources` registry.

```
Input:
  query: string (optional) — name search via ilike
  source_type: string (optional) — enum filter
  capability: string (optional) — array contains filter on capabilities column
Output:
  success: true, count: number, data: external_source[]
```

### Tool 2: `get_entity_external_links` (read)

Given an entity name or ID, return all known external URLs. Combines:
- The entity's stored `external_urls` JSONB
- Auto-generated URLs from `external_sources` where `person_page_template` is set

Auto-generation logic: for each source with a `person_page_template`, generate a URL by slugifying the entity name. `{slug}` = lowercase, spaces to hyphens. `{SLUG}` = uppercase, spaces removed. These are best-guess URLs — the stored `external_urls` on the entity override them.

Also search `external_entities` table for matching records and include those.

```
Input:
  entity_id: string (optional) — UUID
  name: string (optional) — searches entities then suspect_watchlist
  (must provide one)
Output:
  success: true
  entity: { id, name, tier_or_status }
  stored_urls: { ... from external_urls column }
  generated_urls: { source_name: url, ... }
  external_entity_matches: external_entity[] (from external_entities table)
```

### Tool 3: `search_external_entities` (read)

Search the `external_entities` reference table.

```
Input:
  query: string (optional) — name search via ilike
  source: string (optional) — filter by source
  match_status: string (optional) — 'unmatched', 'matched', 'new_lead', 'not_relevant'
  entity_type: string (optional)
  limit: number (optional, default 20, max 50)
Output:
  success: true, count: number, data: external_entity[] (include matched entity name/tier if linked)
```

### Tool 4: `link_external_entity` (write)

Link an external entity record to one of our entities or suspects.

```
Input:
  external_entity_id: string (required) — UUID
  entity_id: string (optional) — our entity UUID
  suspect_id: string (optional) — our suspect UUID
  match_status: string (required) — 'matched', 'new_lead', 'not_relevant'
  notes: string (optional)
Output:
  success: true, message: "Linked {external_name} → {our_name}"
```

Must provide either `entity_id` or `suspect_id` when `match_status` is 'matched'. For 'new_lead' or 'not_relevant', neither is required.

### Registration

In `src/tools/index.ts`:
```typescript
import { registerExternalTools } from './external.js';
// In registerTools():
registerExternalTools(server);
```

---

## Part C: Create Location Tool (ENH-04)

### C1: Check `locations` table schema first

Before implementing, verify the actual schema:
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'locations'
ORDER BY ordinal_position;
```

The existing sighting tools (`search_entity_locations`, `add_entity_location`, `find_co_locations`, `get_location_timeline`, `find_entities_at_location`) reference this table — check what columns they read/write. Match the `create_location` tool's schema accordingly.

### C2: Add `create_location` to `src/tools/sightings.ts`

Expected tool shape (adapt to actual schema):

```
Input:
  name: string (required) — "Little St. James Island"
  location_type: string (optional) — match whatever enum/values the table uses
  address: string (optional)
  city: string (optional)
  state: string (optional)
  country: string (optional)
  latitude: number (optional)
  longitude: number (optional)
  notes: string (optional)
Output:
  success: true, id: uuid, message: "Location created: {name}", data: location record
```

---

## Part D: Update Existing Tools

### D1: Add `external_urls` to entity/suspect CRUD

In `src/tools/entities.ts`:
- `create_entity`: Add optional `external_urls` param (Zod: `z.record(z.any()).optional()`)
- `update_entity`: Same

In `src/tools/suspects.ts`:
- `create_suspect`: Add optional `external_urls` param
- `update_suspect`: Same

These are small changes — one field added to the Zod schema and included in the insert/update object.

### D2: Fix BUG-01 — `lookup_person` alias fuzzy matching

In `src/tools/utility.ts`, the `lookup_person` handler currently only does trigram matching on `entities.name`. It doesn't search the `aliases` text array, so "Jean Luk Brunnel" won't find "Jean-Luc Brunel" even though "Jean Luc Brunel" is listed as an alias.

**Fix approach — update the SQL query:**

```sql
-- CURRENT (broken for aliases):
SELECT *, similarity(name, $1) as sim
FROM entities
WHERE similarity(name, $1) > 0.3
ORDER BY sim DESC

-- FIXED (searches name + all aliases):
SELECT DISTINCT ON (e.id) e.*,
  GREATEST(
    similarity(e.name, $1),
    COALESCE((SELECT MAX(similarity(a, $1)) FROM unnest(e.aliases) AS a), 0)
  ) as sim
FROM entities e
WHERE similarity(e.name, $1) > 0.3
   OR EXISTS (SELECT 1 FROM unnest(e.aliases) AS a WHERE similarity(a, $1) > 0.3)
ORDER BY e.id, sim DESC
```

Apply the same fix to the `suspect_watchlist` search within `lookup_person`.

**Prerequisite:** `pg_trgm` extension is already enabled in Supabase.

**Test cases after fix:**
- "Jean Luk Brunnel" → should find Jean-Luc Brunel
- "Ghislane Maxwell" (misspelling) → should find Ghislaine Maxwell
- "L. Black" → should find Leon Black (if "L. Black" is in aliases — check)

### D3: Update `get_investigation_stats`

In `src/tools/utility.ts`, add to the stats output:

```json
{
  "external_sources": { "total": 8 },
  "external_entities": {
    "total": 1536,
    "matched": 45,
    "unmatched": 1479,
    "new_leads": 12,
    "by_source": { "rhowardstone": 1536 }
  },
  "locations": { "total": 15 },
  "datasets": { "total": 12 }
}
```

These are simple `SELECT count(*)` queries with group-by where needed. Add them to the existing TABLE_INFO constant if that pattern is used.

---

## Part E: Seed Scripts

### E1: `scripts/seed-external-sources.ts`

Seed 8 external sources into `external_sources` table:

```typescript
const sources = [
  {
    name: "Jmail",
    url: "https://jmail.world",
    source_type: "search_platform",
    description: "Gmail-style interface for Epstein emails. 1.4M files indexed, OCR'd with Google Gemini. Includes JPhotos, JDrive, JFlights, Jwiki, Jemini AI.",
    capabilities: ["full_text_search", "email_viewer", "person_pages", "photo_gallery", "flight_tracker", "wiki", "ai_search"],
    person_page_template: "https://jmail.world/wiki/{slug}",
    api_available: false,
    status: "active"
  },
  {
    name: "rhowardstone/Epstein-research",
    url: "https://github.com/rhowardstone/Epstein-research",
    source_type: "research_repo",
    description: "100+ forensic analysis reports with EFTA document citations. Congressional briefing materials. 225-issue factual accuracy audit.",
    capabilities: ["individual_reports", "financial_forensics", "congressional_guides", "methodology_docs"],
    person_page_template: "https://github.com/rhowardstone/Epstein-research/blob/main/individuals/{SLUG}.md",
    api_available: false,
    status: "active"
  },
  {
    name: "rhowardstone/Epstein-research-data",
    url: "https://github.com/rhowardstone/Epstein-research-data",
    source_type: "data_corpus",
    description: "SQLite full-text corpus (6.08 GB, 1.38M docs), redaction analysis (0.95 GB, 2.59M records), knowledge graph (524 entities), entity registry (1,536 persons). All public domain, v4.0.",
    capabilities: ["full_text_search", "redaction_search", "knowledge_graph", "entity_registry", "efta_mapping"],
    api_available: false,
    status: "active"
  },
  {
    name: "Tommy Carstensen EFTA Hub",
    url: "https://tommycarstensen.com/epstein",
    source_type: "tracker",
    description: "DOJ deletion tracker, EFTA ID lookup, financial graph, photo identification (292K images w/ facial recognition), video gallery (Whisper transcripts), consequence tracker.",
    capabilities: ["deletion_tracker", "efta_lookup", "financial_graph", "photo_gallery", "video_gallery", "consequence_tracker"],
    api_available: false,
    status: "active"
  },
  {
    name: "DOJ Epstein Library",
    url: "https://www.justice.gov/epstein",
    source_type: "government",
    description: "Original DOJ release of all 12 EFTA datasets. Known to delete files and block programmatic access.",
    capabilities: ["original_pdfs", "dataset_browsing"],
    api_available: false,
    status: "unreliable",
    notes: "Blocks bots, deletes files, slow. Use alternatives when possible."
  },
  {
    name: "Internet Archive - Epstein Files",
    url: "https://archive.org",
    source_type: "archive",
    description: "Brute-force archive of DOJ PDFs. Preserves files DOJ has deleted.",
    capabilities: ["archived_pdfs", "deletion_recovery"],
    api_available: true,
    status: "active"
  },
  {
    name: "PACER",
    url: "https://pacer.uscourts.gov",
    source_type: "court_records",
    description: "Federal court records. Key cases: 19 Cr. 490 (RMB) — US v. Epstein SDNY, 15 Cv. 7433 — Maxwell civil (Preska).",
    capabilities: ["court_filings", "docket_search"],
    api_available: true,
    status: "active"
  },
  {
    name: "Google Pinpoint / COURIER",
    url: "https://journaliststudio.google.com/pinpoint",
    source_type: "search_platform",
    description: "DS1-8 and DS12 searchable. DS9 status unknown. Google's document analysis tool.",
    capabilities: ["full_text_search", "entity_extraction"],
    api_available: false,
    status: "active",
    notes: "DS9 (largest dataset) may not be indexed."
  }
];
```

### E2: `scripts/seed-locations.ts`

Seed 15 known Epstein-connected locations. **Check the `locations` table schema first** (Part C1) and adapt the field names accordingly.

```typescript
const locations = [
  { name: "9 E. 71st St Townhouse", location_type: "epstein_property", address: "9 East 71st Street", city: "New York", state: "NY", country: "US", latitude: 40.7711, longitude: -73.9644, notes: "Manhattan townhouse. Primary NYC residence. Gifted by Wexner." },
  { name: "358 El Brillo Way", location_type: "epstein_property", address: "358 El Brillo Way", city: "Palm Beach", state: "FL", country: "US", latitude: 26.7066, longitude: -80.0356, notes: "Palm Beach mansion. Primary abuse location per FBI investigation." },
  { name: "Little St. James Island", location_type: "epstein_property", city: "St. Thomas", country: "USVI", latitude: 18.3000, longitude: -64.8253, notes: "Private island. Known as 'Pedophile Island.' Extensive compound." },
  { name: "Great St. James Island", location_type: "epstein_property", city: "St. Thomas", country: "USVI", latitude: 18.3117, longitude: -64.8350, notes: "Second private island. Purchased 2016. Construction without permits." },
  { name: "Zorro Ranch", location_type: "epstein_property", address: "Stanley", city: "Stanley", state: "NM", country: "US", latitude: 35.1500, longitude: -105.9500, notes: "8,000-acre NM ranch. Multiple victims reported abuse here." },
  { name: "301 E. 66th St Apartments", location_type: "epstein_property", address: "301 East 66th Street", city: "New York", state: "NY", country: "US", latitude: 40.7646, longitude: -73.9589, notes: "Mark Epstein's building. Used to house young women." },
  { name: "Avenue Foch Apartment", location_type: "epstein_property", city: "Paris", country: "France", latitude: 48.8716, longitude: 2.2833, notes: "Paris apartment. Caroline Lang / Prytanee LLC connection." },
  { name: "London Residence", location_type: "epstein_property", city: "London", country: "UK", notes: "UK property. Location details vary across sources." },
  { name: "Teterboro Airport", location_type: "airport", city: "Teterboro", state: "NJ", country: "US", latitude: 40.8501, longitude: -74.0608, notes: "Primary private aviation hub for NY departures." },
  { name: "Palm Beach International Airport", location_type: "airport", city: "West Palm Beach", state: "FL", country: "US", latitude: 26.6832, longitude: -80.0956, notes: "Florida aviation hub." },
  { name: "Cyril E. King Airport (STT)", location_type: "airport", city: "St. Thomas", country: "USVI", latitude: 18.3373, longitude: -64.9734, notes: "USVI airport. Transfer point to Little St. James by helicopter/boat." },
  { name: "Les Wexner Estate", location_type: "associated_property", city: "New Albany", state: "OH", country: "US", latitude: 40.0812, longitude: -82.7990, notes: "Wexner property. Maria Farmer alleges 1996 assault here." },
  { name: "Mar-a-Lago", location_type: "associated_property", address: "1100 S Ocean Blvd", city: "Palm Beach", state: "FL", country: "US", latitude: 26.6773, longitude: -80.0369, notes: "Trump property. Documented recruitment site per victim testimony." },
  { name: "Interlochen Center for the Arts", location_type: "recruitment_site", city: "Interlochen", state: "MI", country: "US", latitude: 44.6339, longitude: -85.7631, notes: "Performing arts camp. Multiple victims recruited from here." },
  { name: "Metropolitan Correctional Center", location_type: "government_facility", address: "150 Park Row", city: "New York", state: "NY", country: "US", latitude: 40.7127, longitude: -74.0010, notes: "Federal jail where Epstein died August 10, 2019." }
];
```

### E3: `scripts/seed-datasets.ts`

The `datasets` table exists but is empty. **Check the schema first:**

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'datasets' ORDER BY ordinal_position;
```

Seed these 12 records (adapt field names to match actual schema):

```typescript
const datasets = [
  { number: 1, name: "Initial Criminal Investigation Files", efta_range_start: "EFTA00000001", efta_range_end: "EFTA00004521", estimated_docs: 4521, notes: "First release batch" },
  { number: 2, name: "Grand Jury Materials", efta_range_start: "EFTA00004522", efta_range_end: "EFTA00005586", estimated_docs: 1065 },
  { number: 3, name: "FBI Investigation Records", efta_range_start: "EFTA00005705", efta_range_end: "EFTA00069044", estimated_docs: 63340 },
  { number: 4, name: "Prosecution Files", efta_range_start: "EFTA00069045", efta_range_end: "EFTA00090321", estimated_docs: 21277 },
  { number: 5, name: "Court Records & Filings", efta_range_start: "EFTA00090322", efta_range_end: "EFTA00096905", estimated_docs: 6584 },
  { number: 6, name: "Evidence Items", efta_range_start: "EFTA00096906", efta_range_end: "EFTA00107252", estimated_docs: 10347 },
  { number: 7, name: "Additional Evidence", efta_range_start: "EFTA00107253", efta_range_end: "EFTA00117395", estimated_docs: 10143 },
  { number: 8, name: "FBI 302s & Interview Records", efta_range_start: "EFTA00117396", efta_range_end: "EFTA00176563", estimated_docs: 59168 },
  { number: 9, name: "Email Communications & Correspondence", efta_range_start: "EFTA00176564", efta_range_end: "EFTA01243099", estimated_docs: 533786, notes: "179 GB. Highest-value target: email communications. Contains mega-documents with MIME-encoded emails + attachments." },
  { number: 10, name: "Financial Records", efta_range_start: "EFTA01243100", efta_range_end: "EFTA01524192", estimated_docs: 281093 },
  { number: 11, name: "Financial Records (Extended)", efta_range_start: "EFTA01524193", efta_range_end: "EFTA02640992", estimated_docs: 1116800 },
  { number: 12, name: "Leon Black Prosecution Files", efta_range_start: "EFTA02640993", efta_range_end: "EFTA02731785", estimated_docs: 152, notes: "Fully analyzed. 137/152 docs reviewed. Leon Black investigation, prosecution assessment, victim journals." }
];
```

### E4: `scripts/seed-external-entities.ts`

This imports the rhowardstone 1,536-person registry into `external_entities`.

**Step 1:** Download the file:
```bash
cd data
wget -q https://github.com/rhowardstone/Epstein-research-data/releases/download/v4.0/persons_registry.json
```

If that URL fails (GitHub release asset URLs can be tricky), try:
```bash
# Check the releases page for the correct download URL
curl -sL https://api.github.com/repos/rhowardstone/Epstein-research-data/releases/tags/v4.0 | grep "persons_registry" | head -5
```

**Step 2:** The seed script should:
1. Read `persons_registry.json` from `data/`
2. Inspect the structure (it may be an array of objects or a keyed object)
3. Map each entry to our `external_entities` schema:
   - `name` → name
   - Any aliases/alternate names → aliases array
   - Any type field → entity_type ('person' by default)
   - Any occupation/role → occupation
   - Any legal status → legal_status
   - Any mention/document count → mention_count
   - Everything else → raw_data JSONB
4. For each entry, attempt auto-matching:
   - Query `entities` table: `WHERE lower(name) = lower($1)` or any alias matches
   - Query `suspect_watchlist` table: same
   - If exact match found: set `matched_entity_id` or `matched_suspect_id`, `match_status: 'matched'`
5. Batch insert (use chunks of 100 for Supabase)
6. Report: total imported, matched to entities, matched to suspects, unmatched

**Important:** The person registry JSON structure is unknown until you read it. Inspect the first few entries before writing the mapping logic. Don't assume a schema — adapt to whatever structure the file contains.

---

## Part F: Codebase Audit

**After completing Parts A-E**, perform a read-only audit of the entire project. Don't delete anything — just produce a report.

### F1: What to Audit

**1. Python Worker Service**
Find any Python worker/service directory (check `services/worker/`, `services/python-worker/`, `workers/`, or similar). This was a document processing pipeline with three stages (ingest, forensics, text extraction) that processed PDFs into R2 storage. Assess:
- Is the code still referenced from anywhere?
- Does anything depend on it running?
- What unique capabilities did it have that corpus tools don't cover? (Likely: PDF metadata forensics like %%EOF counting, processing tool signatures, permission bits — things rhowardstone doesn't track)

**2. R2 Storage Usage**
The Cloudflare R2 bucket stores extracted text and images from the 7,435 processed documents. Assess:
- Which MCP tools reference R2? (Look for `get_document_full_text` and any R2 client imports)
- Can `corpus_get_document_text` fully replace `get_document_full_text`?
- Are there images in R2 that aren't available elsewhere?

**3. Document Processing Queue**
The `document_processing_queue` table has 7,436 entries. Assess:
- Is any code still reading from or writing to this table?
- Are any MCP tools or frontend pages dependent on processing status?
- What does the table contain? (Probably: efta_number, status, ingest_date, error messages)

**4. Frontend Dashboard (`apps/web/` or similar)**
- Identify pages/routes related to document upload or processing pipeline monitoring
- API routes that duplicate what MCP tools now do
- Components that reference the Python worker or processing queue
- What pages are still useful (entity browser, timeline, AI assistant panel) vs dead weight
- Check which of the 10 Claude API investigation tools in the dashboard are redundant with the 43+ MCP tools

**5. Duplicate/Overlapping Tools**
Now that we have both Supabase tools and corpus tools:
- `get_document_full_text` (R2) vs `corpus_get_document_text` (SQLite) — overlap?
- `search_redactions` (Supabase) vs `corpus_search_redactions` (SQLite) — different data or redundant?
- Any entity search tools that overlap with `search_external_entities`?
- Any other redundancies

**6. Unused Dependencies**
Check `package.json` for dependencies that may only be used by dead code paths.

### F2: Audit Output

Create `AUDIT_REPORT.md` in the project root (`services/efta-mcp-server/AUDIT_REPORT.md`) with:

```markdown
# EFTA Platform Codebase Audit
## Date: [today]
## Auditor: Claude Code

### 1. Dead Code
Files/directories that can be safely removed or archived.
[For each: path, what it does, why it's dead, any caveats]

### 2. Overlapping Functionality
Tools/routes that duplicate each other.
[For each: both sides, recommendation on which to keep, why]

### 3. Still Needed
Components that look obsolete but actually serve a unique purpose.
[For each: path, what it does, why it's still needed despite appearances]

### 4. Deprecated but Not Dead
Code that's on its way out but still has active dependencies.
[For each: path, what depends on it, migration path to remove it]

### 5. Recommended Actions (prioritized)
1. [Action] — [Impact] — [Effort]
2. ...

### 6. Project File Tree (annotated)
Full directory listing with status annotations:
- ✅ Active and needed
- ⚠️ Partially obsolete
- 🗑️ Dead code / safe to remove
- 🔄 Overlaps with newer code
```

---

## Implementation Order

Do these in sequence. Each step should build and pass tests before moving on.

1. **Run schema migrations** (Part A) — SQL only, no code changes
2. **Create `src/tools/external.ts`** (Part B) — 4 new tools
3. **Add `create_location` to sightings** (Part C) — 1 new tool + 1 existing tool fix
4. **Update entity/suspect CRUD + fix lookup_person + update stats** (Part D) — modifications to 3 existing files
5. **Register new tools** (Part B) — modify `src/tools/index.ts`
6. **Build + smoke test** — `npm run build && npm run dev` + quick curl tests
7. **Run seed scripts** (Part E) — in order: sources, locations, datasets, external entities
8. **Full verification** — run all curl tests from checklist below
9. **Codebase audit** (Part F) — read-only, produces AUDIT_REPORT.md

---

## Verification Checklist

Kill stale processes first: `lsof -ti:3001 | xargs kill -9`

```bash
# Build clean
npm run build

# Start server
npm run dev &
sleep 3

# --- Part B: External tools ---

# Search external sources (should return 8 seeded)
curl -s -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":1,"params":{"name":"search_external_sources","arguments":{}}}' | head -c 500

# Get entity external links
curl -s -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":2,"params":{"name":"get_entity_external_links","arguments":{"name":"Les Wexner"}}}' | head -c 500

# Search external entities (should have ~1536 from rhowardstone import)
curl -s -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":3,"params":{"name":"search_external_entities","arguments":{"query":"Wexner"}}}' | head -c 500

# Link an external entity (use a real UUID from search results)
# curl -s -X POST ... link_external_entity ...

# --- Part C: Location tool ---

# Create a test location
curl -s -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":4,"params":{"name":"create_location","arguments":{"name":"Test Location","city":"Test City"}}}' | head -c 500

# --- Part D: Bug fix ---

# Test alias fuzzy matching (should find Jean-Luc Brunel)
curl -s -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":5,"params":{"name":"lookup_person","arguments":{"name":"Jean Luk Brunnel"}}}' | head -c 500

# Test misspelling (should find Ghislaine Maxwell)
curl -s -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":6,"params":{"name":"lookup_person","arguments":{"name":"Ghislane Maxwell"}}}' | head -c 500

# --- Stats check ---

# Full investigation stats (should include external_sources, external_entities, locations, datasets)
curl -s -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":7,"params":{"name":"get_investigation_stats","arguments":{}}}' | head -c 1000

# --- Regression: spot-check existing tools ---

# Corpus search still works
curl -s -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":8,"params":{"name":"corpus_search","arguments":{"query":"Leon Black","limit":2}}}' | head -c 500

# Public events still works
curl -s -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":9,"params":{"name":"search_public_events","arguments":{"category":"criminal_action"}}}' | head -c 500
```

**All checks should pass:**
- [ ] `npm run build` — TypeScript compiles clean
- [ ] `npm run dev` — Server starts, no errors
- [ ] `external_urls` column exists on entities and suspect_watchlist
- [ ] `external_sources` table created, 8 records seeded
- [ ] `external_entities` table created, ~1,536 records from rhowardstone import
- [ ] Auto-matching worked (some external_entities linked to our entities/suspects)
- [ ] `search_external_sources` returns 8 sources
- [ ] `get_entity_external_links` returns links + generated URLs for known entity
- [ ] `search_external_entities` returns results for "Wexner"
- [ ] `link_external_entity` creates a link
- [ ] `create_location` creates a location record
- [ ] 15 locations seeded
- [ ] 12 datasets seeded
- [ ] `lookup_person` finds "Jean Luk Brunnel" → Jean-Luc Brunel (alias fuzzy match)
- [ ] `lookup_person` finds "Ghislane Maxwell" → Ghislaine Maxwell
- [ ] `get_investigation_stats` includes external_sources, external_entities, locations, datasets counts
- [ ] All 43 existing tools still work (no regressions)
- [ ] **Tool count: 43 → 49**
- [ ] `AUDIT_REPORT.md` produced with findings

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| SQL migration (Supabase) | Run | `external_urls` columns + `external_sources` + `external_entities` tables |
| `src/tools/external.ts` | Create | 4 tools: search_external_sources, get_entity_external_links, search_external_entities, link_external_entity |
| `src/tools/sightings.ts` | Modify | Add `create_location` tool (1 new tool) |
| `src/tools/entities.ts` | Modify | Add `external_urls` to create/update |
| `src/tools/suspects.ts` | Modify | Add `external_urls` to create/update |
| `src/tools/utility.ts` | Modify | Fix `lookup_person` alias matching + add stats for new tables |
| `src/tools/index.ts` | Modify | Register external tools module |
| `scripts/seed-external-sources.ts` | Create | Seed 8 external sources |
| `scripts/seed-locations.ts` | Create | Seed 15 known locations |
| `scripts/seed-datasets.ts` | Create | Seed 12 dataset records |
| `scripts/seed-external-entities.ts` | Create | Import rhowardstone person registry (~1,536 records) |
| `data/persons_registry.json` | Download | rhowardstone person registry data file |
| `AUDIT_REPORT.md` | Create | Codebase audit findings |
