import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolResponse, errorResponse } from '../supabase.js';
import { getHandwritingDb } from '../db/sqlite.js';

// ---------------------------------------------------------------------------
// Handwriting transcription tools — 54 pages from 14 MCC inmate witnesses
// Source: rhowardstone/Epstein-research-data v5.1 handwriting_transcriptions.db
// ---------------------------------------------------------------------------

const DB_MISSING = 'Handwriting transcriptions DB not available. Run: cd services/efta-mcp-server/data && ./download.sh';

function normalizeEfta(input: string): string {
  const stripped = input.replace(/^EFTA/i, '');
  return `EFTA${stripped.padStart(8, '0')}`;
}

export function registerHandwritingTools(server: McpServer) {

  // ── handwriting_lookup ────────────────────────────────────────────────────
  server.registerTool(
    'handwriting_lookup',
    {
      title: 'Get Handwriting Transcriptions',
      description:
        'Get page-level transcriptions of handwritten FBI/AUSA documents for a specific EFTA number. ' +
        'Returns transcript text, subject name, interview date, location, case number, redaction count, ' +
        'and unclear markings. These are handwritten interview notes from MCC correctional facility staff ' +
        'and inmate witnesses — 54 pages across 14 witnesses. Often the only record of these interviews.',
      inputSchema: {
        efta_number: z.string().describe('EFTA number (e.g. "EFTA02731623" or "02731623")'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ efta_number }) => {
      const db = getHandwritingDb();
      if (!db) return errorResponse(DB_MISSING);

      const efta = normalizeEfta(efta_number);
      try {
        const rows = db.prepare(`
          SELECT efta_number, page_number, document_type, case_number, serial,
                 subject, subject_role, interview_date, location, transcript,
                 page_of, redaction_count, unclear_count, notes
          FROM transcriptions
          WHERE efta_number = ?
          ORDER BY page_number
        `).all(efta) as Record<string, unknown>[];

        if (rows.length === 0) return toolResponse({
          success: true,
          data: [],
          count: 0,
          message: `No handwriting transcriptions found for ${efta}`,
        });

        return toolResponse({
          success: true,
          data: rows,
          count: rows.length,
          message: `${rows.length} transcribed page(s) from ${efta}`,
        });
      } catch (err: unknown) {
        return errorResponse(`Handwriting lookup failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );

  // ── handwriting_search ────────────────────────────────────────────────────
  server.registerTool(
    'handwriting_search',
    {
      title: 'Search Handwriting Transcriptions',
      description:
        'Search across all 54 transcribed handwritten FBI/AUSA pages. Search by subject name, location, ' +
        'case number, or transcript content. These are firsthand witness accounts from 14 MCC inmate witnesses ' +
        'that may not exist in any typed form — critical for corroborating or contradicting official narratives.',
      inputSchema: {
        query: z.string().describe('Search term (name, location, case number, or transcript keyword)'),
        field: z.enum(['all', 'subject', 'location', 'case_number', 'transcript'])
          .default('all')
          .describe('Which field to search'),
        limit: z.number().min(1).max(50).default(20).describe('Max results'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, field, limit }) => {
      const db = getHandwritingDb();
      if (!db) return errorResponse(DB_MISSING);

      try {
        let sql: string;
        const params: unknown[] = [];

        if (field === 'all') {
          sql = `
            SELECT efta_number, page_number, document_type, case_number,
                   subject, subject_role, interview_date, location,
                   substr(transcript, 1, 500) AS transcript_preview,
                   redaction_count, unclear_count, notes
            FROM transcriptions
            WHERE subject LIKE ? OR location LIKE ? OR case_number LIKE ? OR transcript LIKE ?
            LIMIT ?
          `;
          const q = `%${query}%`;
          params.push(q, q, q, q, limit);
        } else {
          const col = field;
          sql = `
            SELECT efta_number, page_number, document_type, case_number,
                   subject, subject_role, interview_date, location,
                   substr(transcript, 1, 500) AS transcript_preview,
                   redaction_count, unclear_count, notes
            FROM transcriptions
            WHERE ${col} LIKE ?
            LIMIT ?
          `;
          params.push(`%${query}%`, limit);
        }

        const results = db.prepare(sql).all(...params) as Record<string, unknown>[];

        return toolResponse({
          success: true,
          data: results,
          count: results.length,
          message: `Handwriting search: ${field === 'all' ? 'all fields' : field} matching "${query}"`,
        });
      } catch (err: unknown) {
        return errorResponse(`Handwriting search failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}
