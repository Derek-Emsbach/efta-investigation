/**
 * Run migration 016 against Supabase using the Management API.
 * Usage: npx tsx scripts/run-migration-016.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { config } from 'dotenv'

// Load env
config({ path: resolve(__dirname, '../apps/web/.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim()

// Extract project ref from URL
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]

async function runSQL(sql: string): Promise<void> {
  // Use the Supabase PostgREST rpc endpoint won't work for DDL.
  // Use the Management API instead: POST /v1/projects/{ref}/database/query
  // But that requires a Supabase access token, not service role key.
  //
  // Alternative: use pg_net or just POST to the SQL endpoint via service role.
  // Simplest: use supabase-js to call a custom RPC or use the REST endpoint.
  //
  // Actually, the cleanest approach: use the `pg` npm package directly.
  // Supabase exposes a direct connection at:
  // postgresql://postgres.[ref]:[service_role_key]@aws-0-us-east-1.pooler.supabase.com:6543/postgres

  // Try connecting via the pooler with service role key as password
  const { default: pg } = await import('pg')

  const connectionString = `postgresql://postgres.${projectRef}:${SERVICE_ROLE_KEY}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })

  try {
    await client.connect()
    console.log('Connected to Supabase PostgreSQL')

    await client.query(sql)
    console.log('Migration 016 executed successfully')
  } finally {
    await client.end()
  }
}

async function main() {
  const migrationPath = resolve(__dirname, '../packages/db/migrations/016_publication_tables.sql')
  const sql = readFileSync(migrationPath, 'utf-8')

  console.log('Running migration 016: Publication tables...')
  console.log(`Project: ${projectRef}`)

  await runSQL(sql)

  console.log('\nDone! Verify tables exist:')
  console.log('  - case_files')
  console.log('  - stories')
  console.log('  - story_entities')
  console.log('  - story_citations')
  console.log('  - case_file_entities')
  console.log('  - open_questions')
  console.log('  - entities.slug column')
  console.log('  - entities.financial_summary column')
  console.log('  - entities.profile_published column')
}

main().catch((err) => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
