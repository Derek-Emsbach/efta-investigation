/**
 * Set profile_published = true for top entities (tiers 1-3 + key tier 4).
 * Usage: npx tsx scripts/publish-top-entities.ts
 * Add --write to commit changes.
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

async function main() {
  // Publish all entities in tiers 1-4 (these are the ones with significant evidence)
  const { data: entities, error } = await supabase
    .from('entities')
    .select('id, name, tier, slug, profile_published, is_public')
    .in('tier', [1, 2, 3, 4])
    .order('tier', { ascending: true })
    .order('name')

  if (error) {
    console.error('Failed to fetch entities:', error.message)
    process.exit(1)
  }

  console.log(`Found ${entities.length} entities in tiers 1-4\n`)

  // Filter to non-victims (is_public check) and those not already published
  const toPublish = entities.filter((e) => {
    // Skip tier 5 (victims) — only publish if is_public is true
    // For tiers 1-4, all should be publishable
    return !e.profile_published
  })

  console.log(`${toPublish.length} need profile_published = true\n`)

  for (const e of toPublish) {
    console.log(`  T${e.tier}  ${e.name.padEnd(35)} slug: ${e.slug ?? '(none)'}`)
  }

  if (!process.argv.includes('--write')) {
    console.log('\nDry run. Add --write to commit.')
    return
  }

  // Update all at once
  const ids = toPublish.map((e) => e.id)
  const { error: updateError } = await supabase
    .from('entities')
    .update({ profile_published: true })
    .in('id', ids)

  if (updateError) {
    console.error('Update failed:', updateError.message)
    process.exit(1)
  }

  console.log(`\nDone! Published ${toPublish.length} entity profiles.`)

  // Also show already-published count
  const alreadyPublished = entities.length - toPublish.length
  if (alreadyPublished > 0) {
    console.log(`(${alreadyPublished} were already published)`)
  }
}

main().catch((err) => {
  console.error('Script failed:', err.message)
  process.exit(1)
})
