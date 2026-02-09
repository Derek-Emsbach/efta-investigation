import { TIER_CONFIG } from '@efta/shared'
import type { Tier } from '@efta/shared'

interface TierBadgeProps {
  tier: Tier
  size?: 'sm' | 'md'
}

export function TierBadge({ tier, size = 'sm' }: TierBadgeProps) {
  const config = TIER_CONFIG[tier]

  const sizeClasses =
    size === 'sm'
      ? 'text-xs px-2 py-0.5'
      : 'text-xs px-2.5 py-1'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded font-medium tracking-wider ${sizeClasses}`}
      style={{
        backgroundColor: `${config.color}15`,
        color: config.color,
      }}
    >
      <span className="font-bold">TIER {tier}</span>
      <span aria-hidden="true">&middot;</span>
      <span>{config.shortLabel}</span>
    </span>
  )
}
