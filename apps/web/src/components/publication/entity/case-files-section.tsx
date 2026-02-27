import Link from 'next/link'
import type { CaseFile, CaseFileEntity } from '@efta/shared'

interface CaseFileWithJunction extends CaseFileEntity {
  case_file: CaseFile
}

interface CaseFilesSectionProps {
  caseFiles: CaseFileWithJunction[]
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-[#c41e3a]/10 text-[#c41e3a] border-[#c41e3a]/30',
  complete: 'bg-[#0d9488]/10 text-[#0d9488] border-[#0d9488]/30',
  archived: 'bg-[#6b7280]/10 text-[#6b7280] border-[#6b7280]/30',
}

export function CaseFilesSection({ caseFiles }: CaseFilesSectionProps) {
  if (caseFiles.length === 0) {
    return (
      <p className="font-body text-sm text-text-muted italic">
        No published case files reference this entity yet.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {caseFiles.map((cfe) => {
        const cf = cfe.case_file
        if (!cf) return null

        return (
          <Link
            key={cfe.id}
            href={`/case-files/${cf.slug}`}
            className="block border border-border-default p-4 hover:border-accent-gold/40 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-xs font-bold text-accent-red">
                {cf.case_id}
              </span>
              <span
                className={`font-mono text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 border ${
                  STATUS_STYLES[cf.status] ?? ''
                }`}
              >
                {cf.status}
              </span>
            </div>
            <h4 className="font-display text-base font-semibold text-text-primary group-hover:text-accent-gold transition-colors">
              {cf.title}
            </h4>
            {cf.summary && (
              <p className="mt-1 font-body text-sm text-text-secondary line-clamp-2">
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
                <span className="font-mono text-[10px] text-text-muted">
                  {cf.completion_percentage}%
                </span>
              </div>
            )}
          </Link>
        )
      })}
    </div>
  )
}
