import type { EvidenceItemStrength } from '@efta/shared'

interface EvidenceStrengthProps {
  strength: EvidenceItemStrength
  showLabel?: boolean
}

const STRENGTH_MAP: Record<EvidenceItemStrength, { filled: number; label: string }> = {
  strong: { filled: 3, label: 'Strong' },
  moderate: { filled: 2, label: 'Moderate' },
  weak: { filled: 1, label: 'Weak' },
}

export function EvidenceStrength({ strength, showLabel = true }: EvidenceStrengthProps) {
  const { filled, label } = STRENGTH_MAP[strength]

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-warning">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`w-1.5 h-1.5 rounded-full ${
              i < filled ? 'bg-current' : 'bg-border-default'
            }`}
          />
        ))}
      </span>
      {showLabel && (
        <span className="text-xs text-text-muted">{label}</span>
      )}
    </span>
  )
}
