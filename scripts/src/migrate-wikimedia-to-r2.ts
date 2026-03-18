/**
 * Migrate all Wikimedia Commons images to self-hosted Cloudflare R2.
 *
 * Collects image URLs from:
 *   - scripts/src/seed-publication.ts (hero_image_url per story)
 *   - scripts/src/seed-entity-photos.ts (ENTITY_PHOTOS map)
 *   - docs/stories/*.md (inline ![caption](url) images)
 *
 * Uploads to R2 under:
 *   - publication/heroes/{story-slug}.{ext}
 *   - publication/entities/{entity-slug}.{ext}
 *   - publication/inline/{slugified-filename}.{ext}
 *
 * Outputs scripts/wikimedia-to-r2-mapping.json with:
 *   { wikimedia_url: "/api/public/media/{category}/{filename}" }
 *
 * Usage:
 *   pnpm --filter @efta/scripts migrate:images
 *   pnpm --filter @efta/scripts migrate:images -- --dry-run
 */
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DRY_RUN = process.argv.includes('--dry-run')

// Determine monorepo root by walking up to find pnpm-workspace.yaml
function findRoot(dir: string): string {
  if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir
  const parent = path.resolve(dir, '..')
  if (parent === dir) return process.cwd()
  return findRoot(parent)
}

const ROOT = findRoot(__dirname)
dotenv.config({ path: path.join(ROOT, '.env.local') })

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID?.trim() ?? ''
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID?.trim() ?? ''
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY?.trim() ?? ''
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME?.trim() ?? ''

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error('Missing R2 env vars. Ensure apps/web/.env.local is configured.')
  process.exit(1)
}

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})

// ─── Utilities ───────────────────────────────────────────────────────────────

function slugify(str: string): string {
  return decodeURIComponent(str)
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getExtFromUrl(url: string): string {
  const filename = decodeURIComponent(url.split('/').pop() ?? '')
  const match = filename.match(/\.([a-z0-9]+)$/i)
  return match ? match[1].toLowerCase() : 'jpg'
}

function getContentType(ext: string): string {
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    JPG: 'image/jpeg',
    JPG2: 'image/jpeg',
  }
  return map[ext] ?? map[ext.toLowerCase()] ?? 'image/jpeg'
}

async function exists(key: string): Promise<boolean> {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }))
    return true
  } catch {
    return false
  }
}

/** If a Wikimedia thumbnail URL fails, extract the base file URL as fallback */
function wikimediaBaseUrl(url: string): string | null {
  // Thumbnail pattern: /wikipedia/commons/thumb/X/Y/filename.ext/SIZEpx-filename.ext
  const match = url.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/)thumb\/([a-f0-9])\/([a-f0-9]+)\/([^/]+)\/\d+px-.+$/)
  if (!match) return null
  return `${match[1]}${match[2]}/${match[3]}/${match[4]}`
}

async function downloadImage(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  // Try the given URL first; if it fails with 404, try the base file URL
  const urlsToTry = [url]
  const baseUrl = wikimediaBaseUrl(url)
  if (baseUrl && baseUrl !== url) urlsToTry.push(baseUrl)

  let lastError: Error | null = null
  for (const tryUrl of urlsToTry) {
    const res = await fetch(tryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EFTA-Investigation/1.0; +https://theepsteincrimes.com)',
      },
    })
    if (res.ok) {
      const contentType = res.headers.get('content-type') ?? getContentType(getExtFromUrl(tryUrl))
      const arrayBuffer = await res.arrayBuffer()
      if (tryUrl !== url) console.log(`  (fell back to base URL: ${tryUrl})`)
      return { buffer: Buffer.from(arrayBuffer), contentType }
    }
    lastError = new Error(`HTTP ${res.status} ${res.statusText} for ${tryUrl}`)
    if (res.status !== 404) break // Only retry with base URL on 404
  }
  throw lastError!
}


async function upload(key: string, buffer: Buffer, contentType: string): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── URL Collection ───────────────────────────────────────────────────────────

interface ImageEntry {
  wikimediaUrl: string
  r2Key: string
  mediaPath: string  // the /api/public/media/... path used in source files
  category: 'heroes' | 'inline' | 'entities'
}

function collectHeroImages(): ImageEntry[] {
  const seedFile = path.join(ROOT, 'scripts/src/seed-publication.ts')
  const content = fs.readFileSync(seedFile, 'utf8')

  // Extract slug + hero_image_url pairs by parsing story object blocks
  const entries: ImageEntry[] = []
  const lines = content.split('\n')

  let currentSlug: string | null = null
  let heroNextLine = false
  for (const line of lines) {
    const slugMatch = line.match(/^\s+slug:\s*'([\w-]+)'/)
    if (slugMatch) {
      currentSlug = slugMatch[1]
    }

    // Single-line: hero_image_url: 'https://...'
    const singleLine = line.match(/^\s+hero_image_url:\s*'(https:\/\/upload\.wikimedia\.org[^']+)'/)
    if (singleLine && currentSlug) {
      pushHero(entries, currentSlug, singleLine[1])
      heroNextLine = false
      continue
    }

    // Multi-line first half: hero_image_url:\n      'https://...'
    if (/^\s+hero_image_url:\s*$/.test(line)) {
      heroNextLine = true
      continue
    }
    if (heroNextLine) {
      heroNextLine = false
      const urlMatch = line.match(/^\s+'(https:\/\/upload\.wikimedia\.org[^']+)'/)
      if (urlMatch && currentSlug) {
        pushHero(entries, currentSlug, urlMatch[1])
      }
    }
  }

  function pushHero(arr: ImageEntry[], slug: string, wikimediaUrl: string) {
    const ext = getExtFromUrl(wikimediaUrl)
    const filename = `${slug}.${ext}`
    arr.push({
      wikimediaUrl,
      r2Key: `publication/heroes/${filename}`,
      mediaPath: `/api/public/media/heroes/${filename}`,
      category: 'heroes',
    })
  }

  return entries
}

function collectEntityPhotos(): ImageEntry[] {
  const seedFile = path.join(ROOT, 'scripts/src/seed-entity-photos.ts')
  const content = fs.readFileSync(seedFile, 'utf8')

  const entries: ImageEntry[] = []
  // Match: 'Entity Name': 'https://upload.wikimedia.org/...'
  const regex = /'([^']+)':\s*\n?\s*'(https:\/\/upload\.wikimedia\.org[^']+)'/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(content)) !== null) {
    const entityName = m[1]
    const wikimediaUrl = m[2]
    const entitySlug = slugify(entityName).replace(/\./g, '-')
    const ext = getExtFromUrl(wikimediaUrl)
    // Strip .webp.png suffix for Ghislaine Maxwell
    const cleanExt = ext === 'png' && wikimediaUrl.includes('.webp') ? 'webp' : ext
    const filename = `${entitySlug}.${cleanExt}`
    const r2Key = `publication/entities/${filename}`
    entries.push({
      wikimediaUrl,
      r2Key,
      mediaPath: `/api/public/media/entities/${filename}`,
      category: 'entities',
    })
  }

  return entries
}

function collectInlineImages(): ImageEntry[] {
  const storiesDir = path.join(ROOT, 'docs/stories')
  const mdFiles = fs.readdirSync(storiesDir).filter((f) => f.endsWith('.md'))

  const seen = new Map<string, ImageEntry>()
  const wikimediaRegex = /!\[[^\]]*\]\((https:\/\/upload\.wikimedia\.org[^)]+)\)/g

  for (const mdFile of mdFiles) {
    const content = fs.readFileSync(path.join(storiesDir, mdFile), 'utf8')
    let m: RegExpExecArray | null
    while ((m = wikimediaRegex.exec(content)) !== null) {
      const wikimediaUrl = m[1]
      if (seen.has(wikimediaUrl)) continue

      // Use slugified original filename as the R2 key
      const rawFilename = decodeURIComponent(wikimediaUrl.split('/').pop() ?? '')
      // Strip thumbnail size prefix like "440px-" or "1280px-"
      const cleanFilename = rawFilename.replace(/^\d+px-/, '')
      const ext = cleanFilename.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? 'jpg'
      const nameWithoutExt = cleanFilename.replace(/\.[^.]+$/, '')
      const sluggedName = slugify(nameWithoutExt)
      const filename = `${sluggedName}.${ext}`
      const r2Key = `publication/inline/${filename}`

      const entry: ImageEntry = {
        wikimediaUrl,
        r2Key,
        mediaPath: `/api/public/media/inline/${filename}`,
        category: 'inline',
      }
      seen.set(wikimediaUrl, entry)
    }
  }

  return [...seen.values()]
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Migrate Wikimedia Images to R2${DRY_RUN ? ' [DRY RUN]' : ''} ===\n`)

  // Collect all image entries, deduplicate by wikimediaUrl
  const allEntries = new Map<string, ImageEntry>()

  const heroEntries = collectHeroImages()
  console.log(`  Hero images: ${heroEntries.length} entries`)
  for (const e of heroEntries) allEntries.set(e.wikimediaUrl, e)

  const entityEntries = collectEntityPhotos()
  console.log(`  Entity photos: ${entityEntries.length} entries`)
  for (const e of entityEntries) allEntries.set(e.wikimediaUrl, e)

  const inlineEntries = collectInlineImages()
  console.log(`  Inline images: ${inlineEntries.length} entries (unique)`)
  for (const e of inlineEntries) {
    // Don't overwrite hero/entity entries — but inline should map to its inline key
    if (!allEntries.has(e.wikimediaUrl)) {
      allEntries.set(e.wikimediaUrl, e)
    }
  }
  // Also collect hero images that appear as inline images (same URL, different key needed)
  // We'll use separate inline entries for these too
  const inlineMap = new Map<string, ImageEntry>()
  for (const e of inlineEntries) inlineMap.set(e.wikimediaUrl, e)

  console.log(`\n  Total unique Wikimedia URLs: ${allEntries.size}`)
  console.log(`  (Note: some URLs appear in multiple categories)\n`)

  // Build the complete set of entries to upload (all categories)
  const toUpload: ImageEntry[] = []
  // Merge: for URLs that appear in both heroes and inline, we need both entries
  const heroUrls = new Set(heroEntries.map((e) => e.wikimediaUrl))
  const entityUrls = new Set(entityEntries.map((e) => e.wikimediaUrl))

  // Heroes
  for (const e of heroEntries) toUpload.push(e)
  // Entities
  for (const e of entityEntries) toUpload.push(e)
  // Inline (all unique inline URLs, including those that are also heroes)
  for (const e of inlineEntries) {
    // Upload to inline key even if same URL is already a hero/entity (different R2 key)
    toUpload.push(e)
  }

  // Deduplicate by R2 key (not by URL)
  const byKey = new Map<string, ImageEntry>()
  for (const e of toUpload) byKey.set(e.r2Key, e)

  console.log(`  Total R2 keys to create: ${byKey.size}\n`)

  let uploaded = 0
  let skipped = 0
  let failed = 0
  const mapping: Record<string, string> = {}

  const entries = [...byKey.values()]
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    console.log(`[${i + 1}/${entries.length}] ${entry.category} / ${entry.r2Key.split('/').pop()}`)
    console.log(`  URL: ${entry.wikimediaUrl}`)

    mapping[entry.wikimediaUrl] = entry.mediaPath

    if (DRY_RUN) {
      console.log(`  → [dry run] Would upload to ${entry.r2Key}\n`)
      uploaded++
      continue
    }

    // Check if already exists in R2
    const alreadyExists = await exists(entry.r2Key)
    if (alreadyExists) {
      console.log(`  → [skip] Already in R2\n`)
      skipped++
      continue
    }

    try {
      const { buffer, contentType } = await downloadImage(entry.wikimediaUrl)
      await upload(entry.r2Key, buffer, contentType)
      console.log(`  → [ok] Uploaded ${(buffer.length / 1024).toFixed(0)}KB (${contentType})\n`)
      uploaded++
    } catch (err) {
      console.error(`  → [error] ${err instanceof Error ? err.message : String(err)}\n`)
      failed++
    }

    // Polite delay between Wikimedia requests
    if (i < entries.length - 1) {
      await sleep(600)
    }
  }

  // Write mapping file
  // For URLs that appear in multiple categories (e.g., same URL is hero in one story and inline elsewhere),
  // we need to output ALL mappings. The inline mapping takes precedence for inline uses.
  // But we need separate mappings: one for heroes/entities (used in seed scripts) and one for inline (used in markdown).
  // The seed scripts will use the /heroes/ and /entities/ paths.
  // The markdown files will use the /inline/ paths.
  // So we need a complete mapping of wikimediaUrl → mediaPath for each unique key.

  const fullMapping: Record<string, string> = {}
  // Heroes
  for (const e of heroEntries) fullMapping[`hero:${e.wikimediaUrl}`] = e.mediaPath
  // Entities
  for (const e of entityEntries) fullMapping[`entity:${e.wikimediaUrl}`] = e.mediaPath
  // Inline
  for (const e of inlineEntries) fullMapping[`inline:${e.wikimediaUrl}`] = e.mediaPath

  const mappingFile = path.join(ROOT, 'scripts/wikimedia-to-r2-mapping.json')
  fs.writeFileSync(mappingFile, JSON.stringify(fullMapping, null, 2))
  console.log(`\nMapping written to: scripts/wikimedia-to-r2-mapping.json`)

  console.log('\n--- Summary ---')
  console.log(`  Uploaded: ${uploaded}`)
  console.log(`  Skipped (already in R2): ${skipped}`)
  console.log(`  Failed: ${failed}`)
  console.log(`  Total R2 keys: ${byKey.size}\n`)

  if (failed > 0) {
    console.error(`WARNING: ${failed} images failed to upload. Re-run to retry.`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
