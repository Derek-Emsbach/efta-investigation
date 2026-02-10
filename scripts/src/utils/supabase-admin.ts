import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { existsSync } from 'fs'
import { resolve } from 'path'

// Determine monorepo root: look for pnpm-workspace.yaml walking up from cwd
function findRoot(dir: string): string {
  if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir
  const parent = resolve(dir, '..')
  if (parent === dir) return process.cwd() // fallback
  return findRoot(parent)
}

export const rootDir = findRoot(process.cwd())

// Load .env.local from monorepo root
config({ path: resolve(rootDir, '.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

export const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
