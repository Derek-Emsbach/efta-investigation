import type { Tier } from '@efta/shared'
import { TIER_CONFIG } from '@efta/shared'

const TIER_COLORS: Record<Tier, string> = {
  1: 'var(--color-tier-1)',
  2: 'var(--color-tier-2)',
  3: 'var(--color-tier-3)',
  4: 'var(--color-tier-4)',
  5: 'var(--color-tier-5)',
  6: 'var(--color-tier-6)',
}

export function TierBadgePub({ tier }: { tier: Tier }) {
  const config = TIER_CONFIG[tier]
  const color = TIER_COLORS[tier]

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="w-2.5 h-2.5 shrink-0"
        style={{ backgroundColor: color }}
      />
      <span
        className="font-mono text-xs font-semibold uppercase tracking-wider"
        style={{ color }}
      >
        Tier {tier} — {config.shortLabel}
      </span>
    </span>
  )
}
