/**
 * Import entities from docs/investigation/ENTITIES.md into Supabase.
 * Parses 3 markdown table sections with different column layouts.
 * Returns a name→ID map for use by other import scripts.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { supabase, rootDir } from './utils/supabase-admin.js'
import { parseMarkdownTable, parseSourceDocs, normalizeStatus } from './utils/markdown-parser.js'

interface EntityInsert {
  name: string
  entity_type: string
  tier: number
  category: string | null
  bio: string | null
  status: string
  is_public: boolean
  datasets_appeared: number[]
  metadata: Record<string, unknown>
}

async function importEntities(): Promise<Map<string, string>> {
  const filePath = resolve(rootDir, 'docs/investigation/ENTITIES.md')
  const content = readFileSync(filePath, 'utf-8')
  const nameToId = new Map<string, string>()
  const entities: EntityInsert[] = []

  // ─── Tier 1: Convicted/Charged (5 columns: Name, Category, Status, Key Evidence, Source Docs) ───
  console.log('Parsing Tier 1 entities...')
  const tier1Rows = parseMarkdownTable(content, 'Tier 1')
  for (const cells of tier1Rows) {
    const [name, category, status, keyEvidence, sourceDocs] = cells
    const batesNumbers = parseSourceDocs(sourceDocs || '')
    entities.push({
      name: name.trim(),
      entity_type: 'person',
      tier: 1,
      category: category?.trim().toLowerCase() || 'abuser',
      bio: keyEvidence?.trim() || null,
      status: normalizeStatus(status?.trim() || ''),
      is_public: true, // public figures
      datasets_appeared: [12],
      metadata: {
        source_docs: batesNumbers,
        import_source: 'ENTITIES.md',
      },
    })
  }
  console.log(`  Found ${tier1Rows.length} Tier 1 entities`)

  // ─── Tier 3: Suspicious/Concerning (3 columns: Name, Status, Source) ───
  console.log('Parsing Tier 3 entities...')
  const tier3Rows = parseMarkdownTable(content, 'Tier 3')
  for (const cells of tier3Rows) {
    const [name, status, source] = cells
    const batesNumbers = parseSourceDocs(source || '')

    // Extract parenthetical notes as aliases, e.g. "Mr. Dana (Rockefeller)"
    const nameClean = name.trim()
    const parenMatch = nameClean.match(/^(.+?)\s*\((.+?)\)$/)
    const displayName = parenMatch ? parenMatch[1].trim() : nameClean
    const alias = parenMatch ? parenMatch[2].trim() : null

    entities.push({
      name: displayName,
      entity_type: 'person',
      tier: 3,
      category: 'abuser', // journal-named
      bio: alias ? `Possibly identified as ${alias}` : null,
      status: normalizeStatus(status?.trim() || ''),
      is_public: false, // partially identified
      datasets_appeared: [12],
      metadata: {
        source_docs: batesNumbers,
        aliases: alias ? [alias] : [],
        import_source: 'ENTITIES.md',
      },
    })
  }
  console.log(`  Found ${tier3Rows.length} Tier 3 entities`)

  // ─── Tier 6: Staff/Legal (4 columns: Name, Category, Role, Source Docs) ───
  console.log('Parsing Tier 6 entities...')
  const tier6Rows = parseMarkdownTable(content, 'Tier 6')
  for (const cells of tier6Rows) {
    const [name, category, role, sourceDocs] = cells
    const batesNumbers = parseSourceDocs(sourceDocs || '')
    entities.push({
      name: name.trim(),
      entity_type: 'person',
      tier: 6,
      category: category?.trim().toLowerCase() || 'staff',
      bio: role?.trim() || null,
      status: 'identified',
      is_public: true,
      datasets_appeared: [12],
      metadata: {
        source_docs: batesNumbers,
        import_source: 'ENTITIES.md',
      },
    })
  }
  console.log(`  Found ${tier6Rows.length} Tier 6 entities`)

  // ─── Insert all entities ───
  console.log(`\nInserting ${entities.length} entities...`)
  let inserted = 0
  let errors = 0

  for (const entity of entities) {
    const { data, error } = await supabase
      .from('entities')
      .upsert(entity, { onConflict: 'name' })
      .select('id, name')
      .single()

    if (error) {
      // If upsert on name fails (name isn't unique constraint), try insert
      const { data: insertData, error: insertError } = await supabase
        .from('entities')
        .insert(entity)
        .select('id, name')
        .single()

      if (insertError) {
        console.error(`  ✗ Failed: ${entity.name} — ${insertError.message}`)
        errors++
        continue
      }
      nameToId.set(insertData.name, insertData.id)
      inserted++
    } else {
      nameToId.set(data.name, data.id)
      inserted++
    }
  }

  console.log(`  ✓ Inserted: ${inserted}, Errors: ${errors}`)
  return nameToId
}

export { importEntities }

if (import.meta.url === `file://${process.argv[1]}`) {
  importEntities()
    .then(nameToId => {
      console.log(`\nDone. ${nameToId.size} entities mapped.`)
    })
    .catch(console.error)
}
