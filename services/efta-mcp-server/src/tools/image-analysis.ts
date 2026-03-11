import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolResponse, errorResponse } from '../supabase.js';
import { getImageAnalysisDb } from '../db/sqlite.js';

// ---------------------------------------------------------------------------
// Image analysis tools — 92,095 extracted images analyzed by Qwen2-VL
// Source: rhowardstone/Epstein-research-data v5.1 image_analysis.db
// ---------------------------------------------------------------------------

const DB_MISSING = 'Image analysis DB not available. Run: cd services/efta-mcp-server/data && ./download.sh';

function normalizeEfta(input: string): string {
  const stripped = input.replace(/^EFTA/i, '');
  return `EFTA${stripped.padStart(8, '0')}`;
}

export function registerImageAnalysisTools(server: McpServer) {

  // ── image_analysis_lookup ─────────────────────────────────────────────────
  server.registerTool(
    'image_analysis_lookup',
    {
      title: 'Get Image Analysis for Document',
      description:
        'Get all analyzed images extracted from a specific EFTA document. Returns vision model (Qwen2-VL) ' +
        'descriptions for each image: people identified, text content found, objects, settings, activities, ' +
        'and notable observations. Use this to understand what photographs, diagrams, or embedded images ' +
        'exist in a document without viewing the PDF directly. Source: 92,095 analyzed images.',
      inputSchema: {
        efta_number: z.string().describe('EFTA number (e.g. "EFTA02731623" or "02731623")'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ efta_number }) => {
      const db = getImageAnalysisDb();
      if (!db) return errorResponse(DB_MISSING);

      const efta = normalizeEfta(efta_number);
      try {
        const rows = db.prepare(`
          SELECT image_name, efta_number, page_number, analysis_text,
                 people, text_content, objects, setting, activity, notable, analyzed_at
          FROM images
          WHERE efta_number = ?
          ORDER BY page_number
        `).all(efta) as Record<string, unknown>[];

        if (rows.length === 0) return toolResponse({
          success: true,
          data: [],
          count: 0,
          message: `No analyzed images found for ${efta}`,
        });

        return toolResponse({
          success: true,
          data: rows,
          count: rows.length,
          message: `${rows.length} analyzed image(s) from ${efta}`,
        });
      } catch (err: unknown) {
        return errorResponse(`Image analysis lookup failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );

  // ── image_analysis_search ─────────────────────────────────────────────────
  server.registerTool(
    'image_analysis_search',
    {
      title: 'Search Image Descriptions',
      description:
        'Full-text search across 92,095 image descriptions from the EFTA corpus. Searches people identified, ' +
        'text content, objects, settings, and analysis text. Use this to find photographs of specific people, ' +
        'locations, or activities across all documents. Supports FTS5 syntax: "palm beach" for exact phrase, ' +
        'pool AND party, airplane OR jet. Extremely valuable for visual evidence discovery.',
      inputSchema: {
        query: z.string().describe('Search term or FTS5 phrase'),
        field: z.enum(['all', 'people', 'text_content', 'objects', 'setting', 'activity', 'notable'])
          .default('all')
          .describe('Which field to search (default: all via FTS5)'),
        limit: z.number().min(1).max(100).default(25).describe('Max results'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, field, limit }) => {
      const db = getImageAnalysisDb();
      if (!db) return errorResponse(DB_MISSING);

      try {
        // Try FTS5 first for the "all" field, fall back to LIKE for specific fields
        if (field === 'all') {
          try {
            // Attempt FTS5 search if the table exists
            const ftsRows = db.prepare(`
              SELECT i.image_name, i.efta_number, i.page_number, i.analysis_text,
                     i.people, i.text_content, i.objects, i.setting, i.activity, i.notable
              FROM images_fts fts
              JOIN images i ON i.rowid = fts.rowid
              WHERE images_fts MATCH ?
              LIMIT ?
            `).all(query, limit) as Record<string, unknown>[];

            return toolResponse({
              success: true,
              data: ftsRows,
              count: ftsRows.length,
              message: `FTS5 image search for "${query}"`,
            });
          } catch {
            // FTS5 table may not exist — fall back to LIKE across key fields
            const likeRows = db.prepare(`
              SELECT image_name, efta_number, page_number, analysis_text,
                     people, text_content, objects, setting, activity, notable
              FROM images
              WHERE analysis_text LIKE ? OR people LIKE ? OR text_content LIKE ?
                 OR objects LIKE ? OR setting LIKE ? OR notable LIKE ?
              LIMIT ?
            `).all(
              `%${query}%`, `%${query}%`, `%${query}%`,
              `%${query}%`, `%${query}%`, `%${query}%`,
              limit,
            ) as Record<string, unknown>[];

            return toolResponse({
              success: true,
              data: likeRows,
              count: likeRows.length,
              message: `Image search for "${query}" (LIKE fallback)`,
            });
          }
        }

        // Specific field search via LIKE
        const sql = `
          SELECT image_name, efta_number, page_number, analysis_text,
                 people, text_content, objects, setting, activity, notable
          FROM images
          WHERE ${field} LIKE ?
          LIMIT ?
        `;
        const results = db.prepare(sql).all(`%${query}%`, limit) as Record<string, unknown>[];

        return toolResponse({
          success: true,
          data: results,
          count: results.length,
          message: `Image search: ${field} matching "${query}"`,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('fts5')) {
          return errorResponse(`FTS5 query error: ${msg}. Try quoting phrases: "palm beach" or using AND/OR.`);
        }
        return errorResponse(`Image search failed: ${msg}`);
      }
    },
  );
}
