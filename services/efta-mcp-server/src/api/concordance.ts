/**
 * REST API routes for concordance (DOJ production metadata) — consumed by the Vercel web app.
 */

import { Router, Request, Response } from 'express';
import { getConcordanceDb } from '../db/sqlite.js';

const router = Router();

function normalizeEfta(input: string): string {
  return `EFTA${input.replace(/^EFTA/i, '').padStart(8, '0')}`;
}

// ── GET /api/concordance/lookup ───────────────────────────────────────────

router.get('/lookup', (req: Request, res: Response) => {
  const eftaParam = req.query.efta_number as string;
  if (!eftaParam) {
    res.status(400).json({ error: 'efta_number is required' });
    return;
  }

  const db = getConcordanceDb();
  if (!db) {
    res.status(503).json({ error: 'Concordance database not available' });
    return;
  }

  const efta = normalizeEfta(eftaParam);

  try {
    const row = db.prepare(`
      SELECT bates_begin, bates_end, original_filename, document_extension,
             original_folder_path, author, custodian, date_sent,
             email_from, email_to, email_cc, email_subject, efta_number
      FROM documents
      WHERE efta_number = ?
    `).get(efta);

    if (!row) {
      res.status(404).json({ error: `No concordance record found for ${efta}` });
      return;
    }

    res.json(row);
  } catch (err: unknown) {
    res.status(500).json({ error: `Concordance lookup failed: ${err instanceof Error ? err.message : String(err)}` });
  }
});

// ── GET /api/concordance/search ───────────────────────────────────────────

const ALLOWED_FIELDS = new Set(['custodian', 'author', 'original_filename', 'original_folder_path']);

router.get('/search', (req: Request, res: Response) => {
  const query = (req.query.q as string)?.trim();
  const field = req.query.field as string;
  const limit = Math.min(parseInt((req.query.limit as string) ?? '25', 10), 100);

  if (!query) {
    res.status(400).json({ error: 'q is required' });
    return;
  }
  if (!field || !ALLOWED_FIELDS.has(field)) {
    res.status(400).json({ error: `field must be one of: ${[...ALLOWED_FIELDS].join(', ')}` });
    return;
  }

  const db = getConcordanceDb();
  if (!db) {
    res.status(503).json({ error: 'Concordance database not available' });
    return;
  }

  try {
    const sql = `
      SELECT efta_number, bates_begin, bates_end, original_filename,
             author, custodian, date_sent, email_subject
      FROM documents
      WHERE ${field} LIKE ?
      LIMIT ?
    `;
    const results = db.prepare(sql).all(`%${query}%`, limit);

    const countSql = `SELECT COUNT(*) as total FROM documents WHERE ${field} LIKE ?`;
    const countRow = db.prepare(countSql).get(`%${query}%`) as { total: number };

    res.json({
      results,
      total: countRow.total,
      query,
      field,
      limit,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: `Concordance search failed: ${err instanceof Error ? err.message : String(err)}` });
  }
});

// ── GET /api/concordance/emails ───────────────────────────────────────────

const ALLOWED_EMAIL_FIELDS = new Set(['email_from', 'email_to', 'email_cc', 'email_subject']);

router.get('/emails', (req: Request, res: Response) => {
  const query = (req.query.q as string)?.trim();
  const field = req.query.field as string;
  const limit = Math.min(parseInt((req.query.limit as string) ?? '25', 10), 100);

  if (!query) {
    res.status(400).json({ error: 'q is required' });
    return;
  }
  if (!field || !ALLOWED_EMAIL_FIELDS.has(field)) {
    res.status(400).json({ error: `field must be one of: ${[...ALLOWED_EMAIL_FIELDS].join(', ')}` });
    return;
  }

  const db = getConcordanceDb();
  if (!db) {
    res.status(503).json({ error: 'Concordance database not available' });
    return;
  }

  try {
    const sql = `
      SELECT efta_number, date_sent, email_from, email_to, email_cc,
             email_subject, original_filename, custodian
      FROM documents
      WHERE ${field} LIKE ? AND ${field} IS NOT NULL AND ${field} != ''
      ORDER BY date_sent DESC
      LIMIT ?
    `;
    const results = db.prepare(sql).all(`%${query}%`, limit);

    const countSql = `SELECT COUNT(*) as total FROM documents WHERE ${field} LIKE ? AND ${field} IS NOT NULL AND ${field} != ''`;
    const countRow = db.prepare(countSql).get(`%${query}%`) as { total: number };

    res.json({
      results,
      total: countRow.total,
      query,
      field,
      limit,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: `Email search failed: ${err instanceof Error ? err.message : String(err)}` });
  }
});

export default router;
