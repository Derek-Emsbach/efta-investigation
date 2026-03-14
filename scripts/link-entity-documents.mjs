/**
 * Document Linkage Script
 *
 * Searches the SQLite FTS5 corpus for entity name mentions,
 * cross-references against Supabase documents table,
 * and creates entity_documents links.
 *
 * Usage:
 *   node scripts/link-entity-documents.mjs              # all published entities
 *   node scripts/link-entity-documents.mjs --dry-run    # preview only
 *   node scripts/link-entity-documents.mjs --entity "Dan Snyder"  # single entity
 */

import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Supabase client ──────────────────────────────────────────────────────────
const envFile = readFileSync(join(__dirname, '../apps/web/.env.local'), 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; })
    .filter(Boolean)
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// ── SQLite corpus ────────────────────────────────────────────────────────────
const corpusPath = join(__dirname, '../services/efta-mcp-server/data/full_text_corpus.db');
const corpus = new Database(corpusPath, { readonly: true, fileMustExist: true });
corpus.pragma('journal_mode = OFF');
corpus.pragma('query_only = ON');
console.log('Corpus DB opened:', corpusPath);

// ── Args ─────────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const entityFilter = process.argv.includes('--entity')
  ? process.argv[process.argv.indexOf('--entity') + 1]
  : null;

if (DRY_RUN) console.log('=== DRY RUN MODE ===\n');

// ── Corpus search ────────────────────────────────────────────────────────────
function searchCorpus(name) {
  try {
    const rows = corpus.prepare(`
      SELECT DISTINCT p.efta_number
      FROM pages_fts
      JOIN pages p ON p.rowid = pages_fts.rowid
      WHERE pages_fts MATCH ?
    `).all(`"${name.replace(/"/g, '""')}"`);
    return rows.map(r => r.efta_number);
  } catch {
    return [];
  }
}

function countCorpusPages(name) {
  try {
    const row = corpus.prepare(`
      SELECT COUNT(*) as cnt
      FROM pages_fts
      WHERE pages_fts MATCH ?
    `).get(`"${name.replace(/"/g, '""')}"`);
    return row?.cnt || 0;
  } catch {
    return 0;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Get published entities
  let query = sb.from('entities')
    .select('id,name,slug,tier,aliases,metadata')
    .eq('profile_published', true)
    .order('tier')
    .order('name');

  if (entityFilter) {
    query = query.ilike('name', `%${entityFilter}%`);
  }

  const { data: entities, error } = await query;
  if (error) { console.error('Failed to fetch entities:', error); process.exit(1); }
  console.log(`Processing ${entities.length} published entities...\n`);

  let totalLinked = 0;
  let totalSkipped = 0;
  let totalNew = 0;

  // Skip entities that already have many links (e.g. Epstein with 1,466)
  // and very common names that would be too slow
  const SKIP_THRESHOLD = 500; // entities with 500+ existing links are already well-linked
  const CORPUS_CAP = 10000;   // cap corpus results to avoid giant batch lookups
  const MAX_NEW_LINKS = 5000; // cap new links per entity to keep profiles usable

  for (const entity of entities) {
    // Check existing link count first
    const { count: existingCount } = await sb.from('entity_documents')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', entity.id);

    if ((existingCount || 0) >= SKIP_THRESHOLD) {
      console.log(`  T${entity.tier} ${entity.name.padEnd(35)} already has ${existingCount} links — skipping`);
      totalSkipped += existingCount;
      continue;
    }

    // Build search terms: name + aliases
    const searchTerms = [entity.name];
    if (entity.aliases?.length) {
      searchTerms.push(...entity.aliases);
    }

    // Search corpus for all name variants
    const allEftaNumbers = new Set();
    for (const term of searchTerms) {
      // Skip very short/ambiguous names
      if (term.length < 5) continue;
      // Skip single-word names (too many false positives)
      if (!term.includes(' ') && !term.includes('.')) continue;
      const results = searchCorpus(term);
      results.forEach(efta => allEftaNumbers.add(efta));
      // Cap to prevent mega-queries
      if (allEftaNumbers.size >= CORPUS_CAP) break;
    }

    const corpusHits = allEftaNumbers.size;

    if (corpusHits === 0) {
      console.log(`  T${entity.tier} ${entity.name.padEnd(35)} corpus: 0 docs — skipping`);
      continue;
    }

    // Get existing linked doc IDs
    const existingDocIds = new Set();
    let offset = 0;
    while (true) {
      const { data: batch } = await sb.from('entity_documents')
        .select('document_id')
        .eq('entity_id', entity.id)
        .range(offset, offset + 999);
      if (!batch || batch.length === 0) break;
      batch.forEach(l => existingDocIds.add(l.document_id));
      offset += batch.length;
      if (batch.length < 1000) break;
    }

    // Cross-reference corpus EFTA numbers against Supabase documents table
    const eftaArray = Array.from(allEftaNumbers);
    const matchedDocs = [];

    // Use parallel batches for speed (5 concurrent)
    const BATCH_SIZE = 100;
    const CONCURRENCY = 5;

    for (let i = 0; i < eftaArray.length; i += BATCH_SIZE * CONCURRENCY) {
      const promises = [];
      for (let j = 0; j < CONCURRENCY && i + j * BATCH_SIZE < eftaArray.length; j++) {
        const start = i + j * BATCH_SIZE;
        const batch = eftaArray.slice(start, start + BATCH_SIZE);
        promises.push(
          sb.from('documents')
            .select('id,bates_number')
            .in('bates_number', batch)
            .then(({ data }) => data || [])
        );
      }
      const results = await Promise.all(promises);
      results.forEach(docs => matchedDocs.push(...docs));
    }

    // Filter to docs not already linked, cap at MAX_NEW_LINKS
    const newDocs = matchedDocs.filter(d => !existingDocIds.has(d.id)).slice(0, MAX_NEW_LINKS);

    console.log(`  T${entity.tier} ${entity.name.padEnd(35)} corpus: ${corpusHits} docs  supabase: ${matchedDocs.length}  new: ${newDocs.length}  existing: ${existingDocIds.size}`);

    if (newDocs.length === 0) {
      totalSkipped += matchedDocs.length;
      continue;
    }

    if (DRY_RUN) {
      totalNew += newDocs.length;
      continue;
    }

    // Insert entity_documents links in batches (parallel)
    let inserted = 0;
    const INSERT_BATCH = 50;
    const INSERT_CONCURRENCY = 3;

    for (let i = 0; i < newDocs.length; i += INSERT_BATCH * INSERT_CONCURRENCY) {
      const promises = [];
      for (let j = 0; j < INSERT_CONCURRENCY && i + j * INSERT_BATCH < newDocs.length; j++) {
        const start = i + j * INSERT_BATCH;
        const batch = newDocs.slice(start, start + INSERT_BATCH).map(d => ({
          entity_id: entity.id,
          document_id: d.id,
          role_in_document: 'mentioned',
        }));
        promises.push(
          sb.from('entity_documents')
            .upsert(batch, { onConflict: 'entity_id,document_id,role_in_document' })
            .then(({ error }) => {
              if (error) console.error(`    ERROR: ${error.message}`);
              else inserted += batch.length;
            })
        );
      }
      await Promise.all(promises);
    }

    console.log(`    → Linked ${inserted} new documents`);
    totalLinked += inserted;
    totalNew += newDocs.length;
  }

  console.log(`\n=== Summary ===`);
  console.log(`New links created: ${DRY_RUN ? `${totalNew} (dry run)` : totalLinked}`);
  console.log(`Already linked: ${totalSkipped}`);

  corpus.close();
}

main().catch(console.error);
