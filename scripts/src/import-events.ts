/**
 * Import timeline events from docs/investigation/TIMELINE.md into Supabase.
 * Also creates event_documents and entity_events junction records.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { supabase } from './utils/supabase-admin.js'
import { extractBatesNumbers } from './utils/markdown-parser.js'

interface EventInsert {
  date: string | null
  title: string
  description: string | null
  significance: string | null
  event_type: string | null
  investigation_id: string | null
  sourceBates: string[] // not inserted directly — used for junction records
}

async function importEvents(
  entityNameToId?: Map<string, string>,
  batesToId?: Map<string, string>,
): Promise<void> {
  const filePath = resolve(process.cwd(), 'docs/investigation/TIMELINE.md')
  const content = readFileSync(filePath, 'utf-8')
  const events: EventInsert[] = []

  // Get the Leon Black investigation ID
  const { data: investigation } = await supabase
    .from('investigations')
    .select('id')
    .eq('name', 'Leon Black Prosecution Failure')
    .single()

  const investigationId = investigation?.id || null

  // Parse Leon Black timeline (6 columns: Date, Title, Description, Type, Significance, Source Docs)
  console.log('Parsing Leon Black Investigation Timeline...')
  const lines = content.split('\n')
  let section = ''

  for (const line of lines) {
    if (line.startsWith('## Leon Black')) {
      section = 'black'
      continue
    }
    if (line.startsWith('## Additional')) {
      section = 'additional'
      continue
    }
    if (line.startsWith('## ') && !line.includes('Leon Black') && !line.includes('Additional')) {
      section = ''
      continue
    }

    if (!section) continue
    if (!line.startsWith('|') || line.includes('---') || line.startsWith('| Date')) continue

    const cells = line.split('|').slice(1, -1).map(c => c.trim())

    if (section === 'black' && cells.length >= 6) {
      const [date, title, description, type, significance, sourceDocs] = cells
      events.push({
        date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
        title,
        description,
        significance,
        event_type: type?.toLowerCase() || null,
        investigation_id: investigationId,
        sourceBates: extractBatesNumbers(sourceDocs || ''),
      })
    } else if (section === 'additional' && cells.length >= 5) {
      // 5 columns: Date, Title, Description, Type, Source Docs (no Significance)
      const [date, title, description, type, sourceDocs] = cells
      events.push({
        date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
        title,
        description,
        significance: null,
        event_type: type?.toLowerCase() || null,
        investigation_id: null, // Not part of Leon Black investigation
        sourceBates: extractBatesNumbers(sourceDocs || ''),
      })
    }
  }

  console.log(`  Found ${events.length} events`)

  // Insert events
  console.log(`\nInserting ${events.length} events...`)
  let inserted = 0
  let junctionsCreated = 0

  for (const event of events) {
    const { sourceBates, ...eventData } = event
    const { data, error } = await supabase
      .from('events')
      .insert(eventData)
      .select('id')
      .single()

    if (error) {
      console.error(`  ✗ Failed: ${event.title} — ${error.message}`)
      continue
    }
    inserted++

    const eventId = data.id

    // Create event_documents junctions
    if (batesToId && sourceBates.length > 0) {
      for (const bates of sourceBates) {
        const docId = batesToId.get(bates)
        if (docId) {
          const { error: jError } = await supabase
            .from('event_documents')
            .upsert({ event_id: eventId, document_id: docId }, { onConflict: 'event_id,document_id' })

          if (!jError) junctionsCreated++
        }
      }
    }

    // Create entity_events junctions by matching entity names in description
    if (entityNameToId && event.description) {
      const desc = event.description
      for (const [entityName, entityId] of entityNameToId) {
        // Only match substantial names (skip very short ones)
        if (entityName.length < 4) continue
        // Check if entity name appears in title or description
        const searchText = `${event.title} ${desc}`
        if (searchText.includes(entityName)) {
          const role = desc.toLowerCase().includes('victim') ? 'victim'
            : desc.toLowerCase().includes('testif') ? 'witness'
            : 'participant'

          const { error: eeError } = await supabase
            .from('entity_events')
            .upsert(
              { entity_id: entityId, event_id: eventId, role },
              { onConflict: 'entity_id,event_id,role' },
            )

          if (!eeError) junctionsCreated++
        }
      }
    }
  }

  console.log(`  ✓ Events inserted: ${inserted}`)
  console.log(`  ✓ Junction records created: ${junctionsCreated}`)
}

export { importEvents }

if (import.meta.url === `file://${process.argv[1]}`) {
  importEvents()
    .then(() => console.log('\nDone.'))
    .catch(console.error)
}
