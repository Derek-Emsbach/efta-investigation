/**
 * Import entity connections into Supabase.
 * These are curated, well-documented relationships with source citations.
 * Human judgment required for type and strength — we hardcode the clear-cut ones.
 */
import { supabase } from './utils/supabase-admin.js'

interface ConnectionDef {
  entity_a_name: string
  entity_b_name: string
  relationship_type: string
  evidence_strength: string
  description: string
  source_bates: string[]
}

const CONNECTIONS: ConnectionDef[] = [
  // Victim attorneys
  {
    entity_a_name: 'Jeanne Christensen',
    entity_b_name: 'Douglas Wigdor',
    relationship_type: 'employed_by',
    evidence_strength: 'documented',
    description: 'Wigdor LLP partner',
    source_bates: ['EFTA02731577', 'EFTA02731724'],
  },
  {
    entity_a_name: 'Meredith Firetog',
    entity_b_name: 'Douglas Wigdor',
    relationship_type: 'employed_by',
    evidence_strength: 'documented',
    description: 'Wigdor LLP attorney',
    source_bates: ['EFTA02731577'],
  },
  {
    entity_a_name: 'David Gottlieb',
    entity_b_name: 'Douglas Wigdor',
    relationship_type: 'employed_by',
    evidence_strength: 'documented',
    description: 'Wigdor LLP attorney',
    source_bates: ['EFTA02731577'],
  },
  // Black's defense
  {
    entity_a_name: 'Susan Estrich',
    entity_b_name: 'Leon Black',
    relationship_type: 'attorney_for',
    evidence_strength: 'documented',
    description: 'Defense attorney for Leon Black',
    source_bates: ['EFTA02731724'],
  },
  {
    entity_a_name: 'Brad Edwards',
    entity_b_name: 'Leon Black',
    relationship_type: 'hired_by',
    evidence_strength: 'documented',
    description: 'Hired by Black — conflict of interest as former victims attorney',
    source_bates: ['EFTA02731577'],
  },
  // Prosecutors investigating Black
  {
    entity_a_name: 'Alissa Wimmer',
    entity_b_name: 'Leon Black',
    relationship_type: 'investigated_by',
    evidence_strength: 'documented',
    description: 'DANY ADA investigating Leon Black',
    source_bates: ['EFTA02731623'],
  },
  {
    entity_a_name: 'Vanessa Puzio',
    entity_b_name: 'Leon Black',
    relationship_type: 'investigated_by',
    evidence_strength: 'documented',
    description: 'DANY ADA investigating Leon Black',
    source_bates: ['EFTA02731623'],
  },
  {
    entity_a_name: 'Lauren Phillips',
    entity_b_name: 'Leon Black',
    relationship_type: 'investigated_by',
    evidence_strength: 'documented',
    description: 'SDNY AUSA handling Black case',
    source_bates: ['EFTA02731783'],
  },
  // Judge connections
  {
    entity_a_name: 'Judge Jed Rakoff',
    entity_b_name: 'Leon Black',
    relationship_type: 'investigated_by',
    evidence_strength: 'documented',
    description: 'SDNY judge presiding over JPMC civil case, ordered forensic examination of victim journals',
    source_bates: ['EFTA02731640', 'EFTA02731724', 'EFTA02731734'],
  },
  // Trafficking connections
  {
    entity_a_name: 'Jean-Luc Brunel',
    entity_b_name: 'Leon Black',
    relationship_type: 'connected_to',
    evidence_strength: 'documented',
    description: 'Victim trafficked to Black via Brunel for "similar massages"',
    source_bates: ['EFTA02731662'],
  },
  {
    entity_a_name: 'Jes Staley',
    entity_b_name: 'Leon Black',
    relationship_type: 'connected_to',
    evidence_strength: 'alleged',
    description: 'DANY believes Staley abused same victim; identified as additional abuser in same investigation',
    source_bates: ['EFTA02731662', 'EFTA02731737'],
  },
  // DANY/SDNY coordination
  {
    entity_a_name: 'Alissa Wimmer',
    entity_b_name: 'Vanessa Puzio',
    relationship_type: 'connected_to',
    evidence_strength: 'documented',
    description: 'DANY ADAs working together on Leon Black investigation',
    source_bates: ['EFTA02731623'],
  },
  {
    entity_a_name: 'Alissa Wimmer',
    entity_b_name: 'Lauren Phillips',
    relationship_type: 'connected_to',
    evidence_strength: 'documented',
    description: 'DANY-SDNY inter-agency coordination on Black case',
    source_bates: ['EFTA02731623', 'EFTA02731783'],
  },
  // Victim representation
  {
    entity_a_name: 'Jeanne Christensen',
    entity_b_name: 'Leon Black',
    relationship_type: 'connected_to',
    evidence_strength: 'documented',
    description: 'Wigdor LLP partner representing 10+ victims of Leon Black',
    source_bates: ['EFTA02731577', 'EFTA02731724'],
  },
  // Prior attorneys
  {
    entity_a_name: 'Horowitz',
    entity_b_name: 'Jeanne Christensen',
    relationship_type: 'referred_by',
    evidence_strength: 'documented',
    description: 'Prior victim attorney before case transferred to Wigdor LLP',
    source_bates: ['EFTA02731737'],
  },
]

async function importConnections(entityNameToId?: Map<string, string>): Promise<void> {
  console.log('Importing entity connections...')

  // If no name map provided, build one from database
  let nameToId = entityNameToId
  if (!nameToId) {
    nameToId = new Map()
    const { data: entities } = await supabase.from('entities').select('id, name')
    if (entities) {
      for (const e of entities) {
        nameToId.set(e.name, e.id)
      }
    }
  }

  let inserted = 0
  let skipped = 0
  let errors = 0

  for (const conn of CONNECTIONS) {
    const entityAId = nameToId.get(conn.entity_a_name)
    const entityBId = nameToId.get(conn.entity_b_name)

    if (!entityAId) {
      console.warn(`  ⚠ Entity not found: "${conn.entity_a_name}" — skipping connection`)
      skipped++
      continue
    }
    if (!entityBId) {
      console.warn(`  ⚠ Entity not found: "${conn.entity_b_name}" — skipping connection`)
      skipped++
      continue
    }

    // Resolve source document IDs
    const sourceDocIds: string[] = []
    for (const bates of conn.source_bates) {
      const { data: doc } = await supabase
        .from('documents')
        .select('id')
        .eq('bates_number', bates)
        .single()
      if (doc) sourceDocIds.push(doc.id)
    }

    const { error } = await supabase.from('entity_connections').upsert(
      {
        entity_a: entityAId,
        entity_b: entityBId,
        relationship_type: conn.relationship_type,
        evidence_strength: conn.evidence_strength,
        description: conn.description,
        source_document_ids: sourceDocIds,
      },
      { onConflict: 'entity_a,entity_b,relationship_type' },
    )

    if (error) {
      console.error(`  ✗ Failed: ${conn.entity_a_name} → ${conn.entity_b_name}: ${error.message}`)
      errors++
    } else {
      inserted++
    }
  }

  console.log(`  ✓ Inserted: ${inserted}, Skipped: ${skipped}, Errors: ${errors}`)
}

export { importConnections }

if (import.meta.url === `file://${process.argv[1]}`) {
  importConnections()
    .then(() => console.log('\nDone.'))
    .catch(console.error)
}
