/**
 * EFTA Investigation MCP Server — Fixed for Claude.ai Connector
 * 
 * Key fixes from previous version:
 * 1. Uses STATELESS pattern (fresh server+transport per request, no session tracking)
 * 2. Returns 405 (not 400) for GET/DELETE — Claude interprets this as "POST-only, proceed"
 * 3. Doesn't require Accept: text/event-stream (JSON responses work for stateless)
 * 4. Uses @modelcontextprotocol/sdk v1.x StreamableHTTPServerTransport correctly
 * 5. Optional bearer token auth (set MCP_AUTH_TOKEN env var)
 * 
 * Transport: Stateless Streamable HTTP (recommended for Claude.ai custom connectors)
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerTools } from './tools/index.js';
import { getCorpusDb, getConcordanceDb } from './db/sqlite.js';
import corpusApi from './api/corpus.js';
import concordanceApi from './api/concordance.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;

// ---------------------------------------------------------------------------
// Helper: Create a fresh MCP server instance (stateless = new per request)
// ---------------------------------------------------------------------------
function createServer(): McpServer {
  const server = new McpServer(
    {
      name: 'efta-investigation',
      version: '1.0.0',
    },
    { capabilities: { logging: {} } }
  );
  registerTools(server);
  return server;
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();

// CORS — allow Claude.ai origin
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Mcp-Session-Id', 'Accept'],
  exposedHeaders: ['Mcp-Session-Id'],
}));

// Parse JSON bodies
app.use(express.json());

// Optional bearer token auth
if (AUTH_TOKEN) {
  app.use('/mcp', (req: Request, res: Response, next: NextFunction) => {
    // Skip auth for OPTIONS (preflight)
    if (req.method === 'OPTIONS') return next();
    
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  });
  console.error('Auth enabled — Bearer token required on /mcp');
}

// ---------------------------------------------------------------------------
// MCP Endpoint: POST /mcp — the main handler (stateless)
// ---------------------------------------------------------------------------
app.post('/mcp', async (req: Request, res: Response) => {
  try {
    // Create fresh server + transport per request (stateless pattern)
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless — no session tracking
    });

    // Connect server to transport
    await server.connect(transport);

    // Let transport handle the request
    await transport.handleRequest(req, res, req.body);

    // Clean up when response finishes
    res.on('close', () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error('MCP transport error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

// ---------------------------------------------------------------------------
// MCP Endpoint: GET /mcp — 405 Method Not Allowed (stateless servers don't support SSE)
// ---------------------------------------------------------------------------
app.get('/mcp', (_req: Request, res: Response) => {
  res.writeHead(405, {
    Allow: 'POST',
    'Content-Type': 'application/json',
  });
  res.end(JSON.stringify({
    jsonrpc: '2.0',
    error: {
      code: -32000,
      message: 'Method not allowed. Use POST for MCP requests.',
    },
    id: null,
  }));
});

// ---------------------------------------------------------------------------
// MCP Endpoint: DELETE /mcp — 405 Method Not Allowed (stateless = no sessions to delete)
// ---------------------------------------------------------------------------
app.delete('/mcp', (_req: Request, res: Response) => {
  res.writeHead(405, {
    Allow: 'POST',
    'Content-Type': 'application/json',
  });
  res.end(JSON.stringify({
    jsonrpc: '2.0',
    error: {
      code: -32000,
      message: 'Method not allowed. This server is stateless.',
    },
    id: null,
  }));
});

// ---------------------------------------------------------------------------
// REST API — plain JSON endpoints for Vercel proxy (no MCP framing)
// ---------------------------------------------------------------------------
const API_TOKEN = process.env.API_AUTH_TOKEN;

if (API_TOKEN) {
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS') return next();
    const token = req.headers['x-api-key'] || req.headers.authorization?.replace('Bearer ', '');
    if (token !== API_TOKEN) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  });
  console.error('API auth enabled — X-Api-Key or Bearer token required on /api/*');
}

app.use('/api/corpus', corpusApi);
app.use('/api/concordance', concordanceApi);

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    server: 'efta-investigation',
    version: '1.0.0',
    transport: 'streamable-http',
    mode: 'stateless',
    databases: {
      corpus: !!getCorpusDb(),
      concordance: !!getConcordanceDb(),
    },
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.error(`EFTA MCP server running on http://0.0.0.0:${PORT}`);
  console.error(`MCP endpoint: http://localhost:${PORT}/mcp`);
  console.error(`REST API:     http://localhost:${PORT}/api/corpus/search?q=...`);
  console.error(`Health check: http://localhost:${PORT}/health`);
  console.error('');
  console.error('Mode: Stateless Streamable HTTP (no sessions)');
  console.error(`MCP auth:  ${AUTH_TOKEN ? 'Bearer token required' : 'DISABLED'}`);
  console.error(`API auth:  ${API_TOKEN ? 'X-Api-Key required' : 'DISABLED'}`);
});

// Handle shutdown
process.on('SIGINT', () => {
  console.error('Shutting down...');
  process.exit(0);
});
