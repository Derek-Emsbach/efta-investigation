/**
 * Seed entity profile photos from Wikimedia Commons.
 *
 * Updates `profile_image_url` for published entities that have available
 * public domain / Creative Commons photos on Wikipedia.
 *
 * Usage:
 *   pnpm --filter @efta/scripts seed:entity-photos
 *   pnpm --filter @efta/scripts seed:entity-photos -- --dry-run
 */
import { supabase } from './utils/supabase-admin.js'

const DRY_RUN = process.argv.includes('--dry-run')

// ─── Wikimedia Commons thumbnail URLs ────────────────────────────────────────
// Source: Wikipedia API (action=query&prop=pageimages&pithumbsize=400)
// Only includes entities with freely-licensed photos on Wikimedia Commons.
// Entities without photos will keep the initials fallback.

const ENTITY_PHOTOS: Record<string, string> = {
  // Tier 1 — Direct Evidence
  'Jeffrey Epstein':
    'https://upload.wikimedia.org/wikipedia/commons/5/59/Jeffrey_Epstein_mug_shot_%28cropped%29.jpg',
  'Bill Clinton':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Bill_Clinton.jpg/400px-Bill_Clinton.jpg',
  'Alan Dershowitz':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Alan_dershowitz_2009_retouched_cropped.jpg/400px-Alan_dershowitz_2009_retouched_cropped.jpg',
  'Harvey Weinstein':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Harvey_Weinstein_2011_Shankbone.JPG/400px-Harvey_Weinstein_2011_Shankbone.JPG',
  'George Mitchell':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/George_John_Mitchell.jpg/400px-George_John_Mitchell.jpg',
  'Steve Case':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Steve_Case_at_Strictly_VC_event_in_2024_%28cropped%29.jpg/400px-Steve_Case_at_Strictly_VC_event_in_2024_%28cropped%29.jpg',
  'Ted Leonsis':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Ted_Leonsis_Head_Shot_100113.jpg/400px-Ted_Leonsis_Head_Shot_100113.jpg',
  'Marvin Minsky':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Marvin_Minsky_at_OLPCb_%283x4_cropped%29.jpg/400px-Marvin_Minsky_at_OLPCb_%283x4_cropped%29.jpg',
  'Jes Staley':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/The_CEO%2C_Barclays%2C_Mr._Jes_Staley_calling_on_the_Prime_Minister%2C_Shri_Narendra_Modi%2C_in_New_Delhi_on_July_20%2C_2016_%28cropped%29.jpg/400px-The_CEO%2C_Barclays%2C_Mr._Jes_Staley_calling_on_the_Prime_Minister%2C_Shri_Narendra_Modi%2C_in_New_Delhi_on_July_20%2C_2016_%28cropped%29.jpg',

  // Tier 2 — Immunized / Enablers
  'Ghislaine Maxwell':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Ghislaine_Maxwell_MDC_mug_shot_%28cropped%29.webp/400px-Ghislaine_Maxwell_MDC_mug_shot_%28cropped%29.webp.png',
  'Les Wexner':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Leslie_Wexner_receives_woodrow_wilson_award_%28cropped%29_%282%29.JPG/400px-Leslie_Wexner_receives_woodrow_wilson_award_%28cropped%29_%282%29.JPG',

  // Tier 6 — Legal/Judicial
  'Judge Loretta Preska':
    'https://upload.wikimedia.org/wikipedia/commons/6/62/Loretta_Preska_%28cropped%29.jpg',

  // Tier 3 — Circumstantial
  'Ehud Barak':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Ehud_Barak_at_Pentagon%2C_11-2009.jpg/400px-Ehud_Barak_at_Pentagon%2C_11-2009.jpg',

  // Tier 4 — Associated (Ruemmler Network)
  'Peter Thiel':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Peter_Thiel_TechCrunch50.jpg/400px-Peter_Thiel_TechCrunch50.jpg',
  'Woody Allen':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Woody_Allen_Cannes_2016.jpg/400px-Woody_Allen_Cannes_2016.jpg',
  'Bob Kerrey':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Bob_Kerrey.jpg/400px-Bob_Kerrey.jpg',
  'Bill Gates':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Bill_Gates_2017_%28cropped%29.jpg/400px-Bill_Gates_2017_%28cropped%29.jpg',
  'Donald Trump':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Donald_Trump_official_portrait.jpg/400px-Donald_Trump_official_portrait.jpg',
  'Virginia Giuffre':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Virginia_Giuffre_2015.jpg/400px-Virginia_Giuffre_2015.jpg',
  'Larry Summers':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Lawrence_Summers_2012.jpg/400px-Lawrence_Summers_2012.jpg',

  // Entities without freely-licensed Wikimedia photos (skipped):
  // Leon Black, Prince Andrew, Dan Snyder, Jim Kimsey,
  // Jean-Luc Brunel, Judge Jed Rakoff, Brad Karp, Kathryn Ruemmler,
  // Peggy Siegal, Dana Chasin, and all "Mr." tier-3 entities
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function seedEntityPhotos() {
  console.log(`\n=== Seed Entity Photos${DRY_RUN ? ' [DRY RUN]' : ''} ===\n`)

  // Fetch all published entities
  const { data: entities, error } = await supabase
    .from('entities')
    .select('id, name, slug, profile_image_url')
    .eq('profile_published', true)
    .order('name')

  if (error) {
    console.error('Failed to fetch entities:', error.message)
    process.exit(1)
  }

  console.log(`Found ${entities.length} published entities\n`)

  let updated = 0
  let skipped = 0
  let noPhoto = 0

  for (const entity of entities) {
    const photoUrl = ENTITY_PHOTOS[entity.name]

    if (!photoUrl) {
      noPhoto++
      continue
    }

    if (entity.profile_image_url === photoUrl) {
      skipped++
      console.log(`  [skip] ${entity.name} — already set`)
      continue
    }

    if (DRY_RUN) {
      console.log(`  [dry] Would set photo for: ${entity.name}`)
      updated++
      continue
    }

    const { error: updateError } = await supabase
      .from('entities')
      .update({ profile_image_url: photoUrl })
      .eq('id', entity.id)

    if (updateError) {
      console.error(`  [error] ${entity.name}: ${updateError.message}`)
    } else {
      console.log(`  [set] ${entity.name}`)
      updated++
    }
  }

  console.log(`\n--- Summary ---`)
  console.log(`  Updated: ${updated}`)
  console.log(`  Skipped (already set): ${skipped}`)
  console.log(`  No photo available: ${noPhoto}`)
  console.log(`  Total published: ${entities.length}\n`)
}

seedEntityPhotos().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
