/**
 * Import documents from investigation markdown files into Supabase.
 * Extracts all unique Bates numbers across all docs and creates document records.
 * Enriches with context from TIMELINE.md where available.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { supabase, rootDir } from './utils/supabase-admin.js'
import { extractBatesNumbers, normalizeBatesNumber } from './utils/markdown-parser.js'

interface DocumentContext {
  title: string | null
  description: string | null
  date: string | null
  type: string | null
  significance: string | null
}

function inferDocumentType(description: string): string | null {
  const lower = description.toLowerCase()
  if (lower.includes('fbi 302') || lower.includes('fbi interview')) return 'fbi_302'
  if (lower.includes('prosecution memo') || lower.includes('prosecution recommendation')) return 'prosecution_memo'
  if (lower.includes('email') || lower.includes('internal sdny') || lower.includes('internal email')) return 'email'
  if (lower.includes('bank statement') || lower.includes('wire transfer') || lower.includes('financial')) return 'financial'
  if (lower.includes('journal') || lower.includes('notebook')) return 'victim_journal'
  if (lower.includes('photograph') || lower.includes('photo')) return 'photo'
  if (lower.includes('court') || lower.includes('testif') || lower.includes('distribution order')) return 'court_filing'
  if (lower.includes('foia') || lower.includes('corporate prosecution')) return 'memo'
  if (lower.includes('evidence catalog') || lower.includes('evidence inventory')) return 'memo'
  if (lower.includes('brief') || lower.includes('assessment')) return 'memo'
  return null
}

async function importDocuments(): Promise<Map<string, string>> {
  const batesToId = new Map<string, string>()

  // Read all investigation files to extract Bates numbers
  const files = [
    'docs/investigation/ENTITIES.md',
    'docs/investigation/TIMELINE.md',
    'docs/investigation/LEON_BLACK_CASE.md',
    'docs/investigation/DS12_SUMMARY.md',
  ]

  const allBatesNumbers = new Set<string>()
  const contextMap = new Map<string, DocumentContext>()

  // Collect all Bates numbers
  for (const file of files) {
    try {
      const content = readFileSync(resolve(rootDir,file), 'utf-8')
      const found = extractBatesNumbers(content)
      found.forEach(b => allBatesNumbers.add(b))
    } catch {
      console.warn(`  Warning: Could not read ${file}`)
    }
  }

  console.log(`Found ${allBatesNumbers.size} unique Bates numbers across investigation files`)

  // Build context from TIMELINE.md
  console.log('Building document context from TIMELINE.md...')
  const timelineContent = readFileSync(
    resolve(rootDir,'docs/investigation/TIMELINE.md'),
    'utf-8',
  )

  const timelineLines = timelineContent.split('\n')
  for (const line of timelineLines) {
    if (!line.startsWith('|') || line.includes('---') || line.startsWith('| Date')) continue

    const cells = line.split('|').slice(1, -1).map(c => c.trim())
    if (cells.length < 4) continue

    const [date, title, description, type, ...rest] = cells
    const significance = rest.length >= 2 ? rest[0] : null
    const sourceDocsCell = rest[rest.length - 1] || ''

    // Extract Bates numbers from this event's source docs
    const batesNumbers = extractBatesNumbers(sourceDocsCell)
    for (const bates of batesNumbers) {
      if (!contextMap.has(bates)) {
        contextMap.set(bates, {
          title: title || null,
          description: description || null,
          date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
          type: inferDocumentType(description || ''),
          significance: significance || null,
        })
      }
    }
  }

  console.log(`  Built context for ${contextMap.size} documents`)

  // Get the DS12 dataset ID
  const { data: ds12 } = await supabase
    .from('datasets')
    .select('id')
    .eq('number', 12)
    .single()

  if (!ds12) {
    console.error('DS12 dataset not found. Run seed-dataset.ts first.')
    process.exit(1)
  }

  // Insert documents
  console.log(`\nInserting ${allBatesNumbers.size} documents...`)
  let inserted = 0
  let errors = 0

  for (const bates of allBatesNumbers) {
    const context = contextMap.get(bates)

    const docRecord = {
      bates_number: bates,
      dataset_id: ds12.id,
      title: context?.title || null,
      document_type: context?.type || null,
      original_date: context?.date || null,
      summary: context?.description || null,
      processing_status: 'reviewed',
      classification: context?.significance?.toLowerCase().includes('first') ||
        context?.significance?.toLowerCase().includes('formal') ||
        context?.significance?.toLowerCase().includes('devastating')
        ? 'high'
        : 'medium',
      forensic_metadata: {
        import_source: 'investigation_markdown',
        enriched_from_timeline: !!context,
        significance: context?.significance || null,
      },
    }

    const { data, error } = await supabase
      .from('documents')
      .upsert(docRecord, { onConflict: 'bates_number' })
      .select('id, bates_number')
      .single()

    if (error) {
      console.error(`  ✗ Failed: ${bates} — ${error.message}`)
      errors++
    } else {
      batesToId.set(data.bates_number!, data.id)
      inserted++
    }
  }

  console.log(`  ✓ Inserted: ${inserted}, Errors: ${errors}`)
  return batesToId
}

export { importDocuments }

if (import.meta.url === `file://${process.argv[1]}`) {
  importDocuments()
    .then(batesToId => {
      console.log(`\nDone. ${batesToId.size} documents mapped.`)
    })
    .catch(console.error)
}
