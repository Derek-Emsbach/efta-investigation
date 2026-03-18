/**
 * REST API routes for corpus search — consumed by the Vercel web app.
 * These mirror the MCP corpus tools but return plain JSON (no MCP framing).
 */

import { Router, Request, Response } from 'express';
import { getCorpusDb, getRedactionDb } from '../db/sqlite.js';

const router = Router();

// ── EFTA utilities ────────────────────────────────────────────────────────

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
  { ds: 12, min: 2640993, max: 2858497 },
];

function normalizeEfta(input: string): string {
  return `EFTA${input.replace(/^EFTA/i, '').padStart(8, '0')}`;
}

function numericEfta(efta: string): number {
  return parseInt(efta.replace(/^EFTA/i, ''), 10);
}

function datasetFromEftaNumber(num: number): number | null {
  for (const r of DATASET_RANGES) {
    if (num >= r.min && num <= r.max) return r.ds;
  }
  return null;
}

// ── GET /api/corpus/search ────────────────────────────────────────────────

interface CorpusRow {
  efta_number: string;
  page_number: number;
  snippet: string;
}

router.get('/search', (req: Request, res: Response) => {
  const q = (req.query.q as string)?.trim();
  if (!q || q.length < 2) {
    res.status(400).json({ error: 'Query must be at least 2 characters' });
    return;
  }

  const dataset = req.query.dataset ? parseInt(req.query.dataset as string, 10) : undefined;
  const limit = Math.min(parseInt((req.query.limit as string) ?? '20', 10), 100);
  const offset = parseInt((req.query.offset as string) ?? '0', 10);
  const eftaFilter = req.query.efta_number as string | undefined;

  if (dataset !== undefined && (dataset < 1 || dataset > 12)) {
    res.status(400).json({ error: 'Dataset must be between 1 and 12' });
    return;
  }

  const db = getCorpusDb();
  if (!db) {
    res.status(503).json({ error: 'Corpus database not available' });
    return;
  }

  try {
    const fetchLimit = offset + limit;
    let sql = `
      SELECT p.efta_number, p.page_number,
             snippet(pages_fts, 2, '>>>', '<<<', '...', 40) AS snippet
      FROM pages_fts
      JOIN pages p ON p.rowid = pages_fts.rowid`;
    const params: (string | number)[] = [q];

    if (dataset) {
      sql += `\n      JOIN documents d ON d.efta_number = p.efta_number`;
    }

    sql += `\n      WHERE pages_fts MATCH ?`;

    if (eftaFilter) {
      sql += `\n        AND p.efta_number = ?`;
      params.push(normalizeEfta(eftaFilter));
    }
    if (dataset) {
      sql += `\n        AND d.dataset = ?`;
      params.push(dataset);
    }

    sql += `\n      LIMIT ?`;
    params.push(fetchLimit);

    const rows = db.prepare(sql).all(...params) as CorpusRow[];
    const sliced = rows.slice(offset);

    const results = sliced.map((row) => ({
      efta_number: row.efta_number,
      page_number: row.page_number,
      snippet: row.snippet,
      dataset: datasetFromEftaNumber(numericEfta(row.efta_number)),
    }));

    res.json({
      results,
      query: q,
      total: results.length,
      offset,
      limit,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('fts5')) {
      res.status(400).json({
        error: `FTS5 query error: ${msg}. Try quoting phrases: "leon black" or using AND/OR operators.`,
      });
      return;
    }
    res.status(500).json({ error: `Corpus search failed: ${msg}` });
  }
});

// ── GET /api/corpus/text ──────────────────────────────────────────────────

router.get('/text', (req: Request, res: Response) => {
  const eftaParam = req.query.efta_number as string;
  if (!eftaParam) {
    res.status(400).json({ error: 'efta_number is required' });
    return;
  }

  const db = getCorpusDb();
  if (!db) {
    res.status(503).json({ error: 'Corpus database not available' });
    return;
  }

  const efta = normalizeEfta(eftaParam);
  const page = req.query.page !== undefined ? parseInt(req.query.page as string, 10) : undefined;
  const startPage = req.query.start_page !== undefined ? parseInt(req.query.start_page as string, 10) : undefined;
  const endPage = req.query.end_page !== undefined ? parseInt(req.query.end_page as string, 10) : undefined;

  try {
    if (page !== undefined) {
      const row = db.prepare(
        'SELECT efta_number, page_number, text_content, char_count FROM pages WHERE efta_number = ? AND page_number = ?',
      ).get(efta, page) as { efta_number: string; page_number: number; text_content: string; char_count: number } | undefined;

      if (!row) {
        res.status(404).json({ error: `No page ${page} found for ${efta}` });
        return;
      }

      const maxLen = 30000;
      const text = row.text_content || '';
      res.json({
        efta_number: row.efta_number,
        page_number: row.page_number,
        char_count: row.char_count,
        text: text.length > maxLen ? text.slice(0, maxLen) : text,
        truncated: text.length > maxLen,
      });
      return;
    }

    if (startPage !== undefined && endPage !== undefined) {
      const rows = db.prepare(
        'SELECT page_number, text_content, char_count FROM pages WHERE efta_number = ? AND page_number >= ? AND page_number <= ? ORDER BY page_number',
      ).all(efta, startPage, endPage) as Array<{ page_number: number; text_content: string; char_count: number }>;

      if (rows.length === 0) {
        res.status(404).json({ error: `No pages found for ${efta} in range ${startPage}-${endPage}` });
        return;
      }

      res.json({
        efta_number: efta,
        pages: rows.map((r) => ({
          page_number: r.page_number,
          text: r.text_content || '',
          char_count: r.char_count,
        })),
      });
      return;
    }

    // All pages — return metadata + page count only (full text too large for JSON)
    const countRow = db.prepare(
      'SELECT COUNT(*) as count, SUM(char_count) as total_chars FROM pages WHERE efta_number = ?',
    ).get(efta) as { count: number; total_chars: number } | undefined;

    if (!countRow || countRow.count === 0) {
      res.status(404).json({ error: `No pages found for ${efta}` });
      return;
    }

    // Return first page as preview
    const firstPage = db.prepare(
      'SELECT page_number, text_content, char_count FROM pages WHERE efta_number = ? ORDER BY page_number LIMIT 1',
    ).get(efta) as { page_number: number; text_content: string; char_count: number };

    const docRow = db.prepare(
      'SELECT dataset, total_pages, file_size FROM documents WHERE efta_number = ?',
    ).get(efta) as { dataset: number; total_pages: number; file_size: number } | undefined;

    res.json({
      efta_number: efta,
      total_pages: countRow.count,
      total_chars: countRow.total_chars,
      dataset: docRow?.dataset ?? datasetFromEftaNumber(numericEfta(efta)),
      preview: {
        page_number: firstPage.page_number,
        text: (firstPage.text_content || '').slice(0, 2000),
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ error: `Text retrieval failed: ${err instanceof Error ? err.message : String(err)}` });
  }
});

// ── GET /api/corpus/count ─────────────────────────────────────────────────

router.get('/count', (req: Request, res: Response) => {
  const name = (req.query.name as string)?.trim();
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const db = getCorpusDb();
  if (!db) {
    res.status(503).json({ error: 'Corpus database not available' });
    return;
  }

  const aliasesParam = req.query.aliases as string | undefined;
  const aliases = aliasesParam ? aliasesParam.split(',').map((a) => a.trim()).filter(Boolean) : [];
  const searchTerms = [name, ...aliases];

  try {
    const allMatches = new Map<string, Set<number>>();

    for (const term of searchTerms) {
      try {
        const rows = db.prepare(
          'SELECT efta_number, page_number FROM pages_fts WHERE pages_fts MATCH ?',
        ).all(`"${term.replace(/"/g, '""')}"`) as Array<{ efta_number: string; page_number: number }>;

        for (const r of rows) {
          if (!allMatches.has(r.efta_number)) allMatches.set(r.efta_number, new Set());
          allMatches.get(r.efta_number)!.add(r.page_number);
        }
      } catch {
        // FTS5 error for this term — skip
      }
    }

    let totalPages = 0;
    for (const pages of allMatches.values()) {
      totalPages += pages.size;
    }

    res.json({
      name,
      aliases,
      total_documents: allMatches.size,
      total_pages: totalPages,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: `Count failed: ${err instanceof Error ? err.message : String(err)}` });
  }
});

// ── GET /api/corpus/resolve-url ───────────────────────────────────────────

router.get('/resolve-url', (req: Request, res: Response) => {
  const eftaParam = req.query.efta_number as string;
  if (!eftaParam) {
    res.status(400).json({ error: 'efta_number is required' });
    return;
  }

  const efta = normalizeEfta(eftaParam);
  const num = numericEfta(efta);
  const padded = efta.replace(/^EFTA/, '');

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
    res.status(404).json({ error: `Could not determine dataset for ${efta}` });
    return;
  }

  res.json({
    efta_number: efta,
    dataset,
    total_pages: totalPages,
    urls: {
      doj: `https://www.justice.gov/epstein/files/DataSet%20${dataset}/EFTA${padded}.pdf`,
      jmail: `https://jmail.world/search?q=EFTA${padded}`,
      carstensen: `https://tommycarstensen.com/epstein/?efta=${padded}`,
    },
  });
});

export default router;
