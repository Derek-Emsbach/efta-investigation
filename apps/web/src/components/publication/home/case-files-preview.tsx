import Link from 'next/link'

interface CaseFilePreview {
  id: string
  slug: string
  case_id: string
  title: string
  status: string
  summary: string | null
  completion_percentage: number
}

interface CaseFilesPreviewProps {
  caseFiles: CaseFilePreview[]
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-[#c41e3a]/10 text-[#c41e3a] border-[#c41e3a]/30',
  complete: 'bg-[#0d9488]/10 text-[#0d9488] border-[#0d9488]/30',
  archived: 'bg-[#6b7280]/10 text-[#6b7280] border-[#6b7280]/30',
}

export function CaseFilesPreview({ caseFiles }: CaseFilesPreviewProps) {
  if (caseFiles.length === 0) return null

  return (
    <section className="py-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl font-bold text-text-primary">
          Investigation Reports
        </h2>
        <Link
          href="/case-files"
          className="font-mono text-xs text-text-muted hover:text-accent-red transition-colors"
        >
          View all →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {caseFiles.map((cf) => (
          <Link
            key={cf.id}
            href={`/case-files/${cf.slug}`}
            className="block border border-border-default p-5 hover:border-accent-gold/40 transition-colors group"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs font-bold text-accent-red">
                {cf.case_id}
              </span>
              <span
                className={`font-mono text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 border ${
                  STATUS_STYLES[cf.status] ?? ''
                }`}
              >
                {cf.status}
              </span>
            </div>
            <h3 className="font-display text-base font-semibold text-text-primary leading-snug group-hover:text-accent-gold transition-colors">
              {cf.title}
            </h3>
            {cf.summary && (
              <p className="mt-2 font-body text-xs text-text-secondary line-clamp-2">
                {cf.summary}
              </p>
            )}
            {cf.completion_percentage > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 h-1 bg-border-default">
                  <div
                    className="h-full bg-accent-gold"
                    style={{ width: `${cf.completion_percentage}%` }}
                  />
                </div>
                <span className="font-mono text-[9px] text-text-muted">
                  {cf.completion_percentage}%
                </span>
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  )
}
