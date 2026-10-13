import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client for PUBLIC, READ-ONLY page rendering.
 *
 * Every GET/HEAD to PostgREST goes through Next's Data Cache for
 * `PUBLIC_READ_REVALIDATE_SECONDS`, so a page viewed 10,000 times in 3 minutes
 * costs Supabase one round of queries, not 10,000. Writes (POST/PATCH/DELETE)
 * and RPCs (POST) are never cached.
 *
 * Trade-off: publishing/unpublishing shows up on public pages within this
 * window, not instantly. For an urgent takedown, redeploy or hit the page's
 * revalidatePath. Never use this client for dashboard/admin reads.
 */
export const PUBLIC_READ_REVALIDATE_SECONDS = 180

const cachedFetch: typeof fetch = (input, init) => {
  const method = (init?.method ?? 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD') {
    return fetch(input, {
      ...init,
      // next.revalidate opts this fetch into the Data Cache (time-based ISR)
      next: { revalidate: PUBLIC_READ_REVALIDATE_SECONDS, tags: ['public-read'] },
    })
  }
  return fetch(input, { ...init, cache: 'no-store' })
}

export function createCachedReadClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    {
      global: { fetch: cachedFetch },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
}
