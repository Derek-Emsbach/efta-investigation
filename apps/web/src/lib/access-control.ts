import type { SubscriptionTier, InvestigatorStats } from '@efta/shared'

/** Subscribers and Investigators can comment */
export function canComment(tier: SubscriptionTier | null | undefined): boolean {
  return tier === 'subscriber' || tier === 'investigator'
}

/** Subscribers and Investigators can like/boost articles */
export function canBoost(tier: SubscriptionTier | null | undefined): boolean {
  return tier === 'subscriber' || tier === 'investigator'
}

/** Only Investigators can flag inaccuracies */
export function canFlag(tier: SubscriptionTier | null | undefined): boolean {
  return tier === 'subscriber' || tier === 'investigator'
}

/** Only Investigators can use the AI detective */
export function canUseDetective(tier: SubscriptionTier | null | undefined): boolean {
  return tier === 'investigator'
}

/** Only Investigators can submit findings */
export function canSubmitFindings(tier: SubscriptionTier | null | undefined): boolean {
  return tier === 'investigator'
}

/** Only Investigators can use personal notes */
export function canTakeNotes(tier: SubscriptionTier | null | undefined): boolean {
  return tier === 'investigator'
}

/**
 * How many AI queries remain today. Handles the lazy reset logic.
 * Returns -1 if the tier doesn't have AI access.
 */
export function getRemainingAiQueries(
  stats: InvestigatorStats | null | undefined,
): number {
  if (!stats) return -1
  const today = new Date().toISOString().slice(0, 10)
  const usedToday =
    stats.ai_queries_reset_date < today ? 0 : stats.ai_queries_used_today
  return Math.max(0, stats.ai_queries_daily_limit - usedToday)
}

/** Human-readable rank abbreviation for display in headers/badges */
export function getRankAbbreviation(rank: string): string {
  const abbr: Record<string, string> = {
    'Junior Detective': 'JR. DET.',
    'Detective': 'DET.',
    'Detective Sergeant': 'DET. SGT.',
    'Detective Lieutenant': 'DET. LT.',
    'Detective Captain': 'DET. CAPT.',
    'Chief Inspector': 'CHIEF INSP.',
  }
  return abbr[rank] ?? rank
}
