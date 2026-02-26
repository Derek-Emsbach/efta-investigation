# EFTA MCP Server — Phase 1: Full-Text Corpus Integration

## Context

I have an MCP (Model Context Protocol) server for an EFTA (Epstein Files Transparency Act) investigation database. The stack is:
- **MCP Server:** Node.js/Express, currently runs on localhost:3001 with Cloudflare tunnel
- **Database:** Supabase PostgreSQL (hosted)
- **Frontend:** Next.js app at efta-investigation.vercel.app
- **Current tools:** 34 MCP tools split into modular files under `src/tools/` (entities, documents, events, connections, redactions, suspects, sightings, utility)
- **Existing patterns:** Each tool module exports definitions + handlers. Server uses `@supabase/supabase-js` for Postgres, `toolResponse()` and `errorResponse()` helpers, `safeJson()` for output truncation.

## What I Need Built

I need to integrate an external SQLite full-text corpus into the MCP server so we can search across 1.38 million DOJ documents instantly. An open-source researcher (rhowardstone) has processed the entire 218 GB DOJ Epstein file release into searchable SQLite databases with FTS5 indexes.

### Step 1: Download the SQLite Databases

Download these files from GitHub releases (v3.0) and store them in the project under `data/`:

```bash
# Full text corpus — 6.08 GB uncompressed, ~2.6 GB compressed (split into 2 parts)
mkdir -p data
cd data
wget https://github.com/rhowardstone/Epstein-research-data/releases/download/v3.0/full_text_corpus.db.gz.part_aa
wget https://github.com/rhowardstone/Epstein-research-data/releases/download/v3.0/full_text_corpus.db.gz.part_ab
cat full_text_corpus.db.gz.part_* > full_text_corpus.db.gz
gunzip full_text_corpus.db.gz
rm full_text_corpus.db.gz.part_*

# Redaction analysis — 0.95 GB
wget https://github.com/rhowardstone/Epstein-research-data/releases/download/v3.0/redaction_analysis_v2.db.gz
gunzip redaction_analysis_v2.db.gz
```

**Important:** These are READ-ONLY databases. We never write to them. Open them with `SQLITE_OPEN_READONLY` flag.

Add `data/*.db` to `.gitignore` — these are too large for git. Document the download steps in `data/README.md`.

### Step 2: Add SQLite Module

Create `src/db/sqlite.js` (or `.ts` if the project uses TypeScript) that:

1. Uses `better-sqlite3` npm package (install it: `npm install better-sqlite3`)
2. Opens both databases in read-only mode on server startup
3. Exposes query functions that the MCP tools will call
4. Handles the case where databases don't exist yet (graceful error, not crash)

```javascript
// Pseudocode for the module
const Database = require('better-sqlite3');
const path = require('path');

let corpusDb = null;
let redactionDb = null;

function initSQLite() {
  const corpusPath = path.join(__dirname, '../../data/full_text_corpus.db');
  const redactionPath = path.join(__dirname, '../../data/redaction_analysis_v2.db');
  
  try {
    corpusDb = new Database(corpusPath, { readonly: true, fileMustExist: true });
    console.log('✅ Full text corpus loaded');
  } catch (e) {
    console.warn('⚠️ Full text corpus not found at', corpusPath);
    console.warn('   Run: cd data && ./download.sh');
  }
  
  try {
    redactionDb = new Database(redactionPath, { readonly: true, fileMustExist: true });
    console.log('✅ Redaction analysis DB loaded');
  } catch (e) {
    console.warn('⚠️ Redaction DB not found at', redactionPath);
  }
}

// Call on server startup
initSQLite();
```

### Step 3: Explore the Database Schema

Before writing tools, explore what tables and columns exist in the SQLite databases. I expect something like:

**full_text_corpus.db:**
- A `pages` table with columns like: `efta_number`, `page_number`, `text_content`, `dataset`
- Possibly an FTS5 virtual table for full-text search

**redaction_analysis_v2.db:**
- A `redactions` table with columns like: `efta_number`, `page_number`, `hidden_text`, `confidence`, `redaction_type`

**Run `.schema` on both databases** first to see the actual structure before implementing tools. The schemas I listed are my best guess — use whatever's actually there.

### Step 4: Add MCP Tools

Create a new tool module: `src/tools/corpus.js` (following the same pattern as existing tool modules)

Add these **5 read-only tools**:

#### 1. `search_corpus`
The most important tool. Full-text search across all 1.38M documents.

```
Input:
  query: string (required) — search term(s)
  dataset: number (optional) — filter to specific dataset (1-12)
  limit: number (optional, default 20, max 100) — results to return
  
Output:
  results: Array of { efta_number, page_number, dataset, text_snippet (first 300 chars of matching page) }
  total_count: number (if available from the DB)
  query: string (echo back)
```

**Search approach:** 
- If the DB has an FTS5 virtual table, use `MATCH` syntax for fast full-text search
- If not, fall back to `LIKE '%query%'` on text_content (slower but works)
- Always return a text snippet so Claude can assess relevance without fetching the full doc

#### 2. `get_document_text`
Get the full extracted text of a specific document by EFTA number.

```
Input:
  efta_number: string (required) — e.g. "EFTA02731623" or "02731623" (handle both)
  page: number (optional) — specific page number, or return all pages
  
Output:
  efta_number: string
  total_pages: number
  pages: Array of { page_number, text_content }
```

**Note:** Normalize the input — strip "EFTA" prefix if present, pad to 8 digits. The DB probably stores as string or integer; match whatever format it uses.

#### 3. `count_entity_mentions`
Count how many documents mention a name, broken down by dataset.

```
Input:
  name: string (required) — person name to search
  aliases: string[] (optional) — additional name variants to include
  
Output:
  name: string
  total_documents: number
  total_pages: number
  by_dataset: { [dataset_number]: { documents: number, pages: number } }
```

**Implementation:** Run the search for the primary name + each alias, deduplicate by efta_number. Group results by dataset. This tells us the document footprint of any person across the entire corpus.

#### 4. `search_redactions`
Search the hidden text recovered from under redactions.

```
Input:
  query: string (required) — search term
  min_confidence: number (optional) — filter by confidence score if available
  limit: number (optional, default 20, max 100)
  
Output:
  results: Array of { efta_number, page_number, hidden_text (first 300 chars), confidence, redaction_type }
  total_count: number
```

**Important caveat in the tool description:** Tell Claude that ~98% of "bad_overlay" redaction records are OCR noise — the scanner tried to read black redaction bars and produced garbage. Only 12 documents contain genuinely failed redactions. The hidden_text field should NOT be interpreted as "recovered secret content" without manual verification.

#### 5. `resolve_efta_url`
Given an EFTA number, return URLs where the document can be viewed.

```
Input:
  efta_number: string (required)
  
Output:
  efta_number: string (normalized)
  dataset: number (looked up from corpus DB or computed from EFTA range)
  urls: {
    doj: "https://www.justice.gov/epstein/files/DataSet {N}/EFTA{########}.pdf"
    jmail: "https://jmail.world/search?q=EFTA{########}" (or null if not an email)
    carstensen: "https://tommycarstensen.com/epstein/?efta={########}"
  }
```

**EFTA-to-dataset mapping:** The corpus DB should have dataset info per document. If not, use these EFTA number ranges:
- DS1: EFTA00000001 - EFTA00004521
- DS2: EFTA00004522 - EFTA00005586
- DS3: EFTA00005705 - EFTA00069044
- DS4: EFTA00069045 - EFTA00090321
- DS5: EFTA00090322 - EFTA00096905
- DS6: EFTA00096906 - EFTA00107252
- DS7: EFTA00107253 - EFTA00117395
- DS8: EFTA00117396 - EFTA00176563
- DS9: EFTA00176564 - EFTA01243099
- DS10: EFTA01243100 - EFTA01524192
- DS11: EFTA01524193 - EFTA02640992
- DS12: EFTA02640993 - EFTA02731785

(Gaps between datasets are not missing — files exist in adjacent datasets.)

### Step 5: Register Tools and Test

1. Import the corpus tools in the main server file alongside existing tool modules
2. Register all 5 new tools in the tools list
3. Test each tool:

```bash
# Test search_corpus
curl -X POST http://localhost:3001/mcp -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0", "method": "tools/call", "id": 1,
  "params": { "name": "search_corpus", "arguments": { "query": "Leon Black", "limit": 5 } }
}'

# Test get_document_text
curl -X POST http://localhost:3001/mcp -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0", "method": "tools/call", "id": 2,
  "params": { "name": "get_document_text", "arguments": { "efta_number": "02731623" } }
}'

# Test count_entity_mentions
curl -X POST http://localhost:3001/mcp -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0", "method": "tools/call", "id": 3,
  "params": { "name": "count_entity_mentions", "arguments": { "name": "Wexner", "aliases": ["Les Wexner", "Leslie Wexner", "L. Wexner"] } }
}'

# Test resolve_efta_url
curl -X POST http://localhost:3001/mcp -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0", "method": "tools/call", "id": 4,
  "params": { "name": "resolve_efta_url", "arguments": { "efta_number": "EFTA00090314" } }
}'
```

### Step 6: Update get_investigation_stats

Add corpus statistics to the existing `get_investigation_stats` tool output:

```json
{
  // ... existing stats (entities, suspects, documents, events) ...
  "corpus": {
    "available": true,
    "total_documents": 1380937,
    "total_pages": 2731785,
    "redaction_records": 2587102
  }
}
```

Query the SQLite DBs for these counts on each call (they're fast on indexed tables).

## Architecture Notes

### File Structure (after changes)
```
project-root/
├── src/
│   ├── tools/
│   │   ├── entities.js
│   │   ├── documents.js
│   │   ├── events.js
│   │   ├── connections.js
│   │   ├── redactions.js
│   │   ├── suspects.js
│   │   ├── sightings.js
│   │   ├── utility.js
│   │   └── corpus.js          ← NEW
│   ├── db/
│   │   └── sqlite.js          ← NEW (SQLite connection manager)
│   └── index.js               ← Main server (import corpus tools here)
├── data/
│   ├── full_text_corpus.db    ← ~6 GB (gitignored)
│   ├── redaction_analysis_v2.db ← ~0.95 GB (gitignored)
│   ├── download.sh            ← Script to download DBs
│   └── README.md              ← Instructions
├── package.json
└── .gitignore                 ← Add data/*.db
```

### Performance Considerations

- `better-sqlite3` is synchronous — this is actually fine for read-only queries and keeps the code simple
- FTS5 queries are fast (milliseconds). `LIKE` queries on 6 GB will be slow (seconds) — use FTS5 if available
- Set `pragma journal_mode = OFF` and `pragma query_only = ON` for read-only safety
- Consider a connection pool or WAL mode if concurrent reads become an issue (unlikely for single-user MCP)

### Tool Description Quality

Write clear, actionable descriptions for each tool so Claude.ai knows when and how to use them. Example:

```
"Search the full EFTA document corpus (1.38M documents, 2.7M pages) by keyword or phrase. 
Returns EFTA numbers with text snippets. Use this to find all documents mentioning a 
person, organization, location, or topic across all 12 DOJ datasets. This searches the 
actual document text — not just titles or metadata."
```

### Error Handling

If the SQLite DBs aren't downloaded yet, the tools should return a clear error message:

```json
{
  "success": false,
  "error": "Full text corpus not available. Download it by running: cd data && ./download.sh",
  "available": false
}
```

Don't crash the server — other tools (Supabase-based) should still work fine.

## After This Is Done

Once the corpus tools are working, I'll use them from Claude.ai to:
1. Run all 13 P1 priority suspects through `count_entity_mentions` to see their document footprint
2. Use `search_corpus` to find the highest-value documents for each suspect
3. Pull specific document text with `get_document_text` for deep analysis
4. Cross-reference redaction patterns with `search_redactions`

This is the single highest-impact addition to the investigation platform. Let's go.
