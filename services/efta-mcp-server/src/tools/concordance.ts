import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolResponse, errorResponse } from '../supabase.js';
import { getConcordanceDb } from '../db/sqlite.js';

// ---------------------------------------------------------------------------
// Concordance tools — DOJ production metadata (1.38M documents)
// Source: rhowardstone/Epstein-research-data v5.1 concordance_complete.db
// ---------------------------------------------------------------------------

const DB_MISSING = 'Concordance DB not available. Run: cd services/efta-mcp-server/data && ./download.sh';

function normalizeEfta(input: string): string {
  const stripped = input.replace(/^EFTA/i, '');
  return `EFTA${stripped.padStart(8, '0')}`;
}

export function registerConcordanceTools(server: McpServer) {

  // ── concordance_lookup ────────────────────────────────────────────────────
  server.registerTool(
    'concordance_lookup',
    {
      title: 'Look Up DOJ Production Metadata',
      description:
        'Look up DOJ production metadata for a document by EFTA number. Returns the original filename, ' +
        'folder path, author, custodian, dates, and email headers (from/to/cc/subject) from the DOJ concordance. ' +
        'This reveals who created, held, or sent a document — critical for establishing custody chains. ' +
        'Source: DOJ production concordance (1.38M documents).',
      inputSchema: {
        efta_number: z.string().describe('EFTA number (e.g. "EFTA02731623" or "02731623")'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ efta_number }) => {
      const db = getConcordanceDb();
      if (!db) return errorResponse(DB_MISSING);

      const efta = normalizeEfta(efta_number);
      try {
        const row = db.prepare(`
          SELECT bates_begin, bates_end, original_filename, document_extension,
                 original_folder_path, author, custodian, date_sent,
                 email_from, email_to, email_cc, email_subject, efta_number
          FROM documents
          WHERE efta_number = ?
        `).get(efta);

        if (!row) return errorResponse(`No concordance record found for ${efta}`);

        return toolResponse({
          success: true,
          data: row,
          message: `DOJ production metadata for ${efta}`,
        });
      } catch (err: unknown) {
        return errorResponse(`Concordance lookup failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );

  // ── concordance_search ────────────────────────────────────────────────────
  server.registerTool(
    'concordance_search',
    {
      title: 'Search DOJ Production Metadata',
      description:
        'Search the DOJ concordance by custodian, author, original filename, or folder path. ' +
        'Use this to find all documents held by a specific custodian, created by an author, ' +
        'or stored in a particular folder structure. Reveals document custody chains and organizational patterns. ' +
        'Source: DOJ production concordance (1.38M documents).',
      inputSchema: {
        query: z.string().describe('Search term (name, filename, or folder path)'),
        field: z.enum(['custodian', 'author', 'original_filename', 'original_folder_path'])
          .describe('Which field to search'),
        limit: z.number().min(1).max(100).default(25).describe('Max results'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, field, limit }) => {
      const db = getConcordanceDb();
      if (!db) return errorResponse(DB_MISSING);

      try {
        const sql = `
          SELECT efta_number, bates_begin, bates_end, original_filename,
                 author, custodian, date_sent, email_subject
          FROM documents
          WHERE ${field} LIKE ?
          LIMIT ?
        `;
        const results = db.prepare(sql).all(`%${query}%`, limit) as Record<string, unknown>[];

        // Get total count for context
        const countSql = `SELECT COUNT(*) as total FROM documents WHERE ${field} LIKE ?`;
        const countRow = db.prepare(countSql).get(`%${query}%`) as { total: number };

        return toolResponse({
          success: true,
          data: results,
          count: results.length,
          total_count: countRow.total,
          message: `Concordance search: ${field} matching "${query}" (${results.length} of ${countRow.total})`,
        });
      } catch (err: unknown) {
        return errorResponse(`Concordance search failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );

  // ── concordance_email_threads ─────────────────────────────────────────────
  server.registerTool(
    'concordance_email_threads',
    {
      title: 'Search Email Communication Metadata',
      description:
        'Search email metadata in the DOJ concordance — sender (email_from), recipient (email_to), ' +
        'CC list (email_cc), and subject lines (email_subject). Use this to reconstruct communication ' +
        'patterns between specific people, find all emails from/to a person, or trace email chains by subject. ' +
        'Source: DOJ production concordance.',
      inputSchema: {
        query: z.string().describe('Search term (email address, name, or subject keyword)'),
        field: z.enum(['email_from', 'email_to', 'email_cc', 'email_subject'])
          .describe('Which email field to search'),
        limit: z.number().min(1).max(100).default(25).describe('Max results'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, field, limit }) => {
      const db = getConcordanceDb();
      if (!db) return errorResponse(DB_MISSING);

      try {
        const sql = `
          SELECT efta_number, date_sent, email_from, email_to, email_cc,
                 email_subject, original_filename, custodian
          FROM documents
          WHERE ${field} LIKE ? AND ${field} IS NOT NULL AND ${field} != ''
          ORDER BY date_sent DESC
          LIMIT ?
        `;
        const results = db.prepare(sql).all(`%${query}%`, limit) as Record<string, unknown>[];

        const countSql = `SELECT COUNT(*) as total FROM documents WHERE ${field} LIKE ? AND ${field} IS NOT NULL AND ${field} != ''`;
        const countRow = db.prepare(countSql).get(`%${query}%`) as { total: number };

        return toolResponse({
          success: true,
          data: results,
          count: results.length,
          total_count: countRow.total,
          message: `Email search: ${field} matching "${query}" (${results.length} of ${countRow.total})`,
        });
      } catch (err: unknown) {
        return errorResponse(`Email search failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}
