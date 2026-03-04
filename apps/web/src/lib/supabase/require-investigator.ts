import { NextResponse } from 'next/server'
import { createClient } from './server'
import type { User, SupabaseClient } from '@supabase/supabase-js'
import type { InvestigatorStats } from '@efta/shared'

interface InvestigatorContext {
  user: User
  supabase: SupabaseClient
  stats: InvestigatorStats
}

/**
 * Guard for investigator-only API routes.
 * Returns { user, supabase, stats } if the caller has subscription_tier = 'investigator'.
 * Returns a 401/403 NextResponse if not authenticated or wrong tier.
 *
 * Usage:
 *   const result = await requireInvestigator()
 *   if (result instanceof NextResponse) return result
 *   const { user, supabase, stats } = result
 */
export async function requireInvestigator(): Promise<InvestigatorContext | NextResponse> {
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

  if (profile?.subscription_tier !== 'investigator') {
    return NextResponse.json(
      { error: 'Investigator account required' },
      { status: 403 },
    )
  }

  // Fetch or create investigator stats
  let { data: stats } = await supabase
    .from('investigator_stats')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Stats row may not exist yet for brand-new investigators (trigger creates it on insert)
  if (!stats) {
    const { data: newStats } = await supabase
      .from('investigator_stats')
      .insert({ user_id: user.id })
      .select()
      .single()
    stats = newStats
  }

  if (!stats) {
    return NextResponse.json({ error: 'Failed to load investigator stats' }, { status: 500 })
  }

  return { user, supabase, stats: stats as InvestigatorStats }
}
