import type { EvidenceItem, Tier } from '@efta/shared'

interface EvidenceSectionProps {
  evidence: EvidenceItem[]
}

const STRENGTH_STYLES: Record<string, string> = {
  strong: 'bg-[#c41e3a]/10 text-[#c41e3a] border-[#c41e3a]/30',
  moderate: 'bg-[#d4a017]/10 text-[#d4a017] border-[#d4a017]/30',
  weak: 'bg-[#6b7280]/10 text-[#6b7280] border-[#6b7280]/30',
}

const TYPE_STYLES: Record<string, string> = {
  financial: 'bg-[#b8860b]/10 text-[#b8860b]',
  testimony: 'bg-[#0e7490]/10 text-[#0e7490]',
  physical: 'bg-[#c41e3a]/10 text-[#c41e3a]',
  digital: 'bg-[#3b82f6]/10 text-[#3b82f6]',
  forensic: 'bg-[#6b21a8]/10 text-[#6b21a8]',
  documentary: 'bg-[#4a4540]/10 text-[#4a4540]',
  photographic: 'bg-[#0d9488]/10 text-[#0d9488]',
}

export function EvidenceSection({ evidence }: EvidenceSectionProps) {
  if (evidence.length === 0) {
    return (
      <p className="font-body text-sm text-text-muted italic">
        No evidence items cataloged yet.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {evidence.map((item) => (
        <div
          key={item.id}
          className="border border-border-default p-4 hover:border-accent-gold/40 transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-body text-sm text-text-primary leading-relaxed">
                {item.description}
              </p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {item.evidence_type && (
                  <span
                    className={`inline-flex font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 ${
                      TYPE_STYLES[item.evidence_type] ?? 'bg-elevated text-text-muted'
                    }`}
                  >
                    {item.evidence_type}
                  </span>
                )}
                {item.category && (
                  <span className="font-mono text-[10px] text-text-muted uppercase tracking-wider">
                    {item.category}
                  </span>
                )}
                {item.date && (
                  <span className="font-mono text-[10px] text-text-muted">
                    {item.date}
                  </span>
                )}
              </div>
            </div>
            {item.strength && (
              <span
                className={`shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 border ${
                  STRENGTH_STYLES[item.strength] ?? ''
                }`}
              >
                {item.strength}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
