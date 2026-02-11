'use client'

import { useCallback, useEffect, useState } from 'react'
import MainContent from '@/components/layout/main-content'
import { PageHeader } from '@/components/ui/page-header'
import Link from 'next/link'

interface ReviewDocument {
  id: string
  bates_number: string | null
  title: string | null
  document_type: string | null
  original_date: string | null
  page_count: number | null
  file_size_bytes: number | null
  severity: string | null
  classification: string | null
  processing_status: string
  forensic_metadata: Record<string, unknown> | null
  extracted_text: string | null
  flags: string[] | null
  review_notes: string | null
  dataset_id: string | null
}

const DOC_TYPES = [
  'email', 'fbi_302', 'financial', 'photo', 'memo', 'prosecution_memo',
  'court_filing', 'victim_journal', 'senate_letter', 'legal_report',
  'call_notes', 'blank',
]

const SEVERITY_OPTIONS = ['extreme_critical', 'critical', 'high', 'routine']
const CLASSIFICATION_OPTIONS = ['high', 'medium', 'low']

export default function ReviewPage() {
  const [documents, setDocuments] = useState<ReviewDocument[]>([])
  const [selected, setSelected] = useState<ReviewDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForensics, setShowForensics] = useState(false)

  // Editable fields
  const [editTitle, setEditTitle] = useState('')
  const [editType, setEditType] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editSeverity, setEditSeverity] = useState('')
  const [editClassification, setEditClassification] = useState('')
  const [editNotes, setEditNotes] = useState('')

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/review')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setDocuments(data.documents)
    } catch {
      // Silently handle — user will see empty state
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  // Populate edit fields when selecting a document
  const selectDocument = useCallback((doc: ReviewDocument) => {
    setSelected(doc)
    setEditTitle(doc.title ?? '')
    setEditType(doc.document_type ?? '')
    setEditDate(doc.original_date ?? '')
    setEditSeverity(doc.severity ?? '')
    setEditClassification(doc.classification ?? '')
    setEditNotes(doc.review_notes ?? '')
    setShowForensics(false)
  }, [])

  const handleAction = async (action: 'approve' | 'flag' | 'reject', flag?: string) => {
    if (!selected) return
    setSaving(true)

    try {
      const res = await fetch('/api/review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: selected.id,
          action,
          fields: {
            title: editTitle || undefined,
            document_type: editType || undefined,
            original_date: editDate || undefined,
            severity: editSeverity || undefined,
            classification: editClassification || undefined,
            review_notes: editNotes || undefined,
            flag: flag || undefined,
          },
        }),
      })

      if (!res.ok) throw new Error('Action failed')

      // Remove from queue and clear selection
      setDocuments((prev) => prev.filter((d) => d.id !== selected.id))
      setSelected(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <MainContent>
      <PageHeader
        title="Review Queue"
        subtitle={`${documents.length} document${documents.length !== 1 ? 's' : ''} awaiting review`}
      />

      <div className="flex gap-4" style={{ height: 'calc(100vh - 200px)' }}>
        {/* Left panel: Document queue */}
        <div className="w-72 shrink-0 border border-border-default rounded-lg overflow-hidden flex flex-col bg-surface">
          <div className="p-3 border-b border-border-default bg-elevated">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Queue ({documents.length})
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="p-4 text-sm text-text-muted">Loading...</div>
            )}
            {!loading && documents.length === 0 && (
              <div className="p-4 text-center">
                <p className="text-sm text-text-muted mb-2">No documents to review</p>
                <Link
                  href="/processing"
                  className="text-xs text-info hover:text-info/80 underline"
                >
                  View processing queue
                </Link>
              </div>
            )}
            {documents.map((doc) => (
              <button
                key={doc.id}
                onClick={() => selectDocument(doc)}
                className={`w-full text-left px-3 py-3 border-b border-border-default transition-colors ${
                  selected?.id === doc.id
                    ? 'bg-info/5 border-l-2 border-l-info'
                    : 'hover:bg-elevated/50 border-l-2 border-l-transparent'
                }`}
              >
                <p className="text-sm text-text-primary font-medium truncate">
                  {doc.bates_number ?? doc.title ?? doc.id.slice(0, 8)}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {doc.document_type && (
                    <span className="text-xs text-text-muted capitalize">
                      {doc.document_type.replace(/_/g, ' ')}
                    </span>
                  )}
                  {doc.page_count && (
                    <span className="text-xs text-text-muted">{doc.page_count}p</span>
                  )}
                </div>
                {doc.flags && doc.flags.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {doc.flags.map((flag) => (
                      <span
                        key={flag}
                        className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded"
                      >
                        {flag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Right panel: Review detail */}
        {!selected ? (
          <div className="flex-1 flex items-center justify-center border border-border-default rounded-lg bg-surface">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <p className="text-text-muted text-sm">Select a document from the queue to review</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            {/* Top: PDF Viewer */}
            <div className="flex-1 border border-border-default rounded-lg overflow-hidden bg-surface min-h-0">
              <div className="flex items-center justify-between px-3 py-2 bg-elevated border-b border-border-default">
                <p className="text-xs font-medium text-text-muted">
                  Document Viewer — {selected.bates_number ?? selected.title}
                </p>
                <Link
                  href={`/documents/${selected.id}`}
                  className="text-xs text-info hover:text-info/80"
                >
                  Open detail
                </Link>
              </div>
              <object
                data={`/api/documents/${selected.id}/file`}
                type="application/pdf"
                className="w-full h-full"
              >
                <div className="flex items-center justify-center h-full text-text-muted text-sm">
                  <p>PDF preview not available.{' '}
                    <a
                      href={`/api/documents/${selected.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-info underline"
                    >
                      Open in new tab
                    </a>
                  </p>
                </div>
              </object>
            </div>

            {/* Bottom: Extracted data + actions */}
            <div className="h-[380px] shrink-0 border border-border-default rounded-lg overflow-y-auto bg-surface">
              <div className="p-4">
                {/* Editable fields */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Title</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-elevated border border-border-default rounded px-2.5 py-1.5 text-sm text-text-primary focus:border-info focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Document Type</label>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                      className="w-full bg-elevated border border-border-default rounded px-2.5 py-1.5 text-sm text-text-primary focus:border-info focus:outline-none"
                    >
                      <option value="">Unknown</option>
                      {DOC_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Original Date</label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full bg-elevated border border-border-default rounded px-2.5 py-1.5 text-sm text-text-primary focus:border-info focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Severity</label>
                      <select
                        value={editSeverity}
                        onChange={(e) => setEditSeverity(e.target.value)}
                        className="w-full bg-elevated border border-border-default rounded px-2.5 py-1.5 text-sm text-text-primary focus:border-info focus:outline-none"
                      >
                        <option value="">—</option>
                        {SEVERITY_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Classification</label>
                      <select
                        value={editClassification}
                        onChange={(e) => setEditClassification(e.target.value)}
                        className="w-full bg-elevated border border-border-default rounded px-2.5 py-1.5 text-sm text-text-primary focus:border-info focus:outline-none"
                      >
                        <option value="">—</option>
                        {CLASSIFICATION_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Extracted text preview */}
                <div className="mb-3">
                  <label className="block text-xs text-text-muted mb-1">
                    Extracted Text ({selected.extracted_text?.length ?? 0} chars)
                  </label>
                  <textarea
                    readOnly
                    value={selected.extracted_text ?? 'No text extracted'}
                    className="w-full h-28 bg-elevated border border-border-default rounded px-2.5 py-2 text-xs text-text-secondary font-mono resize-none focus:outline-none"
                  />
                </div>

                {/* Forensic metadata toggle */}
                <div className="mb-3">
                  <button
                    onClick={() => setShowForensics(!showForensics)}
                    className="text-xs text-info hover:text-info/80 transition-colors"
                  >
                    {showForensics ? 'Hide' : 'Show'} forensic metadata
                  </button>
                  {showForensics && selected.forensic_metadata && (
                    <pre className="mt-2 p-3 bg-elevated border border-border-default rounded text-[11px] text-text-secondary font-mono overflow-x-auto max-h-40">
                      {JSON.stringify(selected.forensic_metadata, null, 2)}
                    </pre>
                  )}
                </div>

                {/* Review notes */}
                <div className="mb-4">
                  <label className="block text-xs text-text-muted mb-1">Review Notes</label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Add notes about this document..."
                    className="w-full h-16 bg-elevated border border-border-default rounded px-2.5 py-2 text-sm text-text-primary placeholder:text-text-muted resize-none focus:border-info focus:outline-none"
                  />
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-3 pt-3 border-t border-border-default">
                  <button
                    onClick={() => handleAction('approve')}
                    disabled={saving}
                    className="bg-success hover:bg-success/90 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    {saving ? 'Saving...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleAction('flag', 'needs_attention')}
                    disabled={saving}
                    className="bg-warning/10 hover:bg-warning/20 text-warning text-sm font-medium px-4 py-2 rounded-lg border border-warning/30 transition-colors"
                  >
                    Flag
                  </button>
                  <button
                    onClick={() => handleAction('reject')}
                    disabled={saving}
                    className="bg-critical/10 hover:bg-critical/20 text-critical text-sm font-medium px-4 py-2 rounded-lg border border-critical/30 transition-colors"
                  >
                    Reject
                  </button>
                  <span className="text-xs text-text-muted ml-auto">
                    {selected.page_count && `${selected.page_count} pages`}
                    {selected.file_size_bytes && ` · ${formatBytes(selected.file_size_bytes)}`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainContent>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
