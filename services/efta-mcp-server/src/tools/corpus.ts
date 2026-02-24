import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolResponse, errorResponse } from '../supabase.js';
import { getCorpusDb, getRedactionDb } from '../db/sqlite.js';

// ---------------------------------------------------------------------------
// EFTA number → dataset mapping (for resolve_url when corpus DB unavailable)
// ---------------------------------------------------------------------------
const DATASET_RANGES: Array<{ ds: number; min: number; max: number }> = [
  { ds: 1, min: 1, max: 4521 },
  { ds: 2, min: 4522, max: 5586 },
  { ds: 3, min: 5705, max: 69044 },
  { ds: 4, min: 69045, max: 90321 },
  { ds: 5, min: 90322, max: 96905 },
  { ds: 6, min: 96906, max: 107252 },
  { ds: 7, min: 107253, max: 117395 },
  { ds: 8, min: 117396, max: 176563 },
  { ds: 9, min: 176564, max: 1243099 },
  { ds: 10, min: 1243100, max: 1524192 },
  { ds: 11, min: 1524193, max: 2640992 },
  { ds: 12, min: 2640993, max: 2731785 },
];

function datasetFromEftaNumber(num: number): number | null {
  for (const r of DATASET_RANGES) {
    if (num >= r.min && num <= r.max) return r.ds;
  }
  return null;
}

/**
 * Normalize EFTA number input to the format stored in the corpus DB: "EFTA########"
 * Accepts: "EFTA02731623", "02731623", "2731623"
 */
function normalizeEfta(input: string): string {
  const stripped = input.replace(/^EFTA/i, '');
  const padded = stripped.padStart(8, '0');
  return `EFTA${padded}`;
}

function numericEfta(efta: string): number {
  return parseInt(efta.replace(/^EFTA/i, ''), 10);
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerCorpusTools(server: McpServer) {

  // ── corpus_search ─────────────────────────────────────────────────────────
  server.registerTool(
    'corpus_search',
    {
      title: 'Search Full-Text Corpus',
      description:
        'Full-text search across the complete EFTA document corpus (1.38M documents, 2.77M pages) by keyword or phrase. ' +
        'Returns EFTA numbers with text snippets. Searches the actual OCR-extracted text of every page in all 12 DOJ datasets. ' +
        'This searches a separate external corpus (rhowardstone) — NOT the Supabase documents table. ' +
        'For Supabase document metadata, use search_documents instead. ' +
        'Supports FTS5 syntax: "leon black" for exact phrase, leon AND black, leon OR wexner, leon NOT epstein.',
      inputSchema: {
        query: z.string().describe('Search term or FTS5 phrase'),
        dataset: z.number().min(1).max(12).optional().describe('Filter to a specific dataset (1-12)'),
        limit: z.number().min(1).max(100).default(20).describe('Max results to return'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, dataset, limit }) => {
      const db = getCorpusDb();
      if (!db) return errorResponse('Full-text corpus not available. Run: cd services/efta-mcp-server/data && ./download.sh');

      try {
        // Use FTS5 MATCH for fast search, with optional dataset filter via JOIN
        if (dataset) {
          const stmt = db.prepare(`
            SELECT p.efta_number, p.page_number,
                   snippet(pages_fts, 2, '>>>', '<<<', '...', 40) AS snippet
            FROM pages_fts
            JOIN documents d ON d.efta_number = pages_fts.efta_number
            JOIN pages p ON p.rowid = pages_fts.rowid
            WHERE pages_fts MATCH ?
              AND d.dataset = ?
            LIMIT ?
          `);
          const results = stmt.all(query, dataset, limit);
          return toolResponse({ success: true, data: results, count: results.length, message: `FTS5 search for "${query}" in dataset ${dataset}` });
        }

        const stmt = db.prepare(`
          SELECT pages_fts.efta_number, pages_fts.page_number,
                 snippet(pages_fts, 2, '>>>', '<<<', '...', 40) AS snippet
          FROM pages_fts
          WHERE pages_fts MATCH ?
          LIMIT ?
        `);
        const results = stmt.all(query, limit);
        return toolResponse({ success: true, data: results, count: results.length, message: `FTS5 search for "${query}"` });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // FTS5 syntax errors are common — provide helpful feedback
        if (msg.includes('fts5')) {
          return errorResponse(`FTS5 query error: ${msg}. Try quoting phrases: "leon black" or using AND/OR operators.`);
        }
        return errorResponse(`Corpus search failed: ${msg}`);
      }
    },
  );

  // ── corpus_get_document_text ──────────────────────────────────────────────
  server.registerTool(
    'corpus_get_document_text',
    {
      title: 'Get Corpus Document Text',
      description:
        'Get the full OCR-extracted text of a document from the external corpus by EFTA number. ' +
        'Returns all pages or a specific page. This retrieves text from the researcher\'s corpus — ' +
        'for text from our own extraction pipeline (stored in R2), use get_document_full_text instead.',
      inputSchema: {
        efta_number: z.string().describe('EFTA number (e.g. "EFTA02731623" or "02731623")'),
        page: z.number().optional().describe('Specific page number (0-indexed). If omitted, returns all pages.'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ efta_number, page }) => {
      const db = getCorpusDb();
      if (!db) return errorResponse('Full-text corpus not available. Run: cd services/efta-mcp-server/data && ./download.sh');

      const efta = normalizeEfta(efta_number);

      if (page !== undefined) {
        const row = db.prepare(
          'SELECT efta_number, page_number, text_content, char_count FROM pages WHERE efta_number = ? AND page_number = ?',
        ).get(efta, page) as { efta_number: string; page_number: number; text_content: string; char_count: number } | undefined;

        if (!row) return errorResponse(`No page ${page} found for ${efta}`);

        // Bypass safeJson for large text — same pattern as get_document_full_text
        const maxLen = 30000;
        const text = row.text_content || '';
        const truncated = text.length > maxLen;
        const output = truncated ? text.slice(0, maxLen) : text;
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              efta_number: row.efta_number,
              page_number: row.page_number,
              char_count: row.char_count,
            }) + '\n\n' + output + (truncated
              ? `\n\n[TRUNCATION_INFO: ${JSON.stringify({ truncated: true, shown_chars: maxLen, total_chars: text.length })}]`
              : ''),
          }],
        };
      }

      // All pages
      const rows = db.prepare(
        'SELECT page_number, text_content, char_count FROM pages WHERE efta_number = ? ORDER BY page_number',
      ).all(efta) as Array<{ page_number: number; text_content: string; char_count: number }>;

      if (rows.length === 0) return errorResponse(`No pages found for ${efta}`);

      // Combine all pages into one text block
      const fullText = rows.map(r => r.text_content || '').join('\n\n--- PAGE BREAK ---\n\n');
      const maxLen = 30000;
      const truncated = fullText.length > maxLen;
      const output = truncated ? fullText.slice(0, maxLen) : fullText;
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            efta_number: efta,
            total_pages: rows.length,
            total_chars: fullText.length,
          }) + '\n\n' + output + (truncated
            ? `\n\n[TRUNCATION_INFO: ${JSON.stringify({ truncated: true, shown_chars: maxLen, total_chars: fullText.length })}]`
            : ''),
        }],
      };
    },
  );

  // ── corpus_count_entity_mentions ──────────────────────────────────────────
  server.registerTool(
    'corpus_count_entity_mentions',
    {
      title: 'Count Entity Mentions in Corpus',
      description:
        'Count how many documents and pages mention a person\'s name across the full corpus, broken down by dataset. ' +
        'Accepts aliases for comprehensive coverage. Use this to assess any person\'s document footprint ' +
        'before deep-diving with corpus_search. Uses FTS5 for fast counting.',
      inputSchema: {
        name: z.string().describe('Primary name to search (use quotes for exact phrase: "Leon Black")'),
        aliases: z.array(z.string()).optional().describe('Additional name variants (e.g. ["Les Wexner", "Leslie Wexner"])'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ name, aliases }) => {
      const db = getCorpusDb();
      if (!db) return errorResponse('Full-text corpus not available. Run: cd services/efta-mcp-server/data && ./download.sh');

      const searchTerms = [name, ...(aliases || [])];

      // Collect all matching EFTA numbers + page numbers across all search terms
      const allMatches = new Map<string, Set<number>>(); // efta -> set of page_numbers

      for (const term of searchTerms) {
        try {
          const rows = db.prepare(`
            SELECT efta_number, page_number FROM pages_fts WHERE pages_fts MATCH ?
          `).all(`"${term.replace(/"/g, '""')}"`) as Array<{ efta_number: string; page_number: number }>;

          for (const r of rows) {
            if (!allMatches.has(r.efta_number)) allMatches.set(r.efta_number, new Set());
            allMatches.get(r.efta_number)!.add(r.page_number);
          }
        } catch {
          // FTS5 error for this term — skip it
        }
      }

      // Group by dataset using the documents table
      const byDataset: Record<number, { documents: number; pages: number }> = {};
      let totalPages = 0;

      // Batch lookup datasets for all matched EFTA numbers
      const eftaList = Array.from(allMatches.keys());
      if (eftaList.length > 0) {
        // Query in batches of 500 to avoid SQLite variable limit
        const batchSize = 500;
        const datasetLookup = new Map<string, number>();

        for (let i = 0; i < eftaList.length; i += batchSize) {
          const batch = eftaList.slice(i, i + batchSize);
          const placeholders = batch.map(() => '?').join(',');
          const rows = db.prepare(
            `SELECT efta_number, dataset FROM documents WHERE efta_number IN (${placeholders})`,
          ).all(...batch) as Array<{ efta_number: string; dataset: number }>;

          for (const r of rows) datasetLookup.set(r.efta_number, r.dataset);
        }

        for (const [efta, pages] of allMatches) {
          const ds = datasetLookup.get(efta) ?? 0;
          if (!byDataset[ds]) byDataset[ds] = { documents: 0, pages: 0 };
          byDataset[ds].documents++;
          byDataset[ds].pages += pages.size;
          totalPages += pages.size;
        }
      }

      return toolResponse({
        success: true,
        data: {
          query: name,
          aliases: aliases || [],
          total_documents: allMatches.size,
          total_pages: totalPages,
          by_dataset: byDataset,
        },
        message: `Found ${allMatches.size} documents (${totalPages} pages) mentioning "${name}"${aliases?.length ? ` + ${aliases.length} aliases` : ''}`,
      });
    },
  );

  // ── corpus_search_redactions ──────────────────────────────────────────────
  server.registerTool(
    'corpus_search_redactions',
    {
      title: 'Search Corpus Redaction Analysis',
      description:
        'Search the redaction analysis database (2.59M redaction records). Can search OCR text recovered from under redaction bars, ' +
        'reconstructed page text, and extracted entities. ' +
        'IMPORTANT: ~98% of records with ocr_text are OCR noise from the scanner attempting to read black redaction bars. ' +
        'Only ~12 documents contain genuinely failed redactions. Do NOT interpret ocr_text as "recovered secret content" without manual verification. ' +
        'Redaction types: proper_redaction (1.76M), text_near_bar (830K), white_rectangle (27). ' +
        'This is the external researcher\'s analysis — for our A-D redaction framework, use search_redactions.',
      inputSchema: {
        query: z.string().describe('Search term'),
        search_in: z.enum(['ocr_text', 'reconstructed_pages', 'extracted_entities']).default('ocr_text')
          .describe('Which table to search: ocr_text (redaction hidden text), reconstructed_pages (reassembled page text), extracted_entities (names/orgs found)'),
        redaction_type: z.string().optional().describe('Filter by type: proper_redaction, text_near_bar, white_rectangle (only for ocr_text search)'),
        min_confidence: z.number().optional().describe('Minimum confidence score (0-1, only for ocr_text search)'),
        limit: z.number().min(1).max(100).default(20),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, search_in, redaction_type, min_confidence, limit }) => {
      const db = getRedactionDb();
      if (!db) return errorResponse('Redaction analysis DB not available. Run: cd services/efta-mcp-server/data && ./download.sh');

      try {
        if (search_in === 'reconstructed_pages') {
          const stmt = db.prepare(`
            SELECT efta_number, page_number, num_fragments,
                   substr(reconstructed_text, 1, 300) AS text_preview,
                   document_type, interest_score, names_found
            FROM reconstructed_pages
            WHERE reconstructed_text LIKE ?
            ORDER BY interest_score DESC
            LIMIT ?
          `);
          const results = stmt.all(`%${query}%`, limit);
          return toolResponse({ success: true, data: results, count: results.length, message: `Reconstructed pages matching "${query}"` });
        }

        if (search_in === 'extracted_entities') {
          const stmt = db.prepare(`
            SELECT efta_number, page_number, entity_type, entity_value, context, dataset_source
            FROM extracted_entities
            WHERE entity_value LIKE ?
            LIMIT ?
          `);
          const results = stmt.all(`%${query}%`, limit);
          return toolResponse({ success: true, data: results, count: results.length, message: `Extracted entities matching "${query}"` });
        }

        // Default: search ocr_text in redactions table
        let sql = `
          SELECT efta_number, page_number, redaction_type,
                 substr(ocr_text, 1, 300) AS ocr_text_preview,
                 confidence, dataset_source
          FROM redactions
          WHERE ocr_text LIKE ?
        `;
        const params: unknown[] = [`%${query}%`];

        if (redaction_type) {
          sql += ' AND redaction_type = ?';
          params.push(redaction_type);
        }
        if (min_confidence !== undefined) {
          sql += ' AND confidence >= ?';
          params.push(min_confidence);
        }
        sql += ' LIMIT ?';
        params.push(limit);

        const results = db.prepare(sql).all(...params);
        return toolResponse({ success: true, data: results, count: results.length, message: `Redaction OCR text matching "${query}"` });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return errorResponse(`Redaction search failed: ${msg}`);
      }
    },
  );

  // ── corpus_resolve_url ────────────────────────────────────────────────────
  server.registerTool(
    'corpus_resolve_url',
    {
      title: 'Resolve EFTA Document URLs',
      description:
        'Given an EFTA number, returns URLs where the original document can be viewed: ' +
        'DOJ source PDF, jmail.world email viewer, and Carstensen research site. ' +
        'Works even without the corpus database (uses EFTA number ranges for dataset lookup).',
      inputSchema: {
        efta_number: z.string().describe('EFTA number (e.g. "EFTA02731623" or "02731623")'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ efta_number }) => {
      const efta = normalizeEfta(efta_number);
      const num = numericEfta(efta);
      const padded = efta.replace(/^EFTA/, '');

      // Try corpus DB for exact dataset, fall back to range lookup
      let dataset: number | null = null;
      let totalPages: number | null = null;
      const db = getCorpusDb();
      if (db) {
        const row = db.prepare('SELECT dataset, total_pages FROM documents WHERE efta_number = ?').get(efta) as
          { dataset: number; total_pages: number } | undefined;
        if (row) {
          dataset = row.dataset;
          totalPages = row.total_pages;
        }
      }
      if (dataset === null) {
        dataset = datasetFromEftaNumber(num);
      }

      if (dataset === null) {
        return errorResponse(`Could not determine dataset for ${efta}. Number ${num} is outside known EFTA ranges.`);
      }

      return toolResponse({
        success: true,
        data: {
          efta_number: efta,
          numeric: num,
          dataset,
          total_pages: totalPages,
          urls: {
            doj: `https://www.justice.gov/epstein/files/DataSet%20${dataset}/EFTA${padded}.pdf`,
            jmail: `https://jmail.world/search?q=EFTA${padded}`,
            carstensen: `https://tommycarstensen.com/epstein/?efta=${padded}`,
          },
        },
      });
    },
  );
}
