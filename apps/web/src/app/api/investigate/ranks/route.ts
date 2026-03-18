import { NextResponse } from 'next/server'
import { requireInvestigator } from '@/lib/supabase/require-investigator'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * Rank definitions with XP thresholds.
 * Must match the CHECK constraint in investigator_stats and compute_rank() SQL function.
 */
const RANKS = [
  { name: 'Junior Detective', xp_required: 0, description: 'Just getting started. Welcome to the investigation.' },
  { name: 'Detective', xp_required: 100, description: 'Active investigator contributing to the case.' },
  { name: 'Detective Sergeant', xp_required: 500, description: 'Proven researcher with multiple approved findings.' },
  { name: 'Detective Lieutenant', xp_required: 1500, description: 'Senior investigator leading complex threads.' },
  { name: 'Detective Captain', xp_required: 5000, description: 'Veteran investigator with deep domain expertise.' },
  { name: 'Chief Inspector', xp_required: 15000, description: 'Elite rank. Among the most dedicated investigators.' },
]

export async function GET(request: Request) {
  const rateLimited = await checkRateLimit(request, {
    tier: 'general',
    isInvestigator: true,
  })
  if (rateLimited) return rateLimited

  const result = await requireInvestigator()
  if (result instanceof NextResponse) return result
  const { stats } = result

  // Find current rank index and next rank
  const currentIndex = RANKS.findIndex((r) => r.name === stats.current_rank)
  const currentRank = RANKS[currentIndex] ?? RANKS[0]
  const nextRank = currentIndex < RANKS.length - 1 ? RANKS[currentIndex + 1] : null

  // Calculate progress to next rank
  const progressToNext = nextRank
    ? {
        xp_current: stats.xp_total,
        xp_needed: nextRank.xp_required,
        xp_remaining: nextRank.xp_required - stats.xp_total,
        percentage: Math.min(
          100,
          Math.round(
            ((stats.xp_total - currentRank.xp_required) /
              (nextRank.xp_required - currentRank.xp_required)) *
              100,
          ),
        ),
      }
    : null

  return NextResponse.json({
    current_rank: currentRank,
    next_rank: nextRank,
    progress: progressToNext,
    all_ranks: RANKS,
    xp_total: stats.xp_total,
  })
}
