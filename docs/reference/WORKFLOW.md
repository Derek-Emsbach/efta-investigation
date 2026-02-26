# Data Workflow Guide

How documents, entities, connections, and investigations flow through the system.

## Three Workflows

### Workflow 1: Deep Analysis in Claude Chat

For high-value documents that need human + AI analysis together. This is how we reviewed DS12.

**Process:**
1. Review documents together in Claude project chat
2. Extract findings, build narrative, identify connections
3. At session end, produce structured JSON export:
   ```
   docs/sessions/YYYY-MM-DD-description.json
   ```
4. Run import:
   ```bash
   pnpm run import:session docs/sessions/YYYY-MM-DD-description.json
   ```
5. Web app updates immediately from Supabase
6. Commit and push:
   ```bash
   git add . && git commit -m "session: DS9 batch X - summary" && git push
   ```

**Use for:** Complex prosecution chains, investigation threads, entity profile narratives, anything requiring judgment about evidence significance.

### Workflow 2: Automated Bulk Processing

For large dataset uploads where the pipeline handles extraction.

**Process:**
1. Upload zip via admin UI or point to Google Drive URL
2. Worker unpacks → creates queued record per file
3. Pipeline processes each document (7 stages):
   - Ingest → Forensics → Extract → Entities → Redactions → Cross-ref → Classify
4. Results:
   - **Auto-approved:** Routine documents with no new entities, no suspect redactions, no flags. Published immediately with "machine-reviewed" tag.
   - **Flagged for review:** New entities detected, suspect redactions, cross-reference matches, high priority scores. Lands in Review Queue.
5. Admin reviews flagged items in review dashboard

**Auto-approve threshold:** A document is auto-approved when ALL of:
- No new (unmatched) entity names detected
- No redaction classified as Category C or D
- Document type is routine (not FBI 302, prosecution memo, or court filing)
- No cross-reference match to active investigation
- Priority score ≥ 7 (low priority)

**Flag for review when ANY of:**
- New entity name detected (not in database)
- Redaction classified Category C or D
- Document type is high-value (FBI 302, prosecution memo, court filing, victim statement)
- Cross-reference matches active investigation
- Priority score ≤ 6
- Tier 1 or Tier 2 entity mentioned
- Error in any processing stage

### Workflow 3: Hybrid (Day-to-Day Reality)

1. **Morning:** Upload DS9 batch to processing pipeline. Let it run.
2. **Afternoon:** Review queue — confirm/edit/reject flagged findings (30 min).
3. **Evening:** Deep analysis session in Claude chat on high-value flagged docs.
4. **End of day:** Import session data, commit, push.

## What Gets Updated Automatically vs. Manually

| Action | Automatic | Manual | Notes |
|--------|-----------|--------|-------|
| Document record created | ✅ | | Every file gets a DB record on ingest |
| File stored in R2 | ✅ | | Original + thumbnail |
| Metadata extracted | ✅ | | PDF forensics are deterministic |
| Text extracted | ✅ | | PyMuPDF + OCR fallback |
| Document type classified | ✅ | | Pattern matching on content |
| Known entity linked | ✅ | | Name matching against existing DB |
| New entity created (draft) | ✅ | ⚠️ Review | System creates draft, you confirm |
| Entity tier assigned | | ✅ | Too consequential for automation |
| Entity tier changed | | ✅ | Always requires human judgment + justification |
| Entity bio/narrative written | | ✅ | Requires analysis and writing |
| Redaction detected | ✅ | | Black rectangle detection |
| Redaction classified A-D | ⚠️ Suggested | ✅ Confirm | System guesses, you verify |
| Cross-reference found | ✅ | | Date + entity co-occurrence matching |
| Connection suggested | ⚠️ Suggested | ✅ Confirm | System detects co-occurrence, you define relationship |
| Connection type/strength set | | ✅ | "connected_to" vs "paid_by" requires judgment |
| Timeline event created | ⚠️ Suggested | ✅ Confirm | System detects dates, you write significance |
| New investigation opened | | ✅ | Pattern recognition requires human insight |
| Investigation updated | | ✅ | Adding findings, closing questions |
| Evidence item created | | ✅ | Defining what constitutes evidence requires judgment |
| Document published to frontend | ✅ or ⚠️ | | Auto if routine, flagged if complex |

## How Specific Things Flow

### New Investigation Thread Discovered

1. You're reviewing documents (in chat or review queue)
2. You notice a pattern: multiple docs showing coordinated behavior
3. Create investigation record:
   - Name, status, summary, initial open questions
4. Link relevant entities and documents to the investigation
5. From that point: processing pipeline auto-links new documents mentioning same entities/patterns

### New Entity Discovered

1. Pipeline detects name not in database during text extraction
2. Creates draft entity: `processing_status = 'needs_review'`, default Tier 4
3. Appears in review queue: "New entity: John Smith — found in EFTA00045123"
4. You review: set correct tier, category, write initial bio
5. Confirm → entity is active, future documents auto-link

### Connection Discovered

**Automated path:**
1. Pipeline finds Entity A and Entity B in same document
2. Creates suggested connection: type "co_occurrence", strength "circumstantial"
3. Appears in review queue
4. You upgrade: change type to "paid_by", strength to "documented"

**Manual path (during deep analysis):**
1. You notice payment from Trust A → LLC B on same day as flight log
2. Create connection with specific type, strength, and source documents
3. Both entity profiles immediately show the connection

### Entity Tier Change

1. System flags: "Entity X (Tier 4) now appears in 7 documents, 2 contain allegations"
2. You review the evidence
3. Update tier with justification: "Promoted to Tier 3 based on victim journal entries in EFTA02731420"
4. System logs: old tier, new tier, date, justification, who changed it
5. Entity profile shows tier history

## AI Assistant Integration

### Three AI Interfaces

The platform has three AI-powered interfaces, each serving a different workflow:

#### 1. Detective (In-Dashboard, `/assistant`)

Chat interface with full database read access + write suggestions. Uses Claude API with tool use.

**Capabilities:**
- **Connection discovery:** "What connections am I missing for Leon Black?" → queries all documents, entities, timeline overlaps
- **Anomaly detection:** "These 3 documents share a date and entities but aren't linked"
- **Evidence assembly:** "Build the evidence summary for Entity X" → pulls all evidence items, documents, connections
- **Gap analysis:** "Which Tier 3 entities have fewer than 3 source documents?" → identifies under-investigated leads

**Technical:** Claude API (claude-sonnet-4-5-20250929) with 12 read tools + 5 suggestion tools. SSE streaming. Conversation persistence. One-click approve/dismiss on suggestions.

#### 2. Archer (Review Copilot, `/review` right panel)

Document-specific AI analysis embedded in the 3-column review page. Analyzes the currently-selected document.

**Capabilities:**
- Brief first impression → numbered analysis sections → drill-down
- Entity extraction with in-PDF annotation highlighting
- Significance assessment and review action recommendation
- Write tools: create entities, events, and entity-document links directly

**Technical:** Claude API with prompt caching (90% cost reduction). System prompt enriched with R2 full text (30K chars). `get_document_text` tool for on-demand page-range access.

#### 3. MCP Server (Claude.ai Desktop, port 3001)

Primary interface for deep investigation sessions. Connects Claude.ai to live investigation data.

**Capabilities:**
- Full read/write access to all Supabase tables (entities, documents, events, connections, suspects, sightings, locations)
- SQLite corpus search (6.3GB full text + 940MB redaction analysis)
- Document deep reads via `corpus_get_document_text` (page-range access)
- Fuzzy entity lookup (`lookup_person`) across entities + suspect watchlist
- Batch operations (`batch_link_entities_to_document`)

**Technical:** 58 tools across 13 domain modules. Express + `@modelcontextprotocol/sdk` StreamableHTTP transport. See `services/efta-mcp-server/`.

### MCP Investigation Workflow (Most Common)

This is the primary way investigation data enters the database now.

**Process:**
1. Open Claude.ai with MCP server connected
2. Identify a target document (by Bates number or corpus search)
3. Read full text via `corpus_get_document_text` in page-range chunks
4. Analyze content, identify entities, events, connections
5. Lock findings into DB:
   - `lookup_person` → find or create entities (via `promote_suspect` if needed)
   - `batch_link_entities_to_document` → link all found entities
   - `create_event` + `link_entity_to_event` → timeline entries
   - `create_connection` → relationship records
   - `create_suspect` → add to watchlist for future investigation
6. Write analysis report to `docs/investigation/{EFTA}_Analysis.md`
7. Commit and push

**Key gotchas:**
- `lookup_person` returns suspect IDs — must `promote_suspect` before using as FK
- `batch_link_entities_to_document` needs document UUID, not Bates number — get UUID via `get_document` first
- `corpus_get_document_text` limited to ~30K chars per call — use `start_page`/`end_page` params for long documents
- Always verify `lookup_person` fuzzy matches — common surnames return wrong entities

## Dataset Progress Tracking

The dashboard always shows:

```
Dataset 12:  ████████████████████░  137/152 (90.1%)  COMPLETED
Dataset 9:   ░░░░░░░░░░░░░░░░░░░░  0/533,786 (0%)   NOT STARTED
Dataset 11:  ░░░░░░░░░░░░░░░░░░░░  0/331,655 (0%)   NOT STARTED
Dataset 8:   ░░░░░░░░░░░░░░░░░░░░  0/11,000+ (0%)   NOT STARTED
...
```

Each bar breaks down into: queued | processing | extracted | needs_review | reviewed | published

## Session End Checklist

After every review session (chat or dashboard):

1. ☐ All findings exported (JSON or through review queue)
2. ☐ New entities confirmed with correct tiers
3. ☐ New connections saved with types and sources
4. ☐ Timeline events created for dated findings
5. ☐ Investigation threads updated with new findings
6. ☐ Open questions updated (new questions added, resolved ones closed)
7. ☐ Git commit with descriptive message
8. ☐ Push to GitHub (triggers Vercel deploy)
