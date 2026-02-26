# EFTA MCP Server — Phase 2: Public Events & DOJ Accountability

## Context

The EFTA MCP server (services/efta-mcp-server/) currently has 39 tools (34 Supabase + 5 corpus). The Supabase database already has an `events` table used for **investigation timeline events** (things we discover during document review — e.g., "Epstein met X on Y date"). 

Phase 2 adds two NEW tables for **public-facing events** — things happening in the real world around the EFTA releases. These are separate from the investigation `events` table because they serve a different purpose: tracking DOJ behavior, congressional actions, arrests, resignations, and media developments.

## Stack Reminder
- TypeScript (strict mode), ESM modules ("type": "module")
- All local imports use `.js` extension (Node16 resolution)
- Supabase PostgreSQL via `@supabase/supabase-js`
- Existing patterns: Zod schemas, `toolResponse()` / `errorResponse()`, `safeJson()`
- npm (not pnpm)

---

## Step 1: Database Migration (Supabase SQL)

Run this migration in the Supabase SQL editor (or create a migration file if the project uses them):

### Table 1: `public_events`

```sql
-- Public events timeline: congressional actions, DOJ releases, arrests, 
-- resignations, media breaks, community milestones
CREATE TABLE public_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core fields
  date DATE NOT NULL,
  date_end DATE,                    -- For multi-day events (e.g., reading room access period)
  title TEXT NOT NULL,              -- Short headline: "Khanna reads 6 names on House floor"
  description TEXT,                 -- Longer description with context
  
  -- Classification
  category TEXT NOT NULL CHECK (category IN (
    'legislative',          -- Bills passed, votes, discharge petitions
    'congressional_action', -- Reading room visits, floor speeches, letters to DOJ
    'doj_release',          -- Dataset releases, compliance claims
    'doj_action',           -- Deletions, re-redactions, surveillance, false claims
    'criminal_action',      -- Arrests, charges, indictments, investigations opened
    'resignation',          -- Resignations, firings, suspensions
    'court_action',         -- Court filings, rulings, orders
    'media_break',          -- Major investigative reporting, new findings published
    'community_resource',   -- Tools launched (Jmail, rhowardstone), advocacy actions
    'international',        -- Foreign government actions, investigations, diplomatic fallout
    'victim_advocacy',      -- Survivor statements, advocacy group actions
    'other'
  )),
  impact_level TEXT DEFAULT 'medium' CHECK (impact_level IN (
    'critical',   -- Changes the investigation landscape (arrest, major release)
    'high',       -- Significant development (resignation, new evidence published)
    'medium',     -- Notable event (congressional statement, media article)
    'low'         -- Minor/contextual (tool update, routine filing)
  )),
  
  -- References
  source_urls TEXT[],               -- Array of source URLs (news articles, official statements)
  efta_numbers TEXT[],              -- Related EFTA document numbers
  entity_names TEXT[],              -- People involved (by name, for display — not FK)
  
  -- Metadata
  tags TEXT[],                      -- Freeform tags for filtering: 'norway', 'reading_room', 'prince_andrew'
  notes TEXT,                       -- Internal analysis notes
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_public_events_date ON public_events(date DESC);
CREATE INDEX idx_public_events_category ON public_events(category);
CREATE INDEX idx_public_events_impact ON public_events(impact_level);
CREATE INDEX idx_public_events_tags ON public_events USING gin(tags);
CREATE INDEX idx_public_events_entities ON public_events USING gin(entity_names);

-- Full-text search
ALTER TABLE public_events ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(notes, '')), 'C')
  ) STORED;
CREATE INDEX idx_public_events_search ON public_events USING gin(search_vector);
```

### Table 2: `doj_accountability`

```sql
-- DOJ behavior tracker: deletions, re-redactions, surveillance, 
-- compliance failures, misleading statements
CREATE TABLE doj_accountability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core fields
  date DATE NOT NULL,
  title TEXT NOT NULL,              -- Short headline: "DOJ deletes Trump photo EFTA00000468"
  description TEXT NOT NULL,        -- Detailed description with evidence
  
  -- Classification
  action_type TEXT NOT NULL CHECK (action_type IN (
    'file_deletion',        -- Published files removed from DOJ website
    're_redaction',         -- Files republished with additional redactions
    'deadline_violation',   -- Missed EFTA statutory deadlines
    'viewer_surveillance',  -- Monitoring of congressional reading room visitors
    'false_compliance',     -- Misleading claims about EFTA compliance
    'victim_exposure',      -- Victim names/images improperly exposed
    'perpetrator_protection', -- Powerful names redacted while victims exposed
    'metadata_suppression', -- Systematic metadata stripping from eDiscovery
    'obstruction',          -- Active interference with oversight
    'other'
  )),
  severity TEXT NOT NULL CHECK (severity IN (
    'critical',   -- Potential criminal violation (obstruction, contempt)
    'high',       -- Serious compliance failure
    'medium',     -- Concerning pattern
    'low'         -- Minor issue
  )),
  
  -- Evidence
  legal_basis TEXT,                 -- Which EFTA section is violated
  efta_numbers TEXT[],              -- Specific EFTA documents involved
  source_urls TEXT[],               -- Evidence sources
  
  -- Status
  status TEXT DEFAULT 'documented' CHECK (status IN (
    'documented',           -- We've recorded it
    'reported',             -- Reported to Congress or media
    'under_investigation',  -- Being investigated
    'resolved',             -- Addressed/corrected
    'ongoing'               -- Continuing violation
  )),
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_doj_acct_date ON doj_accountability(date DESC);
CREATE INDEX idx_doj_acct_type ON doj_accountability(action_type);
CREATE INDEX idx_doj_acct_severity ON doj_accountability(severity);
CREATE INDEX idx_doj_acct_status ON doj_accountability(status);

-- Full-text search
ALTER TABLE doj_accountability ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(notes, '')), 'C')
  ) STORED;
CREATE INDEX idx_doj_acct_search ON doj_accountability USING gin(search_vector);
```

---

## Step 2: Create `src/tools/public-events.ts` — 4 New Tools

### Tool 1: `search_public_events`
Read tool. Search by date range, category, impact_level, entity name, tag, or full-text query. Returns paginated results ordered by date descending.

```
Input:
  query: string (optional) — full-text search
  category: string (optional) — filter by category enum
  impact_level: string (optional) — filter by impact
  entity_name: string (optional) — filter by entity_names array contains
  tag: string (optional) — filter by tags array contains
  date_from: string (optional) — ISO date, inclusive
  date_to: string (optional) — ISO date, inclusive
  limit: number (optional, default 20, max 50)
  offset: number (optional, default 0)

Output:
  success: true
  count: number (returned)
  total_count: number (matching filters)
  data: Array of public_event records
```

### Tool 2: `create_public_event`
Write tool. Create a new public event.

```
Input:
  date: string (required) — ISO date
  title: string (required) — short headline
  description: string (optional)
  category: string (required) — from enum
  impact_level: string (optional, default 'medium')
  source_urls: string[] (optional)
  efta_numbers: string[] (optional)
  entity_names: string[] (optional)
  tags: string[] (optional)
  notes: string (optional)
  date_end: string (optional) — for multi-day events

Output:
  success: true
  id: uuid
  message: "Public event created: {title}"
  data: created record
```

### Tool 3: `search_doj_actions`
Read tool. Search DOJ accountability records.

```
Input:
  query: string (optional) — full-text search
  action_type: string (optional) — filter by type enum
  severity: string (optional) — filter by severity
  status: string (optional) — filter by status
  date_from: string (optional)
  date_to: string (optional)
  limit: number (optional, default 20, max 50)

Output:
  success: true
  count: number
  total_count: number
  data: Array of doj_accountability records
```

### Tool 4: `log_doj_action`
Write tool. Record a DOJ accountability event.

```
Input:
  date: string (required)
  title: string (required)
  description: string (required)
  action_type: string (required) — from enum
  severity: string (required)
  legal_basis: string (optional)
  efta_numbers: string[] (optional)
  source_urls: string[] (optional)
  status: string (optional, default 'documented')
  notes: string (optional)

Output:
  success: true
  id: uuid
  message: "DOJ action logged: {title}"
  data: created record
```

---

## Step 3: Register Tools

Modify `src/tools/index.ts`:
- Add `import { registerPublicEventTools } from './public-events.js';`
- Add `registerPublicEventTools(server);` call inside `registerTools()`

---

## Step 4: Update `get_investigation_stats`

Modify `src/tools/utility.ts` to add public event and DOJ accountability counts:

```json
{
  // ... existing stats ...
  "public_events": {
    "total": 42,
    "by_category": { "criminal_action": 5, "resignation": 8, ... },
    "by_impact": { "critical": 10, "high": 15, ... }
  },
  "doj_accountability": {
    "total": 15,
    "by_severity": { "critical": 5, "high": 6, ... },
    "by_status": { "documented": 10, "ongoing": 5 }
  }
}
```

---

## Step 5: Seed Data Script

Create `scripts/seed-public-events.ts` (or `.js`) that inserts the initial events via Supabase client. This is a one-time seed — run it manually after the migration.

### Public Events to Seed

Here are the ~50 events to seed. The script should insert all of them in a single batch operation.

**LEGISLATIVE**
1. 2025-11-18 | "House passes EFTA 427-1" | Rep. Clay Higgins sole nay vote | impact: critical | entities: ["Clay Higgins"] | tags: ["efta_passage"]
2. 2025-11-18 | "Senate passes EFTA by unanimous consent" | Same day as House vote | impact: critical | tags: ["efta_passage"]
3. 2025-11-19 | "Trump signs EFTA into law" | Signed without reporters present. 30-day deadline set for Dec 19. | impact: critical | entities: ["Donald Trump"] | tags: ["efta_passage"]

**DOJ RELEASES**
4. 2025-12-19 | "DOJ releases first batch of Epstein files (Datasets 1-8)" | Heavily redacted. 500+ pages entirely blacked out. Less than 1% of total files. | impact: critical | category: doj_release | tags: ["dataset_release", "wave_1"]
5. 2025-12-21 | "16 files disappear from DOJ website within 48 hours of release" | Including EFTA00000468 (Trump photo). No explanation given. | impact: high | category: doj_action | tags: ["deletion"]
6. 2026-01-05 | "DOJ letter to Judge Engelmayer: less than 1% of files released" | DOJ admits only 12,285 of 2M+ documents reviewed by deadline | impact: high | category: doj_action
7. 2026-01-30 | "DOJ releases 3.5M pages (Datasets 9-12)" | DAG Blanche announces 'final release.' Includes 180K images, 2K videos. Age verification gate added. | impact: critical | category: doj_release | entities: ["Todd Blanche"] | tags: ["dataset_release", "wave_5"]

**CONGRESSIONAL ACTIONS**
8. 2026-02-02 | "Blanche claims DOJ in full compliance with EFTA" | Disputed by Khanna, Massie, and EFTA authors. DOJ identified 6M pages but released 3.5M. | impact: high | entities: ["Todd Blanche"] | tags: ["compliance_dispute"]
9. 2026-02-06 | "DOJ opens reading room for unredacted files" | Patrick Davis letter to all 535 members. No electronics allowed, notes only. | impact: high | tags: ["reading_room"]
10. 2026-02-08 | "Massie asks public to identify key redacted documents" | Posted on X asking users which redacted docs he should prioritize in reading room | impact: medium | entities: ["Thomas Massie"] | tags: ["reading_room"]
11. 2026-02-09 | "Khanna and Massie visit DOJ reading room, accuse DOJ of 'breaking the law'" | First congressional reading room visit. Both criticize Bondi and DOJ. | impact: critical | entities: ["Ro Khanna", "Thomas Massie", "Pam Bondi"] | tags: ["reading_room"]
12. 2026-02-09 | "Sen. Lummis: 'Now I see what the big deal is'" | After reviewing unredacted files. | impact: high | entities: ["Cynthia Lummis"] | tags: ["reading_room"]
13. 2026-02-09 | "Rep. Raskin accuses DOJ of coverup, says Trump's name appears 'more than a million times'" | After viewing unredacted files. | impact: high | entities: ["Jamie Raskin", "Donald Trump"] | tags: ["reading_room"]
14. 2026-02-10 | "Khanna reads 6 names on House floor" | Names from unredacted files read publicly for first time. | impact: critical | entities: ["Ro Khanna"] | tags: ["names_revealed"]
15. 2026-02-10 | "Rep. Moskowitz: co-conspirator list 'would surprise you, a lot of them were women'" | After reading room visit. | impact: high | entities: ["Jared Moskowitz"] | tags: ["reading_room"]
16. 2026-02-14 | "AG Bondi submits Section 3 report to Congress" | EFTA-required report listing PEP names, redaction categories, and withheld records. | impact: high | entities: ["Pam Bondi"] | tags: ["section_3_report"]
17. 2026-02-09 | "Raskin accuses DOJ of surveilling members of Congress in reading room" | Claims DOJ attempted to obstruct and intimidate congressional reviewers. | impact: critical | entities: ["Jamie Raskin"] | tags: ["reading_room", "surveillance"]

**DOJ ACTIONS (negative)**
18. 2026-02-10 | "Bondi photographed with printout of Rep. Jayapal's reading room search history" | Evidence of DOJ tracking what congressional members search for in unredacted files | impact: critical | entities: ["Pam Bondi", "Pramila Jayapal"] | tags: ["surveillance", "reading_room"]

**CRIMINAL ACTIONS**
19. 2026-02-06 | "Norway opens investigation into former PM Jagland over Epstein ties" | Økokrim cites EFTA documents showing gifts, travel, loans. Investigation for 'aggravated corruption.' | impact: critical | category: criminal_action | entities: ["Thorbjørn Jagland"] | tags: ["norway", "criminal_investigation"]
20. 2026-02-11 | "Council of Europe waives Jagland's diplomatic immunity" | Enabling Norwegian prosecution. | impact: high | entities: ["Thorbjørn Jagland"] | tags: ["norway"]
21. 2026-02-12 | "Police raid Jagland's properties in Oslo, Risør, and Rauland" | Three properties searched. Formally charged with aggravated corruption. | impact: critical | entities: ["Thorbjørn Jagland"] | tags: ["norway", "arrest"]
22. 2026-02-13 | "Jagland formally charged with aggravated corruption" | Elden Law Firm confirms charges. Jagland denies all charges. Faces up to 10 years. | impact: critical | entities: ["Thorbjørn Jagland"] | tags: ["norway", "charges"]
23. 2026-02-19 | "Prince Andrew arrested on suspicion of misconduct in office" | Thames Valley Police arrest over sharing confidential trade envoy documents with Epstein. Released after ~11 hours. | impact: critical | entities: ["Prince Andrew"] | tags: ["uk", "arrest"]
24. 2026-02-10 | "UK Met Police opens investigation into Peter Mandelson" | Based on EFTA documents showing leaked government intel to Epstein. | impact: high | entities: ["Peter Mandelson"] | tags: ["uk", "criminal_investigation"]
25. 2026-02-XX | "France opens investigation into Jack and Caroline Lang" | Over Epstein connections revealed in EFTA files. | impact: high | entities: ["Jack Lang", "Caroline Lang"] | tags: ["france", "criminal_investigation"]
26. 2026-02-XX | "Norway investigates diplomatic couple Mona Juul and Terje Rød-Larsen" | Juul's children allegedly named in Epstein will for $5M each. Juul suspended as ambassador. | impact: high | entities: ["Mona Juul", "Terje Rød-Larsen"] | tags: ["norway", "criminal_investigation"]

**RESIGNATIONS**
27. 2025-09-XX | "Peter Mandelson fired as UK ambassador to US" | PM Starmer fires Mandelson over Epstein ties. Called Epstein 'my best pal' in files. May have leaked government info. | impact: critical | entities: ["Peter Mandelson", "Keir Starmer"] | tags: ["uk", "firing"]
28. 2025-09-XX | "Morgan McSweeney resigns as Starmer's chief of staff" | Recommended Mandelson for ambassadorship despite known Epstein relationship. | impact: high | entities: ["Morgan McSweeney"] | tags: ["uk", "resignation"]
29. 2026-02-XX | "Slovak NSA Miroslav Lajčák resigns" | Over emails with Epstein revealed in EFTA files. | impact: high | entities: ["Miroslav Lajčák"] | tags: ["slovakia", "resignation"]
30. 2026-02-XX | "Jack Lang resigns from Arab World Institute" | Over Epstein connections. French investigation ongoing. | impact: high | entities: ["Jack Lang"] | tags: ["france", "resignation"]
31. 2026-02-XX | "Crown Princess Mette-Marit issues public apology" | Called interactions with Epstein 'embarrassing, tasteless, and indefensible.' Charities review ties. | impact: high | entities: ["Crown Princess Mette-Marit"] | tags: ["norway", "apology"]
32. 2026-02-XX | "George Mitchell scholarship renamed at multiple universities" | Mitchell Center at University of Maine renamed. | impact: medium | entities: ["George Mitchell"] | tags: ["consequence"]
33. 2026-02-12 | "Kathy Ruemmler announces resignation from Goldman Sachs" | Effective June 30, 2026. Correspondence showed her calling Epstein 'Uncle Jeffrey' and 'older brother.' | impact: high | entities: ["Kathy Ruemmler"] | tags: ["resignation", "goldman_sachs"]
34. 2026-02-XX | "Mona Juul resigns as Norway's ambassador to Jordan and Iraq" | After revelations her children were named in Epstein will for $5M each. | impact: high | entities: ["Mona Juul"] | tags: ["norway", "resignation"]

**MEDIA BREAKS**
35. 2026-01-30 | "CNN discovers 86-page SDNY prosecution memo in release" | 'Investigation into Potential Co-Conspirators' — statements from 24 minor victims and 14 adult victims. Sent to US Attorney Berman Dec 19 2019. | impact: critical | tags: ["prosecution_memo"]
36. 2026-01-30 | "FBI compiled list of sexual assault allegations re: Trump" | August 2025 compilation included in DS9 email chains. Dozens of allegations, many unverified tips. | impact: high | entities: ["Donald Trump"] | tags: ["fbi_list"]
37. 2026-01-30 | "Draft indictment discovered — would have charged 3 others alongside Epstein" | SDFL draft from 2000s names 3 'employees' of Epstein. Never filed. | impact: critical | tags: ["draft_indictment", "prosecution_failure"]
38. 2025-12-19 | "Faulty redactions allow public to recover blacked-out content" | Copy-paste technique reveals hidden text. Traced to 2021 USVI AG office filing. At least 550 entirely blacked-out pages. | impact: high | tags: ["redaction_failure"]

**COMMUNITY RESOURCES**
39. 2026-01-XX | "Jmail launches — Gmail-style interface for Epstein emails" | 1.4M files indexed, 25M+ users. OCR'd with Google Gemini. Created by Riley Walz and Luke Igel. | impact: high | tags: ["community_tool"]
40. 2026-02-XX | "rhowardstone publishes forensic analysis corpus on GitHub" | 100+ reports, SQLite full-text index of 1.38M documents. Public domain. | impact: high | tags: ["community_tool"]
41. 2026-02-XX | "tommycarstensen.com launches EFTA resources hub" | Deletion tracker, financial graph, image gallery, video gallery, EFTA lookup tool. | impact: medium | tags: ["community_tool"]

**ADDITIONAL NOTABLE EVENTS**
42. 2025-11-XX | "House Oversight Committee releases Epstein estate subpoena materials" | 28,500+ pages including 3 emails suggesting Trump knowledge of trafficking practices. | impact: high | tags: ["house_oversight"]
43. 2025-09-XX | "House Oversight releases 33,295 pages from DOJ" | Pre-EFTA release of DOJ investigation materials. | impact: high | tags: ["house_oversight"]
44. 2025-12-XX | "Prince Andrew stripped of royal titles" | Following House Oversight file release scrutiny. | impact: critical | entities: ["Prince Andrew"] | tags: ["uk", "consequence"]
45. 2026-02-19 | "King Charles vows to cooperate with any investigation" | Statement after Prince Andrew's arrest: 'the law must take its course.' | impact: high | entities: ["King Charles III", "Prince Andrew"] | tags: ["uk"]

**NOTE ON DATES:** Several events have approximate dates marked "XX". The seed script should use best-available dates. For events where only the month is known, use the 15th as a reasonable midpoint. These can be corrected later.

### DOJ Accountability Records to Seed

1. **file_deletion** | 2025-12-21 | "DOJ deletes EFTA00000468 (Trump photo) from website" | severity: critical | efta_numbers: ["EFTA00000468"] | legal_basis: "EFTA Section 2 requires full disclosure" | status: documented | entities: ["Donald Trump"]
2. **file_deletion** | 2025-12-21 | "16 files removed from DOJ website within 48 hours of initial release" | severity: critical | legal_basis: "EFTA Section 2" | status: documented
3. **deadline_violation** | 2025-12-19 | "DOJ releases less than 1% of files by statutory deadline" | severity: critical | legal_basis: "EFTA Section 2 — 30-day release requirement" | status: ongoing
4. **false_compliance** | 2026-02-02 | "DAG Blanche claims full EFTA compliance despite releasing only 3.5M of 6M identified pages" | severity: high | legal_basis: "EFTA Section 2" | status: ongoing | entities: ["Todd Blanche"]
5. **viewer_surveillance** | 2026-02-10 | "AG Bondi photographed with printout of Rep. Jayapal's reading room search history" | severity: critical | legal_basis: "Potential obstruction of congressional oversight" | status: documented | entities: ["Pam Bondi", "Pramila Jayapal"]
6. **viewer_surveillance** | 2026-02-09 | "Rep. Raskin accuses DOJ of surveilling members of Congress in reading room" | severity: critical | legal_basis: "Congressional oversight authority" | status: documented | entities: ["Jamie Raskin"]
7. **victim_exposure** | 2026-01-30 | "43+ victim full names exposed in release per WSJ" | severity: critical | legal_basis: "EFTA Section 2(b) — victim protection requirement" | status: ongoing
8. **victim_exposure** | 2026-01-30 | "Dozens of unredacted nude images of victims published" | severity: critical | legal_basis: "EFTA Section 2(b)" | status: ongoing
9. **victim_exposure** | 2026-01-30 | "Edwards provided 350-name victim protection list that DOJ failed to keyword-search" | severity: high | legal_basis: "EFTA Section 2(b)" | status: documented
10. **perpetrator_protection** | 2025-12-19 | "Wexner name initially redacted, unredacted only after congressional pressure" | severity: high | legal_basis: "EFTA Section 2(b) — no redactions based on embarrassment" | status: documented | entities: ["Les Wexner"]
11. **metadata_suppression** | 2025-12-19 | "eDiscovery load files contain only 2 fields instead of standard 20-30" | severity: high | legal_basis: "EFTA Section 2 — document integrity" | status: ongoing
12. **metadata_suppression** | 2025-12-19 | "All PDF metadata systematically stripped — no creation dates, authors, or processing tools" | severity: high | legal_basis: "EFTA Section 2" | status: ongoing
13. **obstruction** | 2026-02-10 | "DOJ tracked and printed individual congressional members' search queries in reading room" | severity: critical | legal_basis: "Potential obstruction of congressional oversight, separation of powers" | status: documented

---

## Step 6: Build + Test

```bash
npm run build          # TypeScript compiles cleanly
npm run dev            # Start dev server
# Run seed script
npx tsx scripts/seed-public-events.ts

# Test tools via curl
curl -X POST http://localhost:3001/mcp -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0", "method": "tools/call", "id": 1,
  "params": { "name": "search_public_events", "arguments": { "category": "criminal_action" } }
}'

curl -X POST http://localhost:3001/mcp -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0", "method": "tools/call", "id": 2,
  "params": { "name": "search_doj_actions", "arguments": { "severity": "critical" } }
}'

curl -X POST http://localhost:3001/mcp -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0", "method": "tools/call", "id": 3,
  "params": { "name": "search_public_events", "arguments": { "entity_name": "Prince Andrew" } }
}'

curl -X POST http://localhost:3001/mcp -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0", "method": "tools/call", "id": 4,
  "params": { "name": "get_investigation_stats", "arguments": {} }
}'
```

## Verification Checklist

- [ ] `npm run build` — TypeScript compiles with no errors
- [ ] `npm run dev` — Server starts, no errors
- [ ] Both new tables exist in Supabase with correct columns and indexes
- [ ] Seed script runs successfully, inserts ~45 events and ~13 accountability records
- [ ] `search_public_events` returns results filtered by category, date, entity
- [ ] `create_public_event` creates a new event and returns the record
- [ ] `search_doj_actions` returns results filtered by type and severity
- [ ] `log_doj_action` creates a new accountability record
- [ ] `get_investigation_stats` includes public_events and doj_accountability sections
- [ ] All 34 existing tools + 5 corpus tools still work (no regressions)
- [ ] Tool count: 39 → 43

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/tools/public-events.ts` | Create | 4 new tool definitions + handlers |
| `src/tools/index.ts` | Modify | Add registration (2 lines) |
| `src/tools/utility.ts` | Modify | Add public event + DOJ stats |
| `scripts/seed-public-events.ts` | Create | One-time seed script for initial data |
| SQL migration | Run in Supabase | Create both tables |

## Notes for Claude Code

- The `public_events` table is NOT the same as the existing `events` table. The `events` table tracks investigation findings. `public_events` tracks real-world developments. Don't confuse them.
- The seed script should use the Supabase client directly (import from existing config), not raw SQL.
- For dates marked "XX" in the seed data, use reasonable approximations — we'll correct them later.
- The `entity_names` field is TEXT[] not a foreign key — it stores display names for easy querying without joins. We can cross-reference with the entities table separately.
- Follow existing patterns exactly: Zod schemas, toolResponse/errorResponse, safeJson, annotations with readOnlyHint for search tools.
