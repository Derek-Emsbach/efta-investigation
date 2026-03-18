/**
 * Image Auto-Classification + Entity Linking Pipeline
 *
 * Phase 0 (import):    Reads 92K Qwen2-VL image analyses from the corpus SQLite DB,
 *                      matches to Supabase documents by bates number, creates
 *                      document_images records (r2_key='corpus:pending' until actual
 *                      page scans are extracted later).
 *
 * Phase 1 (classify):  Sends corpus descriptions to Claude Haiku in batches for
 *                      image_type classification + caption generation. Updates
 *                      document_images records.
 *
 * Phase 2 (link):      Creates image_entities junction records by joining
 *                      entity_documents → document_images (no AI needed).
 *
 * Usage:
 *   node scripts/classify-and-link-images.mjs [options]
 *
 * Options:
 *   --dry-run       Print stats without updating Supabase
 *   --limit N       Process only first N corpus images (default: all)
 *   --reclassify    Re-classify images even if already classified
 *   --phase X       Run: import, classify, link, or all (default: all)
 *   --batch-size N  Images per Claude API call (default: 50)
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import Database from 'better-sqlite3';
import { readFileSync, writeFileSync, existsSync } from 'fs';

// ── Config ──────────────────────────────────────────────────────────────────

const envFile = readFileSync('apps/web/.env.local', 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; })
    .filter(Boolean)
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const CORPUS_DB_PATH = 'services/efta-mcp-server/data/image_analysis.db';
const CHECKPOINT_PATH = 'scripts/.classify-images-checkpoint.json';

const DRY_RUN = process.argv.includes('--dry-run');
const RECLASSIFY = process.argv.includes('--reclassify');
const LIMIT = (() => {
  const idx = process.argv.indexOf('--limit');
  return idx >= 0 ? parseInt(process.argv[idx + 1], 10) : 0;
})();
const PHASE = (() => {
  const idx = process.argv.indexOf('--phase');
  return idx >= 0 ? process.argv[idx + 1] : 'all';
})();
const BATCH_SIZE = (() => {
  const idx = process.argv.indexOf('--batch-size');
  return idx >= 0 ? parseInt(process.argv[idx + 1], 10) : 50;
})();

const MAX_CONCURRENT = 1;
const VALID_TYPES = ['photo', 'signature', 'map', 'chart', 'graphic', 'embedded', 'unknown'];
const CORPUS_PENDING_PREFIX = 'corpus:pending:';

// ── Helpers ─────────────────────────────────────────────────────────────────

function log(msg) { console.log(`  ${msg}`); }
function hr() { console.log('═'.repeat(60)); }

function loadCheckpoint() {
  if (existsSync(CHECKPOINT_PATH)) {
    return JSON.parse(readFileSync(CHECKPOINT_PATH, 'utf8'));
  }
  return { lastCorpusId: 0, importedCount: 0, classifiedCount: 0, linkedCount: 0 };
}

function saveCheckpoint(data) {
  writeFileSync(CHECKPOINT_PATH, JSON.stringify(data, null, 2));
}

/** Paginated fetch from Supabase (handles 1000-row limit) */
async function fetchAll(table, select, filters = {}) {
  const rows = [];
  const PAGE = 1000;
  let offset = 0;
  let done = false;
  while (!done) {
    let query = sb.from(table).select(select).range(offset, offset + PAGE - 1);
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }
    const { data, error } = await query;
    if (error) throw new Error(`Fetch ${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE) done = true;
    else offset += PAGE;
  }
  return rows;
}

/** Fetch documents by bates numbers in batches of 100 (.in() filter) */
async function fetchDocsByBates(batesNumbers) {
  const results = [];
  const BATCH = 100;
  for (let i = 0; i < batesNumbers.length; i += BATCH) {
    const batch = batesNumbers.slice(i, i + BATCH);
    const { data, error } = await sb.from('documents')
      .select('id,bates_number')
      .in('bates_number', batch);
    if (error) throw new Error(`Fetch docs by bates: ${error.message}`);
    results.push(...(data || []));
  }
  return results;
}

/** Fetch document_images by document_ids in batches of 100 */
async function fetchImagesByDocIds(docIds) {
  const results = [];
  const BATCH = 100;
  for (let i = 0; i < docIds.length; i += BATCH) {
    const batch = docIds.slice(i, i + BATCH);
    const { data, error } = await sb.from('document_images')
      .select('id,document_id,page_number,image_index,image_type,r2_key')
      .in('document_id', batch);
    if (error) throw new Error(`Fetch images by doc_id: ${error.message}`);
    results.push(...(data || []));
  }
  return results;
}

/** Load corpus images from SQLite */
function loadCorpusImages(db) {
  const query = LIMIT
    ? db.prepare('SELECT * FROM images ORDER BY id LIMIT ?')
    : db.prepare('SELECT * FROM images ORDER BY id');
  return LIMIT ? query.all(LIMIT) : query.all();
}

/** Parse image_index from corpus image_name (e.g. EFTA00000001_p1_i0_hash.png → 0) */
function parseImageIndex(imageName) {
  const match = imageName?.match(/_i(\d+)_/);
  return match ? parseInt(match[1], 10) : 0;
}

// ── Phase 0: Import corpus analyses into document_images ────────────────────

async function runImport() {
  hr();
  console.log('  PHASE 0: IMPORT CORPUS ANALYSES');
  hr();

  const db = new Database(CORPUS_DB_PATH, { readonly: true });
  const corpusImages = loadCorpusImages(db);
  log(`Corpus images loaded: ${corpusImages.length}`);

  // Build bates → document UUID map
  const uniqueBates = [...new Set(corpusImages.map(ci => ci.efta_number).filter(Boolean))];
  log(`Unique EFTA numbers: ${uniqueBates.length}`);
  log('Fetching matching documents from Supabase...');
  const docs = await fetchDocsByBates(uniqueBates);
  const batesMap = new Map();
  for (const d of docs) {
    if (d.bates_number) batesMap.set(d.bates_number, d.id);
  }
  log(`Documents found: ${batesMap.size}/${uniqueBates.length}`);

  // Check what already exists in document_images
  const matchedDocIds = [...new Set(batesMap.values())];
  log('Checking existing document_images...');
  const existingImages = await fetchImagesByDocIds(matchedDocIds);
  const existingSet = new Set();
  for (const img of existingImages) {
    existingSet.add(`${img.document_id}:${img.page_number}:${img.image_index}`);
  }
  log(`Existing document_images: ${existingSet.size}`);

  // Build records to insert
  const toInsert = [];
  let noDoc = 0;
  let alreadyExists = 0;

  for (const ci of corpusImages) {
    const docId = batesMap.get(ci.efta_number);
    if (!docId) { noDoc++; continue; }

    const imageIndex = parseImageIndex(ci.image_name);
    const key = `${docId}:${ci.page_number}:${imageIndex}`;
    if (existingSet.has(key)) { alreadyExists++; continue; }

    // Build a condensed analysis summary for metadata
    const analysisFields = {};
    if (ci.people) analysisFields.people = ci.people;
    if (ci.text_content) analysisFields.text_content = ci.text_content;
    if (ci.objects) analysisFields.objects = ci.objects;
    if (ci.setting) analysisFields.setting = ci.setting;
    if (ci.activity) analysisFields.activity = ci.activity;
    if (ci.notable) analysisFields.notable = ci.notable;

    toInsert.push({
      document_id: docId,
      page_number: ci.page_number,
      image_index: imageIndex,
      r2_key: `${CORPUS_PENDING_PREFIX}${ci.image_name}`,
      image_type: 'embedded', // will be classified in Phase 1
      metadata: {
        corpus_image_name: ci.image_name,
        corpus_analysis: analysisFields,
        source: 'corpus_import',
      },
    });

    // Prevent duplicates within this run
    existingSet.add(key);
  }

  log(`To import: ${toInsert.length} | No doc match: ${noDoc} | Already exists: ${alreadyExists}`);

  if (toInsert.length === 0) {
    log('Nothing to import.');
    db.close();
    return { imported: 0 };
  }

  if (DRY_RUN) {
    log('Dry run — no records created.');
    db.close();
    return { imported: 0, wouldImport: toInsert.length };
  }

  // Bulk upsert in batches of 200
  const UPSERT_BATCH = 200;
  let imported = 0;
  let errors = 0;
  for (let i = 0; i < toInsert.length; i += UPSERT_BATCH) {
    const batch = toInsert.slice(i, i + UPSERT_BATCH);
    const { error } = await sb.from('document_images').upsert(batch, {
      onConflict: 'document_id,page_number,image_index',
      ignoreDuplicates: true,
    });
    if (error) {
      console.error(`  [ERROR] Batch at ${i}: ${error.message}`);
      errors++;
    } else {
      imported += batch.length;
    }
    if ((i + UPSERT_BATCH) % 5000 === 0 || i + UPSERT_BATCH >= toInsert.length) {
      log(`Progress: ${imported}/${toInsert.length} imported (${errors} batch errors)`);
    }
  }

  db.close();
  return { imported };
}

// ── Phase 1: Classify with Claude ───────────────────────────────────────────

const CLASSIFY_SYSTEM = `You classify images extracted from government document releases (Epstein Files Transparency Act).
Given a batch of image descriptions from a vision model (Qwen2-VL), classify each and write a short caption.

Types:
- photo: Photographs of people, places, objects, real-world scenes
- signature: Handwritten signatures, initials, handwriting samples
- map: Maps, floor plans, blueprints, aerial/satellite views
- chart: Charts, graphs, tables, spreadsheets, data visualizations
- graphic: Logos, seals, emblems, letterhead, stamps, illustrations, diagrams
- embedded: Scanned text pages, form fields, fax headers, mostly-text images
- unknown: Cannot determine from the description

Return ONLY a JSON array (no markdown fences). Each element: {"idx": <number>, "type": "<type>", "caption": "<caption>"}
Captions: one factual sentence, max 150 characters, no speculation about identity unless explicitly stated.`;

async function classifyBatch(items) {
  const input = items.map((item, i) => {
    const analysis = item.metadata?.corpus_analysis || {};
    return {
      idx: i,
      description: [
        analysis.people && `PEOPLE: ${analysis.people}`,
        analysis.objects && `OBJECTS: ${analysis.objects}`,
        analysis.setting && `SETTING: ${analysis.setting}`,
        analysis.activity && `ACTIVITY: ${analysis.activity}`,
        analysis.notable && `NOTABLE: ${analysis.notable}`,
        // text_content omitted — it's full OCR text, too expensive for classification
        // and not needed (the other fields have enough signal)
      ].filter(Boolean).join('\n'),
    };
  });

  // Skip items with empty descriptions
  const nonEmpty = input.filter(i => i.description.length > 0);
  if (nonEmpty.length === 0) {
    return items.map((_, i) => ({ idx: i, type: 'embedded', caption: null }));
  }

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: CLASSIFY_SYSTEM,
    messages: [{ role: 'user', content: `Classify these ${nonEmpty.length} images:\n\n${JSON.stringify(nonEmpty)}` }],
  });

  const text = response.content[0].text.trim();
  const jsonStr = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');

  try {
    const results = JSON.parse(jsonStr);
    // Map results back to original indices
    const resultMap = new Map(results.map(r => [r.idx, r]));
    return input.map((inp, i) => {
      const r = resultMap.get(inp.idx);
      if (!r) return { idx: i, type: 'embedded', caption: null };
      return {
        idx: i,
        type: VALID_TYPES.includes(r.type) ? r.type : 'unknown',
        caption: typeof r.caption === 'string' ? r.caption.slice(0, 200) : null,
      };
    });
  } catch (e) {
    console.error(`  [WARN] Failed to parse Claude response, falling back to embedded`);
    return items.map((_, i) => ({ idx: i, type: 'embedded', caption: null }));
  }
}

async function runClassify() {
  hr();
  console.log('  PHASE 1: CLASSIFY IMAGES');
  hr();

  // Fetch all corpus-imported images that need classification
  log('Fetching unclassified document_images...');
  const allImages = [];
  const PAGE = 1000;
  let offset = 0;
  let done = false;
  while (!done) {
    let query = sb.from('document_images')
      .select('id,document_id,page_number,image_index,image_type,metadata,r2_key')
      .like('r2_key', `${CORPUS_PENDING_PREFIX}%`)
      .range(offset, offset + PAGE - 1);
    if (!RECLASSIFY) {
      query = query.eq('image_type', 'embedded');
    }
    const { data, error } = await query;
    if (error) throw new Error(`Fetch images: ${error.message}`);
    allImages.push(...(data || []));
    if (!data || data.length < PAGE) done = true;
    else offset += PAGE;
  }

  log(`Images to classify: ${allImages.length}`);

  if (allImages.length === 0) {
    log('Nothing to classify.');
    return { classified: 0, stats: {} };
  }

  // Filter to those with corpus analysis metadata
  const toClassify = allImages.filter(img => img.metadata?.corpus_analysis);
  log(`With corpus analysis data: ${toClassify.length}`);

  // Chunk and classify
  const chunks = [];
  for (let i = 0; i < toClassify.length; i += BATCH_SIZE) {
    chunks.push(toClassify.slice(i, i + BATCH_SIZE));
  }
  log(`Sending ${chunks.length} batches to Claude Haiku (batch size: ${BATCH_SIZE})...`);

  const stats = {};
  let classified = 0;
  let batchesDone = 0;
  const checkpoint = loadCheckpoint();

  for (let i = 0; i < chunks.length; i += MAX_CONCURRENT) {
    const slice = chunks.slice(i, i + MAX_CONCURRENT);
    const tasks = slice.map(chunk => async () => {
      // Retry up to 4 times on rate limit or connection error
      let results;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          results = await classifyBatch(chunk);
          break;
        } catch (e) {
          // Bail immediately on billing/auth errors
          if (e?.status === 400 || e?.status === 401 || e?.status === 403) {
            console.error(`  [FATAL] ${e?.error?.error?.message || e.message}`);
            throw e;
          }
          const isRetryable = e?.status === 429 || e?.status === 529 || e?.cause?.code === 'ETIMEDOUT'
            || e?.message?.includes('Connection error') || e?.cause?.code === 'ECONNRESET';
          if (isRetryable && attempt < 3) {
            const wait = (attempt + 1) * 10000; // 10s, 20s, 30s
            const reason = e?.status === 429 ? '429 rate limited' : `connection error (${e?.cause?.code || 'unknown'})`;
            console.error(`  [RETRY ${attempt + 1}] ${reason}, waiting ${wait / 1000}s...`);
            await new Promise(r => setTimeout(r, wait));
          } else {
            throw e;
          }
        }
      }

      // Update Supabase
      if (!DRY_RUN) {
        for (const r of results) {
          const record = chunk[r.idx];
          if (!record) continue;
          const update = { image_type: r.type };
          if (r.caption) update.caption = r.caption;
          await sb.from('document_images').update(update).eq('id', record.id);
        }
      }

      return results;
    });

    const batchResults = await Promise.all(tasks.map(t => t()));

    for (const results of batchResults) {
      for (const r of results) {
        stats[r.type] = (stats[r.type] || 0) + 1;
        classified++;
      }
      batchesDone++;
    }

    if (batchesDone % 10 === 0 || i + MAX_CONCURRENT >= chunks.length) {
      log(`Progress: ${classified}/${toClassify.length} classified (${chunks.length - batchesDone} batches remaining)`);
      checkpoint.classifiedCount = classified;
      saveCheckpoint(checkpoint);
    }

    // Delay between batches to stay within 50K TPM rate limit
    await new Promise(r => setTimeout(r, 4000));
  }

  log('');
  log('Classification results:');
  for (const [type, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
    log(`  ${type.padEnd(12)} ${count}`);
  }

  return { classified, stats };
}

// ── Phase 2: Entity-Link ────────────────────────────────────────────────────

async function runLink() {
  hr();
  console.log('  PHASE 2: LINK IMAGES TO ENTITIES');
  hr();

  // 1. Get entity_documents (all entity↔document links)
  log('Fetching entity_documents...');
  const entityDocs = await fetchAll('entity_documents', 'entity_id,document_id');
  log(`Entity-document links: ${entityDocs.length}`);

  // Build: document_id → [entity_ids]
  const docToEntities = new Map();
  for (const ed of entityDocs) {
    if (!docToEntities.has(ed.document_id)) docToEntities.set(ed.document_id, new Set());
    docToEntities.get(ed.document_id).add(ed.entity_id);
  }
  log(`Unique documents with entity links: ${docToEntities.size}`);

  // 2. Get document_images (all images)
  log('Fetching document_images...');
  const images = await fetchAll('document_images', 'id,document_id');
  log(`Total document images: ${images.length}`);

  // 3. Get existing image_entities to avoid duplicates
  log('Fetching existing image_entities...');
  const existing = await fetchAll('image_entities', 'image_id,entity_id');
  const existingSet = new Set(existing.map(e => `${e.image_id}:${e.entity_id}`));
  log(`Existing image-entity links: ${existingSet.size}`);

  // 4. Build new links
  const newLinks = [];
  for (const img of images) {
    const entities = docToEntities.get(img.document_id);
    if (!entities) continue;
    for (const entityId of entities) {
      const key = `${img.id}:${entityId}`;
      if (existingSet.has(key)) continue;
      newLinks.push({
        image_id: img.id,
        entity_id: entityId,
        role: 'background',
        confidence: 'possible',
      });
    }
  }

  log(`New image-entity links to create: ${newLinks.length}`);

  if (newLinks.length === 0) {
    log('Nothing to link.');
    return { linked: 0 };
  }

  if (DRY_RUN) {
    const entityCounts = {};
    for (const l of newLinks) {
      entityCounts[l.entity_id] = (entityCounts[l.entity_id] || 0) + 1;
    }
    const topEntities = Object.entries(entityCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    log('Top entities by image count (dry run):');
    for (const [eid, count] of topEntities) {
      log(`  ${eid}: ${count} images`);
    }
    return { linked: 0, wouldLink: newLinks.length };
  }

  // 5. Bulk insert in batches of 500
  const INSERT_BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < newLinks.length; i += INSERT_BATCH) {
    const batch = newLinks.slice(i, i + INSERT_BATCH);
    const { error } = await sb.from('image_entities').upsert(batch, {
      onConflict: 'image_id,entity_id',
      ignoreDuplicates: true,
    });
    if (error) {
      console.error(`  [ERROR] Batch insert at ${i}: ${error.message}`);
    } else {
      inserted += batch.length;
    }
    if ((i + INSERT_BATCH) % 5000 === 0 || i + INSERT_BATCH >= newLinks.length) {
      log(`Progress: ${inserted}/${newLinks.length} links created`);
    }
  }

  return { linked: inserted };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  hr();
  console.log('  IMAGE CORPUS IMPORT + CLASSIFICATION + ENTITY LINKING');
  console.log(`  Dry run: ${DRY_RUN} | Limit: ${LIMIT || 'all'} | Phase: ${PHASE} | Reclassify: ${RECLASSIFY}`);
  hr();

  let importResult = null;
  let classifyResult = null;
  let linkResult = null;

  if (PHASE === 'import' || PHASE === 'all') {
    importResult = await runImport();
  }

  if (PHASE === 'classify' || PHASE === 'all') {
    classifyResult = await runClassify();
  }

  if (PHASE === 'link' || PHASE === 'all') {
    linkResult = await runLink();
  }

  console.log('');
  hr();
  console.log('  SUMMARY');
  hr();
  if (importResult) {
    log(`Corpus images imported: ${importResult.imported || importResult.wouldImport || 0}${DRY_RUN ? ' (dry run)' : ''}`);
  }
  if (classifyResult) {
    log(`Images classified: ${classifyResult.classified}${DRY_RUN ? ' (dry run)' : ''}`);
    for (const [type, count] of Object.entries(classifyResult.stats).sort((a, b) => b[1] - a[1])) {
      log(`  ${type.padEnd(12)} ${count}`);
    }
  }
  if (linkResult) {
    log(`Image-entity links created: ${linkResult.linked || linkResult.wouldLink || 0}${DRY_RUN ? ' (dry run)' : ''}`);
  }
  hr();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
