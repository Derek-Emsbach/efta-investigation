interface FinancialSummaryCardProps {
  financialSummary: Record<string, unknown>
}

export function FinancialSummaryCard({ financialSummary }: FinancialSummaryCardProps) {
  const entries = Object.entries(financialSummary).filter(
    ([, v]) => v != null && v !== '' && v !== 0
  )

  if (entries.length === 0) return null

  return (
    <div className="border border-border-default overflow-hidden">
      {/* Header */}
      <div className="bg-[#1a1a1a] px-5 py-3">
        <span className="font-mono text-xs font-bold text-white uppercase tracking-[0.2em]">
          Financial Summary
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 bg-surface">
        {entries.map(([key, value]) => (
          <div
            key={key}
            className="px-5 py-3 border-b border-r border-border-default last:border-b-0"
          >
            <dt className="font-mono text-[10px] text-text-muted uppercase tracking-wider">
              {formatKey(key)}
            </dt>
            <dd className="mt-0.5 font-mono text-sm font-semibold text-text-primary">
              {formatValue(value)}
            </dd>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatValue(value: unknown): string {
  if (typeof value === 'number') {
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(1)}M`
    }
    if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(0)}K`
    }
    return `$${value.toLocaleString()}`
  }
  return String(value)
}
