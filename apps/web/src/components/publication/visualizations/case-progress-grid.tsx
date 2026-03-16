import Link from 'next/link'

interface CaseFile {
  id: string
  slug: string
  title: string
  completion_percentage: number
  open_question_count: number
  status: string
}

interface CaseProgressGridProps {
  caseFiles: CaseFile[]
}

function progressColor(pct: number): string {
  if (pct >= 90) return '#1a472a' // green
  if (pct >= 60) return '#b8860b' // gold
  return '#455a64' // gray
}

function statusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'complete':
      return 'Complete'
    case 'archived':
      return 'Archived'
    default:
      return status.charAt(0).toUpperCase() + status.slice(1)
  }
}

export function CaseProgressGrid({ caseFiles }: CaseProgressGridProps) {
  if (caseFiles.length === 0) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border-default border border-border-default">
      {caseFiles.map((cf) => {
        const color = progressColor(cf.completion_percentage)

        return (
          <Link
            key={cf.id}
            href={`/case-files/${cf.slug}`}
            className="block bg-background p-5 hover:bg-elevated/50 transition-colors group"
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="font-display text-base font-bold text-text-primary leading-snug group-hover:text-accent-gold transition-colors line-clamp-2">
                {cf.title}
              </h3>
              <span className="flex-none font-sans text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 border border-border-default text-text-muted">
                {statusLabel(cf.status)}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mb-2">
              <div className="h-2 w-full bg-elevated rounded-sm overflow-hidden">
                <div
                  className="h-full rounded-sm transition-all duration-500"
                  style={{
                    width: `${cf.completion_percentage}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>

            {/* Stats row */}
            <div className="flex items-center justify-between">
              <span
                className="font-sans text-sm font-bold"
                style={{ color }}
              >
                {cf.completion_percentage}% Complete
              </span>
              {cf.open_question_count > 0 && (
                <span className="font-sans text-[11px] text-text-muted">
                  {cf.open_question_count} open question{cf.open_question_count !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
