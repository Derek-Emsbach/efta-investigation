interface InvestigationStatsProps {
  stats: {
    documents: number
    entities: number
    openQuestions: number
    stories: number
  }
}

interface StatDisplay {
  prefix?: string
  highlight: string
  suffix?: string
  label: string
}

function buildStats(stats: InvestigationStatsProps['stats']): StatDisplay[] {
  const docDisplay = stats.documents > 1_000_000
    ? (stats.documents / 1_000_000).toFixed(1) + 'M'
    : stats.documents > 1000
      ? Math.round(stats.documents / 1000) + 'K'
      : String(stats.documents)

  return [
    { highlight: docDisplay, suffix: '+', label: 'Documents Released' },
    { highlight: String(stats.entities), label: 'Entities Profiled' },
    { highlight: '0', label: 'Officials Held Accountable' },
    { highlight: String(stats.openQuestions), label: 'Open Questions' },
    { highlight: String(stats.stories), label: 'Stories Published' },
  ]
}

export function InvestigationStats({ stats }: InvestigationStatsProps) {
  const items = buildStats(stats)

  return (
    <div className="bg-ink text-background">
      <div className="mx-auto max-w-7xl xl:max-w-newspaper px-6 py-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((item, i) => (
            <div
              key={item.label}
              className={`text-center py-2 px-4 ${
                i < items.length - 1 ? 'lg:border-r lg:border-white/10' : ''
              }`}
            >
              <div className="font-display text-[32px] font-bold leading-none mb-1">
                {item.prefix && <span>{item.prefix}</span>}
                <span className="text-accent-red">{item.highlight}</span>
                {item.suffix && <span>{item.suffix}</span>}
              </div>
              <div className="font-sans text-[10px] tracking-[0.12em] uppercase opacity-60">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
