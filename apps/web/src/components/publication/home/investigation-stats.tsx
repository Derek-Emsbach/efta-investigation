interface InvestigationStatsProps {
  stats: {
    documents: number
    pages: number
    entities: number
    connections: number
    openQuestions: number
  }
}

interface StatDisplay {
  prefix?: string
  highlight: string
  suffix?: string
  label: string
}

function buildStats(stats: InvestigationStatsProps['stats']): StatDisplay[] {
  const pagesMil = (stats.pages / 1_000_000).toFixed(1)
  return [
    { highlight: pagesMil, suffix: 'M', label: 'Pages Released' },
    { highlight: String(stats.entities), suffix: '+', label: 'Persons Cataloged' },
    { highlight: '0', suffix: '/10', label: 'DOJ Full Compliance' },
    { highlight: '12', label: 'Datasets Under Review' },
    { highlight: String(stats.documents > 1000 ? Math.round(stats.documents / 1000) + 'K' : stats.documents), label: 'Documents Analyzed' },
  ]
}

export function InvestigationStats({ stats }: InvestigationStatsProps) {
  const items = buildStats(stats)

  return (
    <div className="bg-ink text-background">
      <div className="mx-auto max-w-7xl px-6 py-5">
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
