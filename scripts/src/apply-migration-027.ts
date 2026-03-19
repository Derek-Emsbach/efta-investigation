/**
 * Apply migration 027: add 'trump' to stories.section CHECK constraint.
 * Uses node-postgres (pg) via environment DATABASE_URL if available,
 * otherwise prints the SQL for manual application.
 *
 * Usage: pnpm --filter @efta/scripts tsx src/apply-migration-027.ts
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { existsSync } from 'fs'

function findRoot(dir: string): string {
  if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir
  const parent = resolve(dir, '..')
  if (parent === dir) return process.cwd()
  return findRoot(parent)
}

const rootDir = findRoot(process.cwd())
config({ path: resolve(rootDir, '.env.local') })

const SQL = `
ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_section_check;
ALTER TABLE stories ADD CONSTRAINT stories_section_check
  CHECK (section IN ('the-network', 'follow-the-money', 'the-cover-up', 'the-operation', 'voices', 'trump'));
`

// Try DATABASE_URL approach (direct pg connection)
const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL

if (!dbUrl) {
  console.log('No DATABASE_URL found. Please apply the following SQL via the Supabase SQL editor:')
  console.log('https://supabase.com/dashboard/project/bzavudadbbmcolnvwkgr/sql/new')
  console.log('\n--- SQL to run ---')
  console.log(SQL)
  console.log('------------------\n')
  process.exit(0)
}

// Dynamic import of pg (may not be installed)
try {
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: dbUrl })
  await client.connect()
  await client.query(SQL)
  await client.end()
  console.log('Migration 027 applied successfully via DATABASE_URL.')
} catch (err) {
  const e = err as Error
  console.error('Failed to apply migration via pg:', e.message)
  console.log('\nPlease apply manually via the Supabase SQL editor:')
  console.log('https://supabase.com/dashboard/project/bzavudadbbmcolnvwkgr/sql/new')
  console.log('\n--- SQL to run ---')
  console.log(SQL)
  console.log('------------------')
}
