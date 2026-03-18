/**
 * Smart Entity Tagging from OCR text_content
 *
 * Searches the corpus SQLite image_analysis DB for entity name mentions in the
 * OCR text_content field, then links those images to entities in Supabase with
 * role='mentioned', confidence='possible'.
 *
 * This is faster and cheaper than NER-based tagging since it uses exact/fuzzy
 * string matching against known entity names — no Claude API calls required.
 *
 * Usage:
 *   node scripts/tag-image-entities.mjs [options]
 *
 * Options:
 *   --dry-run    Print matches without writing to Supabase
 *   --limit N    Process only first N entities (default: all)
 */

import { createClient } from '@supabase/supabase-js';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';

// ── Config ──────────────────────────────────────────────────────────────────

const envFile = readFileSync('apps/web/.env.local', 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; })
    .filter(Boolean)
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const corpus = new Database('services/efta-mcp-server/data/image_analysis.db', { readonly: true });

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = (() => {
  const idx = process.argv.indexOf('--limit');
  return idx >= 0 ? parseInt(process.argv[idx + 1], 10) : 0;
})();

// ── Helpers ─────────────────────────────────────────────────────────────────

async function fetchAllPages(query) {
  const PAGE = 1000;
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw new Error(`Supabase error: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  SMART ENTITY TAGGING FROM OCR TEXT');
  console.log(`  Dry run: ${DRY_RUN} | Limit: ${LIMIT || 'all'}`);
  console.log('═'.repeat(60) + '\n');

  // Step A: fetch published entities with aliases
  console.log('  Loading published entities...');
  const { data: entities, error: entErr } = await sb
    .from('entities')
    .select('id, name, metadata')
    .eq('profile_published', true);
  if (entErr) throw new Error(entErr.message);

  let entityList = entities.map(e => ({
    id: e.id,
    name: e.name,
    aliases: e.metadata?.aliases ?? [],
    searchNames: [e.name, ...(e.metadata?.aliases ?? [])].filter(n => n && n.length >= 5),
  })).filter(e => e.searchNames.length > 0);

  if (LIMIT > 0) entityList = entityList.slice(0, LIMIT);
  console.log(`  Processing ${entityList.length} entities`);

  // Step B: build corpus image_name → document_images mapping
  console.log('  Loading corpus image → Supabase mapping...');
  const allImages = await fetchAllPages(
    sb.from('document_images')
      .select('id, metadata')
      .not('metadata->corpus_image_name', 'is', null)
  );
  const imageNameToId = new Map();
  for (const img of allImages) {
    const name = img.metadata?.corpus_image_name;
    if (name) imageNameToId.set(name, img.id);
  }
  console.log(`  Mapped ${imageNameToId.size} corpus images to Supabase records`);

  // Step C: for each entity, search SQLite text_content for name mentions
  const allLinks = []; // {image_id, entity_id, entity_name, match_text}
  const stmt = corpus.prepare(
    `SELECT image_name FROM images
     WHERE (text_content LIKE ? OR text_content LIKE ? OR notable LIKE ?)
     AND image_name IS NOT NULL`
  );

  console.log('\n  Searching corpus for entity name mentions...\n');

  for (const entity of entityList) {
    const imageIds = new Set();

    for (const searchName of entity.searchNames) {
      // Skip very short names that would cause false positives
      if (searchName.length < 6) continue;

      const pattern = `%${searchName}%`;
      const rows = stmt.all(pattern, pattern, pattern);
      for (const row of rows) {
        const imageId = imageNameToId.get(row.image_name);
        if (imageId) imageIds.add(imageId);
      }
    }

    if (imageIds.size > 0) {
      console.log(`  ${entity.name}: ${imageIds.size} image mentions`);
      for (const imageId of imageIds) {
        allLinks.push({ image_id: imageId, entity_id: entity.id, entity_name: entity.name });
      }
    }
  }

  console.log(`\n  Total new links to create: ${allLinks.length}`);
  console.log(`  Unique images: ${new Set(allLinks.map(l => l.image_id)).size}`);
  console.log(`  Unique entities with matches: ${new Set(allLinks.map(l => l.entity_id)).size}`);

  if (allLinks.length === 0) {
    console.log('\n  No links found. Done.');
    return;
  }

  if (DRY_RUN) {
    console.log('\n  [DRY RUN] No writes performed.');
    corpus.close();
    return;
  }

  // Step D: upsert image_entities with role='mentioned', confidence='possible'
  console.log('\n  Upserting image_entities (text mentions)...');
  const upsertRows = allLinks.map(({ image_id, entity_id }) => ({
    image_id,
    entity_id,
    role: 'mentioned',
    confidence: 'possible',
  }));

  let upserted = 0;
  let skipped = 0;
  for (let i = 0; i < upsertRows.length; i += 500) {
    const chunk = upsertRows.slice(i, i + 500);
    const { error, count } = await sb.from('image_entities').upsert(chunk, {
      onConflict: 'image_id,entity_id',
      ignoreDuplicates: true, // don't downgrade existing 'subject' links
    });
    if (error) {
      console.error(`  [WARN] Upsert chunk failed: ${error.message}`);
      skipped += chunk.length;
    } else {
      upserted += chunk.length;
    }
  }

  corpus.close();

  console.log('\n' + '═'.repeat(60));
  console.log('  SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  image_entities upserted: ${upserted}`);
  if (skipped > 0) console.log(`  Failed (skipped):        ${skipped}`);
  console.log('═'.repeat(60) + '\n');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
