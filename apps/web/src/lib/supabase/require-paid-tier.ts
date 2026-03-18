import { NextResponse } from 'next/server'
import { createClient } from './server'
import type { User, SupabaseClient } from '@supabase/supabase-js'
import type { SubscriptionTier } from '@efta/shared'

interface PaidTierContext {
  user: User
  supabase: SupabaseClient
  tier: SubscriptionTier
}

/**
 * Guard for routes accessible to any paid tier (supporter or investigator).
 * Returns { user, supabase, tier } on success, or a 401/403 NextResponse.
 *
 * Usage:
 *   const result = await requirePaidTier()
 *   if (result instanceof NextResponse) return result
 *   const { user, supabase, tier } = result
 */
export async function requirePaidTier(): Promise<PaidTierContext | NextResponse> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .single()

  const tier = profile?.subscription_tier as SubscriptionTier | null

  if (!tier || tier === 'subscriber') {
    return NextResponse.json(
      { error: 'Paid subscription required' },
      { status: 403 },
    )
  }

  return { user, supabase, tier }
}
