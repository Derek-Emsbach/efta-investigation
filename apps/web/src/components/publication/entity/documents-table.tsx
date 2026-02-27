import type { EntityDocument, Document } from '@efta/shared'

interface EntityDocumentWithDocument extends EntityDocument {
  document: Document
}

interface DocumentsTableProps {
  documents: EntityDocumentWithDocument[]
}

const SEVERITY_STYLES: Record<string, string> = {
  extreme_critical: 'bg-[#c41e3a]/10 text-[#c41e3a] border-[#c41e3a]/30',
  critical: 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30',
  high: 'bg-[#d4a017]/10 text-[#d4a017] border-[#d4a017]/30',
  routine: 'bg-[#6b7280]/10 text-[#6b7280] border-[#6b7280]/30',
}

const TYPE_LABELS: Record<string, string> = {
  email: 'Email',
  fbi_302: 'FBI 302',
  financial: 'Financial',
  photo: 'Photo',
  memo: 'Memo',
  prosecution_memo: 'Prosecution Memo',
  court_filing: 'Court Filing',
  victim_journal: 'Victim Journal',
  senate_letter: 'Senate Letter',
  legal_report: 'Legal Report',
  call_notes: 'Call Notes',
  blank: 'Blank',
}

export function DocumentsTable({ documents }: DocumentsTableProps) {
  if (documents.length === 0) {
    return (
      <p className="font-body text-sm text-text-muted italic">
        No linked documents.
      </p>
    )
  }

  // Sort by severity (extreme first), then date
  const sorted = [...documents].sort((a, b) => {
    const severityOrder = ['extreme_critical', 'critical', 'high', 'routine']
    const sa = severityOrder.indexOf(a.document?.severity ?? '')
    const sb = severityOrder.indexOf(b.document?.severity ?? '')
    const saDef = sa === -1 ? 99 : sa
    const sbDef = sb === -1 ? 99 : sb
    if (saDef !== sbDef) return saDef - sbDef
    const dateA = a.document?.original_date ?? ''
    const dateB = b.document?.original_date ?? ''
    return dateA.localeCompare(dateB)
  })

  return (
    <div className="border border-border-default overflow-hidden">
      {/* Header */}
      <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2 bg-elevated font-mono text-[10px] text-text-muted uppercase tracking-wider">
        <span>Document</span>
        <span className="w-24 text-center">Type</span>
        <span className="w-20 text-center">Severity</span>
        <span className="w-20 text-right">Date</span>
      </div>

      {/* Rows */}
      {sorted.map((ed) => {
        const doc = ed.document
        if (!doc) return null
        const bates = doc.bates_number
        const title = doc.title || bates || 'Untitled'
        const type = doc.document_type ? TYPE_LABELS[doc.document_type] ?? doc.document_type : null

        return (
          <div
            key={ed.id}
            className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 sm:gap-4 px-4 py-3 border-t border-border-default hover:bg-elevated/50 transition-colors"
          >
            <div className="min-w-0">
              <div className="font-body text-sm text-text-primary truncate">
                {title}
              </div>
              {bates && title !== bates && (
                <div className="font-mono text-[10px] text-accent-red mt-0.5">
                  {bates}
                </div>
              )}
              {ed.role_in_document && (
                <div className="font-mono text-[10px] text-text-muted mt-0.5 capitalize">
                  Role: {ed.role_in_document}
                </div>
              )}
            </div>
            {type && (
              <div className="w-24 flex items-center justify-center">
                <span className="font-mono text-[10px] text-text-muted uppercase">
                  {type}
                </span>
              </div>
            )}
            {doc.severity && (
              <div className="w-20 flex items-center justify-center">
                <span
                  className={`font-mono text-[10px] font-semibold uppercase px-2 py-0.5 border ${
                    SEVERITY_STYLES[doc.severity] ?? 'border-border-default text-text-muted'
                  }`}
                >
                  {doc.severity === 'extreme_critical' ? 'EXTREME' : doc.severity}
                </span>
              </div>
            )}
            <div className="w-20 flex items-center justify-end">
              <span className="font-mono text-[10px] text-text-muted">
                {doc.original_date ?? '—'}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
