import { NextResponse } from 'next/server'
import { createClient } from './server'
import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

interface AdminContext {
  user: User
  supabase: SupabaseClient
}

/**
 * Guard for admin-only API routes.
 * Returns { user, supabase } if the caller is an admin.
 * Returns a 401/403 NextResponse if not authenticated or not admin.
 *
 * Usage in an API route:
 *   const result = await requireAdmin()
 *   if (result instanceof NextResponse) return result
 *   const { user, supabase } = result
 */
export async function requireAdmin(): Promise<AdminContext | NextResponse> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'viewer'

  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return { user, supabase }
}
