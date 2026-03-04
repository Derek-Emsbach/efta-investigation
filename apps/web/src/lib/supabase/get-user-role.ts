import { createClient } from './server'
import type { User } from '@supabase/supabase-js'
import type { UserRole, SubscriptionTier, InvestigatorStats } from '@efta/shared'

interface UserWithRole {
  user: User
  role: UserRole
  subscription_tier: SubscriptionTier | null
  stats: InvestigatorStats | null
}

/**
 * Get the current user and their role/tier from the profiles table.
 * Returns null if not authenticated.
 * Falls back to 'viewer' if no profile row exists.
 * Also fetches investigator_stats if the user is an investigator.
 */
export async function getUserRole(): Promise<UserWithRole | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, subscription_tier')
    .eq('id', user.id)
    .single()

  const role = (profile?.role as UserRole) ?? 'viewer'
  const subscription_tier = (profile?.subscription_tier as SubscriptionTier) ?? null

  let stats: InvestigatorStats | null = null
  if (subscription_tier === 'investigator') {
    const { data } = await supabase
      .from('investigator_stats')
      .select('*')
      .eq('user_id', user.id)
      .single()
    stats = data as InvestigatorStats | null
  }

  return { user, role, subscription_tier, stats }
}
