/**
 * Seed the datasets and investigations tables with DS12 data.
 * Run first — other import scripts depend on these records.
 */
import { supabase } from './utils/supabase-admin.js'

async function seedDataset() {
  console.log('Seeding DS12 dataset...')

  const { data: dataset, error: dsError } = await supabase
    .from('datasets')
    .upsert(
      {
        number: 12,
        name: 'Dataset 12 — Leon Black Prosecution File',
        description:
          '~80% Leon Black investigation chain (SDNY/DANY prosecutor emails, victim proffers, evidence transfers, FBI coordination, formal decline-to-charge), ~10% Epstein/Maxwell case infrastructure, ~10% institutional records and evidence files.',
        total_files: 152,
        total_pages: 1525,
        size_bytes: 114 * 1024 * 1024, // 114 MB
        reviewed_count: 137,
        bates_range_start: 'EFTA02730265',
        bates_range_end: 'EFTA02731789',
        release_date: '2026-01-30',
        status: 'completed',
        priority: 'critical',
        notes: 'Wave 2 release. Contains prosecution failure evidence for Leon Black case.',
      },
      { onConflict: 'number' },
    )
    .select()
    .single()

  if (dsError) {
    console.error('Failed to seed dataset:', dsError.message)
    process.exit(1)
  }
  console.log(`  ✓ Dataset 12 seeded (id: ${dataset.id})`)

  // Seed the Leon Black Prosecution Failure investigation
  console.log('Seeding investigation...')

  const { data: investigation, error: invError } = await supabase
    .from('investigations')
    .upsert(
      {
        name: 'Leon Black Prosecution Failure',
        status: 'active',
        summary:
          'SDNY possessed overwhelming evidence of serial sexual assault by Leon Black against 10+ women from April 2021 through August 2024. Three independent victims with corroborating signature violence, forensically authenticated victim journals, bank statements showing $158M in payments, photographs, medical records, video evidence, and text messages. CRU formally declined to open investigation. Original AUSA never wrote formal assessment. Zero charges filed.',
        open_questions: [
          'Who is the "Additional HT Subject" referenced in EFTA02731736?',
          'What was in "Exhibit C" to Judge Rakoff?',
          'Has the trafficking video been located?',
          'Who is the "federal worker" referenced in victim journals?',
          'What happened between August 2024 and January 2026?',
        ],
      },
      { onConflict: 'name' },
    )
    .select()
    .single()

  if (invError) {
    console.error('Failed to seed investigation:', invError.message)
    process.exit(1)
  }
  console.log(`  ✓ Investigation seeded (id: ${investigation.id})`)

  return { datasetId: dataset.id, investigationId: investigation.id }
}

// Allow direct execution and import
export { seedDataset }

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDataset()
    .then(({ datasetId, investigationId }) => {
      console.log(`\nDone. Dataset ID: ${datasetId}, Investigation ID: ${investigationId}`)
    })
    .catch(console.error)
}
