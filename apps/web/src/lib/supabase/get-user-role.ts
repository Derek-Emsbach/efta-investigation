import { createClient } from './server'
import type { User } from '@supabase/supabase-js'
import type { UserRole } from '@efta/shared'

interface UserWithRole {
  user: User
  role: UserRole
}

/**
 * Get the current user and their role from the profiles table.
 * Returns null if not authenticated.
 * Falls back to 'viewer' if no profile row exists.
 */
export async function getUserRole(): Promise<UserWithRole | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return {
    user,
    role: (profile?.role as UserRole) ?? 'viewer',
  }
}
