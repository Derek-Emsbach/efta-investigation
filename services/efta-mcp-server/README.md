# EFTA Investigation MCP Server

Connects Claude.ai (and other MCP clients) to your EFTA investigation platform's Supabase database and Cloudflare R2 file storage.

## What This Does

During document review sessions in Claude.ai, instead of manually exporting findings as JSON and importing them, Claude can **directly read and write** to your investigation database in real-time:

- **Search** entities, documents, events, connections, redactions
- **Create** new entities, documents, events, evidence items
- **Update** existing records as analysis reveals new information
- **Link** entities to documents and events with roles and context
- **Log** redactions with A-D framework classifications
- **Pull** full document text from R2 for in-conversation analysis

## Quick Start

```bash
# Install dependencies
npm install

# Copy and fill in environment variables
cp .env.example .env
# Edit .env with your Supabase + R2 credentials

# Development (hot reload)
npm run dev

# Production
npm run build
npm start
```

Server starts on `http://localhost:3001` by default.

## Connect to Claude.ai

### Option A: Local Development (via tunnel)

For testing, expose your local server via ngrok or Cloudflare Tunnel:

```bash
# Using ngrok
ngrok http 3001
# → Forwarding: https://abc123.ngrok.app → http://localhost:3001

# Using Cloudflare Tunnel
cloudflared tunnel --url http://localhost:3001
```

Then in Claude.ai:
1. **Settings → Connectors → Add custom connector**
2. URL: `https://abc123.ngrok.app/mcp`
3. Click **Add**

### Option B: Deploy to Production

Deploy anywhere that runs Node.js (Fly.io, Railway, Render, your own VPS):

```bash
# Example: Fly.io
fly launch
fly secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... MCP_AUTH_TOKEN=...
fly deploy
```

Then add `https://your-app.fly.dev/mcp` as a custom connector in Claude.ai.

### Option C: Run alongside your Next.js app

Add the MCP server as a separate process in your existing deployment, or mount the Express routes within your Next.js custom server.

## Authentication

Set `MCP_AUTH_TOKEN` in your `.env` to require a bearer token. When adding the connector in Claude.ai, use the "Advanced settings" to specify your auth headers.

If you leave `MCP_AUTH_TOKEN` unset, the server runs without authentication (fine for local development behind a tunnel).

## Tools Reference

### Read Tools (10)
| Tool | Description |
|------|-------------|
| `search_entities` | Search by name, tier, or category |
| `get_entity` | Full entity details + linked docs/events/connections |
| `search_documents` | Search by Bates number, type, content, status |
| `get_document` | Full doc metadata + entities/redactions/cross-refs |
| `get_document_full_text` | Fetch complete text from R2 (up to 30K chars) |
| `search_events` | Timeline search by keyword, date range, entity |
| `find_connections` | Entity relationship search |
| `search_redactions` | Filter by A-D category, suspect status |
| `get_investigation_stats` | Dashboard stats (counts by status, tier, etc.) |
| `list_datasets` | All EFTA datasets with metadata |

### Write Tools (10)
| Tool | Description |
|------|-------------|
| `create_entity` | Add new person (checks for duplicates first) |
| `update_entity` | Modify existing entity (append aliases, change tier) |
| `create_document_record` | Log document reviewed in chat (bypasses pipeline) |
| `update_document` | Update doc metadata/notes |
| `link_entity_to_document` | Create entity-document link with role |
| `create_event` | Add timeline event |
| `link_entity_to_event` | Connect entities to events |
| `create_connection` | Create entity-entity relationship |
| `create_redaction_record` | Log redaction with A-D classification |
| `create_evidence_item` | Log extracted evidence linked to document |

## Architecture

```
Claude.ai ──HTTP──→ MCP Server ──→ Supabase (all structured data)
                                ──→ R2 (full text, PDFs)
                                
Same tables your web app and processing worker use.
One source of truth.
```

The MCP server uses the **service role key** (like your admin client), bypassing RLS. Access control is handled by:
1. Bearer token authentication
2. Claude.ai's tool approval flow (you approve each action)
3. Tool descriptions that instruct Claude to confirm tier changes with you

## Workflow: Document Review Session

1. Upload document PDFs to the chat (or reference by Bates number)
2. Claude reads the document, you read the document
3. As you discuss findings, Claude calls write tools to log them:
   - New entity found → `create_entity`
   - Document analyzed → `create_document_record`
   - Redaction flagged → `create_redaction_record`
   - Cross-reference spotted → `create_connection`
   - Timeline event → `create_event` + `link_entity_to_event`
4. Your web app shows updates immediately
5. End of session: database is already current, no export/import step
