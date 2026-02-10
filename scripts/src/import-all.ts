/**
 * Master import script — runs all import scripts in dependency order.
 *
 * Order matters:
 * 1. seed-dataset — creates DS12 dataset + Leon Black investigation
 * 2. import-entities — creates all entities, returns name→ID map
 * 3. import-documents — creates all documents, returns bates→ID map
 * 4. import-events — creates events + event_documents + entity_events junctions
 * 5. import-connections — creates entity_connections
 *
 * Usage: pnpm --filter @efta/scripts import:all
 */
import { seedDataset } from './seed-dataset.js'
import { importEntities } from './import-entities.js'
import { importDocuments } from './import-documents.js'
import { importEvents } from './import-events.js'
import { importConnections } from './import-connections.js'

async function main() {
  const startTime = Date.now()
  console.log('═══════════════════════════════════════════════════')
  console.log('  EFTA Investigation Platform — DS12 Data Import')
  console.log('═══════════════════════════════════════════════════')
  console.log()

  // Step 1: Seed dataset and investigation
  console.log('┌─────────────────────────────────────────────────')
  console.log('│ Step 1/5: Seeding DS12 dataset + investigation')
  console.log('└─────────────────────────────────────────────────')
  const { datasetId, investigationId } = await seedDataset()
  console.log()

  // Step 2: Import entities
  console.log('┌─────────────────────────────────────────────────')
  console.log('│ Step 2/5: Importing entities from ENTITIES.md')
  console.log('└─────────────────────────────────────────────────')
  const entityNameToId = await importEntities()
  console.log()

  // Step 3: Import documents
  console.log('┌─────────────────────────────────────────────────')
  console.log('│ Step 3/5: Importing documents (all Bates numbers)')
  console.log('└─────────────────────────────────────────────────')
  const batesToId = await importDocuments()
  console.log()

  // Step 4: Import events + junction records
  console.log('┌─────────────────────────────────────────────────')
  console.log('│ Step 4/5: Importing events from TIMELINE.md')
  console.log('└─────────────────────────────────────────────────')
  await importEvents(entityNameToId, batesToId)
  console.log()

  // Step 5: Import connections
  console.log('┌─────────────────────────────────────────────────')
  console.log('│ Step 5/5: Importing entity connections')
  console.log('└─────────────────────────────────────────────────')
  await importConnections(entityNameToId)
  console.log()

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('═══════════════════════════════════════════════════')
  console.log(`  Import complete in ${elapsed}s`)
  console.log(`  Dataset: ${datasetId}`)
  console.log(`  Investigation: ${investigationId}`)
  console.log(`  Entities: ${entityNameToId.size}`)
  console.log(`  Documents: ${batesToId.size}`)
  console.log('═══════════════════════════════════════════════════')
}

main().catch(err => {
  console.error('\nImport failed:', err)
  process.exit(1)
})
