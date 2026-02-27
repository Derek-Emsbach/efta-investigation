interface InvestigationStatsProps {
  stats: {
    documents: number
    pages: number
    entities: number
    connections: number
    openQuestions: number
  }
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString()
}

export function InvestigationStats({ stats }: InvestigationStatsProps) {
  return (
    <div className="bg-[#1a1a1a] text-white">
      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 text-center">
          <StatItem value={formatNumber(stats.documents)} label="Documents Analyzed" />
          <StatItem value={formatNumber(stats.pages)} label="Pages Reviewed" />
          <StatItem value={String(stats.entities)} label="Entities Identified" />
          <StatItem value={formatNumber(stats.connections)} label="Connections Mapped" />
          <StatItem value={String(stats.openQuestions)} label="Open Questions" />
        </div>
      </div>
    </div>
  )
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-mono text-2xl font-bold text-white">{value}</div>
      <div className="font-mono text-[9px] uppercase tracking-wider text-gray-400 mt-1">
        {label}
      </div>
    </div>
  )
}
