import type { CaseFile } from '@efta/shared'

interface CaseFileCoverProps {
  caseFile: CaseFile
}

const STATUS_STYLES: Record<string, string> = {
  active: 'border-[#e65100] text-[#e65100] bg-[rgba(230,81,0,0.06)]',
  complete: 'border-[#2e7d32] text-[#2e7d32] bg-[rgba(46,125,50,0.06)]',
  archived: 'border-[#6b7280] text-[#6b7280] bg-[rgba(107,114,128,0.06)]',
}

export function CaseFileCover({ caseFile }: CaseFileCoverProps) {
  return (
    <div
      data-theme="manila"
      className="relative overflow-hidden border border-border-default bg-background px-8 py-10 sm:px-14 sm:py-12 animate-fade-in-up"
    >
      {/* Watermark stamp */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none animate-stamp-in"
        aria-hidden="true"
      >
        <span
          className="font-mono text-[72px] font-bold uppercase tracking-wider select-none"
          style={{
            color: 'transparent',
            WebkitTextStroke: '1px rgba(196,30,58,0.06)',
            transform: 'rotate(-6deg)',
            opacity: 0.08,
          }}
        >
          Investigation Report
        </span>
      </div>

      {/* Classification + Status */}
      <div className="relative z-10 flex items-center gap-3 flex-wrap">
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 bg-accent-red text-white">
          {caseFile.classification}
        </span>
        <span
          className={`font-mono text-[10px] font-semibold uppercase tracking-[0.1em] px-2 py-0.5 border-2 ${
            STATUS_STYLES[caseFile.status] ?? ''
          }`}
        >
          {caseFile.status}
        </span>
      </div>

      {/* Case ID */}
      <div className="relative z-10 mt-4">
        <span className="font-mono text-xs font-semibold text-accent-red tracking-wider">
          {caseFile.case_id}
        </span>
      </div>

      {/* Title */}
      <h1
        className="relative z-10 mt-3 font-display font-[800] text-text-primary leading-[1.1] tracking-[-0.02em]"
        style={{ fontSize: 'clamp(28px, 4vw, 42px)' }}
      >
        {caseFile.title}
      </h1>

      {/* Summary */}
      {caseFile.summary && (
        <p className="relative z-10 mt-4 font-body text-lg text-text-secondary leading-relaxed max-w-2xl">
          {caseFile.summary}
        </p>
      )}

      {/* Metadata grid */}
      <div className="relative z-10 mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-border-default">
        {caseFile.dataset_id && (
          <MetaCell label="Dataset" value="Dataset 12 of 12" />
        )}
        <MetaCell
          label="Documents Reviewed"
          value={String(caseFile.docs_reviewed)}
          highlight={caseFile.docs_reviewed > 100}
        />
        <MetaCell
          label="Completion"
          value={`${caseFile.completion_percentage}%`}
          highlight={caseFile.completion_percentage >= 90}
        />
        {caseFile.date_range_start && caseFile.date_range_end && (
          <MetaCell
            label="Date Range"
            value={`${caseFile.date_range_start} — ${caseFile.date_range_end}`}
          />
        )}
      </div>
    </div>
  )
}

function MetaCell({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="px-4 py-3 border-r border-b border-border-default last:border-r-0">
      <dt className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-text-muted">
        {label}
      </dt>
      <dd
        className={`mt-0.5 font-body text-sm font-semibold ${
          highlight ? 'text-accent-red' : 'text-text-primary'
        }`}
      >
        {value}
      </dd>
    </div>
  )
}
