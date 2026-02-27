/**
 * Generate URL slugs for all entities.
 * Uses Supabase REST API with service role key.
 *
 * Usage: npx tsx scripts/generate-entity-slugs.ts
 *
 * Slug rules:
 * - Lowercase, hyphen-separated
 * - Strip honorifics (Dr., Prof.) and suffixes (Jr., Sr., III, Esq.)
 * - Keep meaningful middle initials/names
 * - Handle collisions with -tier-{N} suffix
 */

import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../apps/web/.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
  process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
)

// Honorifics and suffixes to strip
const STRIP_PREFIXES = /^(dr\.?|prof\.?|mr\.?|mrs\.?|ms\.?|sir|dame|lord|lady|rev\.?|hon\.?|judge|justice|senator|rep\.?)\s+/i
const STRIP_SUFFIXES = /\s+(jr\.?|sr\.?|esq\.?|phd|md|ii|iii|iv|v|vi)$/i

const MAX_SLUG_LENGTH = 60

function slugify(name: string): string {
  let cleaned = name
    .replace(/\s*\(.*?\)\s*/g, '')   // strip parenthetical descriptions
    .replace(STRIP_PREFIXES, '')
    .replace(STRIP_SUFFIXES, '')
    .trim()

  let slug = cleaned
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/['']/g, '')            // strip apostrophes
    .replace(/[^a-z0-9\s-]/g, '')    // strip non-alphanumeric
    .replace(/\s+/g, '-')            // spaces to hyphens
    .replace(/-+/g, '-')             // collapse multiple hyphens
    .replace(/^-|-$/g, '')           // trim leading/trailing hyphens

  // Truncate very long slugs at a word boundary
  if (slug.length > MAX_SLUG_LENGTH) {
    slug = slug.slice(0, MAX_SLUG_LENGTH).replace(/-[^-]*$/, '')
  }

  return slug
}

async function main() {
  // Fetch all entities
  const { data: entities, error } = await supabase
    .from('entities')
    .select('id, name, tier, slug')
    .order('tier', { ascending: true, nullsFirst: false })
    .order('name')

  if (error) {
    console.error('Failed to fetch entities:', error.message)
    process.exit(1)
  }

  console.log(`Found ${entities.length} entities\n`)

  // Generate slugs
  const slugMap = new Map<string, { id: string; name: string; tier: number | null }>()
  const updates: { id: string; slug: string }[] = []

  for (const entity of entities) {
    if (entity.slug) {
      // Already has a slug — skip
      console.log(`  SKIP  ${entity.name} → ${entity.slug} (already set)`)
      slugMap.set(entity.slug, { id: entity.id, name: entity.name, tier: entity.tier })
      continue
    }

    let slug = slugify(entity.name)

    // Handle collisions
    if (slugMap.has(slug)) {
      const existing = slugMap.get(slug)!
      console.log(`  COLLISION: "${entity.name}" (T${entity.tier}) collides with "${existing.name}" (T${existing.tier}) on slug "${slug}"`)
      slug = `${slug}-tier-${entity.tier ?? 0}`

      // If still colliding (same tier), append part of UUID
      if (slugMap.has(slug)) {
        slug = `${slug}-${entity.id.slice(0, 4)}`
      }
    }

    slugMap.set(slug, { id: entity.id, name: entity.name, tier: entity.tier })
    updates.push({ id: entity.id, slug })
  }

  console.log(`\n--- Slug Preview (${updates.length} to update) ---\n`)

  // Print all slugs for eyeball review
  for (const { id, slug } of updates) {
    const entity = entities.find(e => e.id === id)!
    const nameWidth = 40
    const paddedName = entity.name.padEnd(nameWidth)
    console.log(`  T${entity.tier ?? '?'}  ${paddedName} → ${slug}`)
  }

  // Confirm before writing
  console.log(`\nReady to write ${updates.length} slugs to database.`)
  console.log('Run with --write flag to commit: npx tsx scripts/generate-entity-slugs.ts --write\n')

  if (!process.argv.includes('--write')) {
    return
  }

  // Write slugs
  console.log('Writing slugs...')
  let successCount = 0
  let errorCount = 0

  for (const { id, slug } of updates) {
    const { error: updateError } = await supabase
      .from('entities')
      .update({ slug })
      .eq('id', id)

    if (updateError) {
      console.error(`  ERROR: ${slug} — ${updateError.message}`)
      errorCount++
    } else {
      successCount++
    }
  }

  console.log(`\nDone! ${successCount} slugs written, ${errorCount} errors.`)
}

main().catch((err) => {
  console.error('Script failed:', err.message)
  process.exit(1)
})
