import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolResponse, errorResponse } from '../supabase.js';
import { getAlterationDb } from '../db/sqlite.js';

// ---------------------------------------------------------------------------
// Alteration tools — DOJ document change tracking (212,730 change units)
// Source: rhowardstone/Epstein-research-data v5.1 alteration_results.db
// ---------------------------------------------------------------------------

const DB_MISSING = 'Alteration results DB not available. Run: cd services/efta-mcp-server/data && ./download.sh';

function normalizeEfta(input: string): string {
  const stripped = input.replace(/^EFTA/i, '');
  return `EFTA${stripped.padStart(8, '0')}`;
}

export function registerAlterationTools(server: McpServer) {

  // ── alteration_lookup ─────────────────────────────────────────────────────
  server.registerTool(
    'alteration_lookup',
    {
      title: 'Look Up Document Alterations',
      description:
        'Look up all tracked changes for a specific EFTA document. Returns diff types, categories of changes, ' +
        'names that were removed, LLM classification of sensitivity and justification, and anomaly flags. ' +
        'Use this to determine whether the DOJ modified a specific document between dataset releases and why. ' +
        'Source: 212,730 document change units.',
      inputSchema: {
        efta_number: z.string().describe('EFTA number (e.g. "EFTA02731623" or "02731623")'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ efta_number }) => {
      const db = getAlterationDb();
      if (!db) return errorResponse(DB_MISSING);

      const efta = normalizeEfta(efta_number);
      try {
        const rows = db.prepare(`
          SELECT efta_number, dataset, diff_type, categories,
                 removed_names_json, llm_classification, llm_sensitivity,
                 llm_justification, anomaly_flag
          FROM altered_files
          WHERE efta_number = ?
        `).all(efta) as Record<string, unknown>[];

        if (rows.length === 0) return toolResponse({
          success: true,
          data: [],
          count: 0,
          message: `No alterations recorded for ${efta} — document appears unchanged between releases`,
        });

        return toolResponse({
          success: true,
          data: rows,
          count: rows.length,
          message: `${rows.length} alteration record(s) for ${efta}`,
        });
      } catch (err: unknown) {
        return errorResponse(`Alteration lookup failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );

  // ── alteration_search ─────────────────────────────────────────────────────
  server.registerTool(
    'alteration_search',
    {
      title: 'Search Document Alterations',
      description:
        'Search across 212,730 DOJ document alteration records. Find documents by diff type, sensitivity level, ' +
        'anomaly flags, removed names, or LLM classification. Critical for identifying which documents the DOJ ' +
        'modified between dataset releases — especially those flagged as anomalous or high-sensitivity. ' +
        'Use removed_names to find documents where specific people\'s names were stripped.',
      inputSchema: {
        query: z.string().optional().describe('Text to search in removed_names_json, llm_classification, or llm_justification'),
        anomaly_only: z.boolean().default(false).describe('Only return records with anomaly_flag set'),
        sensitivity: z.string().optional().describe('Filter by llm_sensitivity level (e.g. "high", "critical")'),
        dataset: z.number().optional().describe('Filter to a specific dataset (1-12)'),
        limit: z.number().min(1).max(100).default(25).describe('Max results'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, anomaly_only, sensitivity, dataset, limit }) => {
      const db = getAlterationDb();
      if (!db) return errorResponse(DB_MISSING);

      try {
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (query) {
          conditions.push(`(removed_names_json LIKE ? OR llm_classification LIKE ? OR llm_justification LIKE ?)`);
          const q = `%${query}%`;
          params.push(q, q, q);
        }
        if (anomaly_only) {
          conditions.push(`anomaly_flag IS NOT NULL AND anomaly_flag != '' AND anomaly_flag != '0'`);
        }
        if (sensitivity) {
          conditions.push(`llm_sensitivity LIKE ?`);
          params.push(`%${sensitivity}%`);
        }
        if (dataset) {
          conditions.push(`dataset = ?`);
          params.push(dataset);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const sql = `
          SELECT efta_number, dataset, diff_type, categories,
                 removed_names_json, llm_classification, llm_sensitivity,
                 llm_justification, anomaly_flag
          FROM altered_files
          ${where}
          LIMIT ?
        `;
        params.push(limit);

        const results = db.prepare(sql).all(...params) as Record<string, unknown>[];

        const countSql = `SELECT COUNT(*) as total FROM altered_files ${where}`;
        const countParams = params.slice(0, -1); // exclude LIMIT param
        const countRow = db.prepare(countSql).all(...countParams)[0] as { total: number };

        const filterParts = [
          query ? `text "${query}"` : null,
          anomaly_only ? 'anomalies only' : null,
          sensitivity ? `sensitivity "${sensitivity}"` : null,
          dataset ? `dataset ${dataset}` : null,
        ].filter(Boolean).join(', ');

        return toolResponse({
          success: true,
          data: results,
          count: results.length,
          total_count: countRow.total,
          message: `Alteration search${filterParts ? `: ${filterParts}` : ''} (${results.length} of ${countRow.total})`,
        });
      } catch (err: unknown) {
        return errorResponse(`Alteration search failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}
