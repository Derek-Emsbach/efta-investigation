import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Service role client that bypasses Row Level Security.
 * Use ONLY for:
 * - Import scripts
 * - Server-side operations that need unrestricted access
 * - API routes that need to write data
 *
 * NEVER expose service_role key to the client.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
