import { NextResponse } from 'next/server'
import { requireInvestigator } from '@/lib/supabase/require-investigator'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(request: Request) {
  const rateLimited = await checkRateLimit(request, {
    tier: 'general',
    isInvestigator: true,
  })
  if (rateLimited) return rateLimited

  const result = await requireInvestigator()
  if (result instanceof NextResponse) return result
  const { user, supabase, stats } = result

  // Check if daily AI query counter needs reset
  const today = new Date().toISOString().slice(0, 10)
  const aiQueriesUsed =
    stats.ai_queries_reset_date === today ? stats.ai_queries_used_today : 0

  // Fetch recent XP transactions
  const { data: recentXp } = await supabase
    .from('xp_transactions')
    .select('id, event_type, xp_amount, notes, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({
    stats: {
      xp_total: stats.xp_total,
      current_rank: stats.current_rank,
      submissions_count: stats.submissions_count,
      approved_submissions_count: stats.approved_submissions_count,
      ai_queries_used: aiQueriesUsed,
      ai_queries_daily_limit: stats.ai_queries_daily_limit,
    },
    recent_xp: recentXp ?? [],
  })
}
