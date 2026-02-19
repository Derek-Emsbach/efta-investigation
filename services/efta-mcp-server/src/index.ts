#!/usr/bin/env node

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerTools } from './tools.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;

// Create a fresh McpServer per request (stateless — can't reuse across requests)
function createServer(): McpServer {
  const server = new McpServer({
    name: 'efta-investigation',
    version: '1.0.0',
  });
  registerTools(server);
  return server;
}

const app = express();
app.use(cors());

if (AUTH_TOKEN) {
  app.use('/mcp', (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  });
  console.error('Auth enabled — Bearer token required on /mcp');
}

app.all('/mcp', async (req, res) => {
  try {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('MCP transport error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', server: 'efta-investigation', version: '1.0.0' });
});

app.listen(PORT, () => {
  console.error(`EFTA MCP server running on http://localhost:${PORT}/mcp`);
});