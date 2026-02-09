import { SEVERITY_CONFIG } from '@efta/shared'
import type { Document } from '@efta/shared'
import { SeverityMarker } from './severity-marker'

interface DocumentCardProps {
  document: Document
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Date unknown'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDocumentType(type: string | null): string {
  if (!type) return 'UNKNOWN'
  return type.replace(/_/g, ' ').toUpperCase()
}

export function DocumentCard({ document: doc }: DocumentCardProps) {
  const severityColor = doc.severity
    ? SEVERITY_CONFIG[doc.severity].color
    : '#374151'

  return (
    <div
      className="group bg-surface border border-border-default rounded-lg overflow-hidden hover:border-border-light transition-colors"
      style={{ borderLeftWidth: '4px', borderLeftColor: severityColor }}
    >
      <div className="p-4">
        {/* Top row: severity + document type */}
        <div className="flex items-center justify-between gap-3 mb-2">
          {doc.severity && <SeverityMarker severity={doc.severity} />}
          {doc.document_type && (
            <span className="text-xs uppercase tracking-wider bg-elevated text-text-secondary px-2 py-0.5 rounded shrink-0">
              {formatDocumentType(doc.document_type)}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-sm font-medium text-text-primary truncate mb-1">
          {doc.title || 'Untitled Document'}
        </h3>

        {/* Bates number */}
        {doc.bates_number && (
          <p className="font-mono text-xs text-text-muted mb-3">
            {doc.bates_number}
          </p>
        )}

        {/* Bottom row: date + page count */}
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>{formatDate(doc.original_date)}</span>
          {doc.page_count !== null && (
            <span>
              {doc.page_count} {doc.page_count === 1 ? 'page' : 'pages'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
