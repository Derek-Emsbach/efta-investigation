import type { Tier } from '@efta/shared'
import { TIER_CONFIG } from '@efta/shared'

const TIER_COLORS: Record<Tier, string> = {
  1: '#c41e3a',
  2: '#d4a017',
  3: '#e07020',
  4: '#6b7280',
  5: '#0d9488',
  6: '#64748b',
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
