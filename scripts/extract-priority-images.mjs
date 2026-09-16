/**
 * extract-priority-images.mjs
 *
 * Extracts real page images from R2 PDFs for priority documents —
 * those linked to published entities. Uploads images back to R2 and
 * creates/updates document_images records so entity Photos tabs show
 * actual images instead of corpus:pending text cards.
 *
 * Pipeline per document:
 *   1. Download PDF from R2 via presigned GET URL → temp file
 *   2. pdftoppm -r 150 -jpeg → full-res page JPEGs
 *   3. pdftoppm -r 72  -jpeg → thumbnail page JPEGs
 *   4. Upload both to R2: images/{doc_id}/p{page}_i0.jpg + thumbnails/{doc_id}/p{page}_i0.jpg
 *   5. Upsert document_images (skip if real r2_key already exists for that page)
 *
 * Usage:
 *   node scripts/extract-priority-images.mjs [options]
 *
 * Options:
 *   --dry-run      Show what would be extracted without writing anything
 *   --limit N      Process only first N documents (default: all 65)
 *   --doc BATES    Process a single document by Bates number
 *   --max-pages N  Maximum pages to extract per document (default: 10)
 */

import { createClient } from '@supabase/supabase-js';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { readFileSync, mkdirSync, rmSync, readdirSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { join, basename } from 'path';
import { randomUUID } from 'crypto';

// ── Config ──────────────────────────────────────────────────────────────────

const envFile = readFileSync('apps/web/.env.local', 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; })
    .filter(Boolean)
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const R2_ACCOUNT_ID = env.R2_ACCOUNT_ID?.trim();
const R2_ACCESS_KEY_ID = env.R2_ACCESS_KEY_ID?.trim();
const R2_SECRET_ACCESS_KEY = env.R2_SECRET_ACCESS_KEY?.trim();
const R2_BUCKET_NAME = env.R2_BUCKET_NAME?.trim();
const R2_PUBLIC_URL = env.R2_PUBLIC_URL?.trim();

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error('Missing R2 env vars');
  process.exit(1);
}

// Derive account ID from public URL if not set
const accountId = R2_ACCOUNT_ID || R2_PUBLIC_URL?.match(/https:\/\/([^.]+)\./)?.[1];
if (!accountId) {
  console.error('Cannot determine R2 account ID');
  process.exit(1);
}

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 0; })();
const TARGET_BATES = (() => { const i = process.argv.indexOf('--doc'); return i >= 0 ? process.argv[i + 1] : null; })();
const MAX_PAGES = (() => { const i = process.argv.indexOf('--max-pages'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 10; })();

const FULL_DPI = 150;
const THUMB_DPI = 72;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extract R2 object key from file_url (handles both full URL and relative key) */
function urlToKey(fileUrl) {
  if (!fileUrl.startsWith('http')) return fileUrl; // already a relative key
  // file_url = https://{account}.r2.cloudflarestorage.com/{bucket}/{key}
  const url = new URL(fileUrl);
  const parts = url.pathname.slice(1).split('/');
  parts.shift(); // remove bucket name
  return parts.join('/');
}

/** Get a presigned URL valid for 5 minutes */
async function getPresignedGet(key) {
  const cmd = new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key });
  return getSignedUrl(r2, cmd, { expiresIn: 300 });
}

/** Upload a file buffer to R2 */
async function uploadToR2(key, buffer, contentType) {
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
}

/** Download a URL to a local file, return path */
async function downloadToTemp(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(destPath, buf);
  return destPath;
}

/** Run pdftoppm on a PDF, return sorted list of output image paths */
function extractPages(pdfPath, outDir, prefix, dpi, maxPages) {
  const lastPage = maxPages > 0 ? `-l ${maxPages}` : '';
  try {
    execSync(
      `pdftoppm -r ${dpi} -jpeg ${lastPage} "${pdfPath}" "${join(outDir, prefix)}"`,
      { stdio: 'pipe' }
    );
  } catch (e) {
    throw new Error(`pdftoppm failed: ${e.message}`);
  }
  return readdirSync(outDir)
    .filter(f => f.startsWith(prefix) && f.endsWith('.jpg'))
    .sort()
    .map(f => join(outDir, f));
}

/** Parse page number from pdftoppm output filename like "prefix-001.jpg" → 0 */
function pageFromFilename(filename) {
  const m = basename(filename).match(/-(\d+)\.jpg$/);
  return m ? parseInt(m[1], 10) - 1 : 0; // 0-indexed
}

// ── Fetch priority documents ─────────────────────────────────────────────────

async function fetchPriorityDocs() {
  const { data: entities } = await sb.from('entities').select('id').eq('profile_published', true);
  const entityIds = entities.map(e => e.id);

  // Single paginated pass: embed documents data in entity_documents query,
  // filtering to only rows where the document has a file_url.
  // This avoids a separate chunked query (which hits PostgREST URL length limits).
  const seenDocIds = new Set();
  const docsWithPdf = [];
  let from = 0;
  while (true) {
    const { data } = await sb.from('entity_documents')
      .select('document_id, documents:document_id(id, bates_number, file_url, page_count)')
      .in('entity_id', entityIds)
      .not('documents.file_url', 'is', null)
      .order('document_id')
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    for (const row of data) {
      const doc = row.documents;
      if (doc?.file_url && !seenDocIds.has(doc.id)) {
        seenDocIds.add(doc.id);
        docsWithPdf.push(doc);
      }
    }
    if (data.length < 1000) break;
    from += 1000;
  }

  // Filter to single Bates if --doc specified
  if (TARGET_BATES) return docsWithPdf.filter(d => d.bates_number === TARGET_BATES);

  return docsWithPdf;
}

// ── Check already-extracted pages ───────────────────────────────────────────

async function getExtractedPageNums(docId) {
  const { data } = await sb.from('document_images')
    .select('page_number, r2_key')
    .eq('document_id', docId)
    .not('r2_key', 'like', 'corpus:%');
  return new Set((data ?? []).map(r => r.page_number));
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '═'.repeat(62));
  console.log('  PRIORITY IMAGE EXTRACTION');
  console.log(`  Dry run: ${DRY_RUN} | Max pages/doc: ${MAX_PAGES} | DPI: ${FULL_DPI}/${THUMB_DPI}`);
  console.log('═'.repeat(62) + '\n');

  console.log('  Fetching priority documents...');
  let docs = await fetchPriorityDocs();
  console.log(`  Found ${docs.length} priority docs with R2 PDFs\n`);

  if (LIMIT > 0) docs = docs.slice(0, LIMIT);

  let extracted = 0;
  let skipped = 0;
  let errored = 0;

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const prefix = `[${i + 1}/${docs.length}] ${doc.bates_number}`;
    const pageCount = doc.page_count ?? '?';

    // Check already-extracted pages
    const alreadyExtracted = await getExtractedPageNums(doc.id);

    const pagesToExtract = Math.min(MAX_PAGES, typeof pageCount === 'number' ? pageCount : MAX_PAGES);
    const pagesNeeded = [];
    for (let p = 0; p < pagesToExtract; p++) {
      if (!alreadyExtracted.has(p)) pagesNeeded.push(p);
    }

    if (pagesNeeded.length === 0) {
      console.log(`  ${prefix} — already extracted (${alreadyExtracted.size} pages), skip`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  ${prefix} — would extract ${pagesNeeded.length} pages (${pageCount} total)`);
      extracted++;
      continue;
    }

    const tmpDir = join(tmpdir(), `efta-extract-${randomUUID()}`);
    mkdirSync(tmpDir, { recursive: true });

    try {
      mkdirSync(join(tmpDir, 'full'), { recursive: true });
      mkdirSync(join(tmpDir, 'thumb'), { recursive: true });

      // 1. Download PDF
      const r2Key = urlToKey(doc.file_url);
      const presignedUrl = await getPresignedGet(r2Key);
      const pdfPath = join(tmpDir, 'input.pdf');
      await downloadToTemp(presignedUrl, pdfPath);

      // 2. Extract full-res + thumbnails
      const fullPaths = extractPages(pdfPath, join(tmpDir, 'full'), 'full', FULL_DPI, MAX_PAGES);
      const thumbPaths = extractPages(pdfPath, join(tmpDir, 'thumb'), 'thumb', THUMB_DPI, MAX_PAGES);

      if (fullPaths.length === 0) {
        console.log(`  ${prefix} — pdftoppm produced 0 images, skip`);
        skipped++;
        continue;
      }

      // Build page→path map for thumbnails
      const thumbMap = new Map(thumbPaths.map(p => [pageFromFilename(p), p]));

      // 3. Upload + upsert for each page
      const upsertRows = [];

      for (const fullPath of fullPaths) {
        const pageNum = pageFromFilename(fullPath);
        if (alreadyExtracted.has(pageNum)) continue;

        const fullKey = `images/${doc.id}/p${pageNum}_i0.jpg`;
        const thumbKey = `images/thumbnails/${doc.id}/p${pageNum}_i0.jpg`;

        const fullBuf = readFileSync(fullPath);
        await uploadToR2(fullKey, fullBuf, 'image/jpeg');

        const thumbPath = thumbMap.get(pageNum);
        if (thumbPath) {
          const thumbBuf = readFileSync(thumbPath);
          await uploadToR2(thumbKey, thumbBuf, 'image/jpeg');
        }

        upsertRows.push({
          document_id: doc.id,
          page_number: pageNum,
          image_index: 0,
          r2_key: fullKey,
          thumbnail_r2_key: thumbPath ? thumbKey : null,
          format: 'jpeg',
          image_type: 'photo', // will be classified later if needed
          metadata: { extracted_from: 'r2_pdf', dpi: FULL_DPI },
        });
      }

      if (upsertRows.length > 0) {
        const { error } = await sb.from('document_images').upsert(upsertRows, {
          onConflict: 'document_id,page_number,image_index',
          ignoreDuplicates: false, // update r2_key if previously corpus:pending
        });
        if (error) throw new Error(`Upsert failed: ${error.message}`);
      }

      console.log(`  ${prefix} — ✓ extracted ${upsertRows.length} pages`);
      extracted++;

    } catch (err) {
      console.error(`  ${prefix} — ✗ ERROR: ${err.message}`);
      errored++;
    } finally {
      try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  }

  console.log('\n' + '═'.repeat(62));
  console.log('  SUMMARY');
  console.log('═'.repeat(62));
  console.log(`  Extracted: ${extracted}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Errors:    ${errored}`);
  console.log('═'.repeat(62) + '\n');

  if (DRY_RUN || (extracted === 0 && skipped === 0)) return;

  // Link newly extracted images to entities via entity_documents
  console.log('  Linking images to entities...');
  const processedDocIds = docs.slice(0, extracted + skipped).map(d => d.id);
  let linked = 0;
  for (const docId of processedDocIds) {
    // Get all real images for this doc
    const { data: images } = await sb.from('document_images')
      .select('id')
      .eq('document_id', docId)
      .not('r2_key', 'like', 'corpus:%');
    if (!images || images.length === 0) continue;

    // Get all entities linked to this doc
    const { data: entityLinks } = await sb.from('entity_documents')
      .select('entity_id')
      .eq('document_id', docId);
    if (!entityLinks || entityLinks.length === 0) continue;

    const upsertRows = [];
    for (const { entity_id } of entityLinks) {
      for (const { id: image_id } of images) {
        upsertRows.push({ image_id, entity_id, role: 'background', confidence: 'possible' });
      }
    }

    if (upsertRows.length > 0) {
      const { error } = await sb.from('image_entities').upsert(upsertRows, {
        onConflict: 'image_id,entity_id',
        ignoreDuplicates: true,
      });
      if (!error) linked += upsertRows.length;
    }
  }
  console.log(`  Linked ${linked} image_entity records\n`);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
