'use client'

import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels'
import type { Annotation } from '@/components/review/pdf-viewer'
import ArcherPanel from '@/components/review/archer-panel'
import { EmptyState } from '@/components/ui/empty-state'
import { ShortcutHelpOverlay } from '@/components/review/shortcut-help-overlay'
import { useReviewShortcuts } from '@/hooks/use-review-shortcuts'
import { QueueControls } from '@/components/review/queue-controls'
import { multiColumnSort, type SortState } from '@/components/ui/data-table'
import type { ArcherDocument } from '@/lib/ai/archer-prompt'

// Dynamic import — react-pdf requires DOM APIs (DOMMatrix) unavailable during SSR
const PdfViewer = dynamic(() => import('@/components/review/pdf-viewer'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-text-muted">
      Loading PDF viewer...
    </div>
  ),
})

interface ClassifyResult {
  score?: number
  classification?: string
  severity?: string
  priority?: number
  needs_review?: boolean
  review_reasons?: string[]
  reasons?: string[]
  is_reprocess?: boolean
}

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
  classify: ClassifyResult | null
}

const DOC_TYPES = [
  'email', 'fbi_302', 'financial', 'photo', 'memo', 'prosecution_memo',
  'court_filing', 'victim_journal', 'senate_letter', 'legal_report',
  'call_notes', 'blank',
]

const SEVERITY_OPTIONS = ['extreme_critical', 'critical', 'high', 'routine']
const CLASSIFICATION_OPTIONS = ['high', 'medium', 'low']

function toArcherDocument(doc: ReviewDocument): ArcherDocument {
  return {
    id: doc.id,
    bates_number: doc.bates_number,
    title: doc.title,
    document_type: doc.document_type,
    original_date: doc.original_date,
    severity: doc.severity,
    classification: doc.classification,
    extracted_text: doc.extracted_text,
    forensic_metadata: doc.forensic_metadata,
    page_count: doc.page_count,
  }
}

// ─── Resize Handle ────────────────────────────────────────

function ResizeHandle() {
  return (
    <Separator className="group relative w-1.5 bg-transparent hover:bg-info/10 active:bg-info/20 transition-colors data-[resize-handle-active]:bg-info/20">
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-border-default group-hover:bg-info/50 group-active:bg-info transition-colors" />
    </Separator>
  )
}

// ─── Page ─────────────────────────────────────────────────

interface Toast {
  message: string
  type: 'success' | 'warning' | 'error'
}

export default function ReviewPage() {
  const [documents, setDocuments] = useState<ReviewDocument[]>([])
  const [selected, setSelected] = useState<ReviewDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Toast notification
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Queue collapse state (driven by panel callbacks)
  const [queueCollapsed, setQueueCollapsed] = useState(false)
  const queuePanelRef = usePanelRef()

  // Queue sort/filter state
  const [queueSort, setQueueSort] = useState<SortState[]>([])
  const [typeFilter, setTypeFilter] = useState<string[]>([])

  // Review form collapse state
  const [formExpanded, setFormExpanded] = useState(false)

  // PDF annotation state (driven by Archer)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [currentPage, setCurrentPage] = useState<number | undefined>(undefined)
  const [numPages, setNumPages] = useState(0)

  // Shortcut help overlay
  const [showHelp, setShowHelp] = useState(false)

  // Editable fields
  const [editTitle, setEditTitle] = useState('')
  const [editType, setEditType] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editSeverity, setEditSeverity] = useState('')
  const [editClassification, setEditClassification] = useState('')
  const [editNotes, setEditNotes] = useState('')

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ message, type })
    toastTimerRef.current = setTimeout(() => setToast(null), 3000)
  }, [])

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/review')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setDocuments(data.documents)
    } catch {
      // Silently handle
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  const selectDocument = useCallback((doc: ReviewDocument) => {
    setSelected(doc)
    setEditTitle(doc.title ?? '')
    setEditType(doc.document_type ?? '')
    setEditDate(doc.original_date ?? '')
    setEditSeverity(doc.severity ?? '')
    setEditClassification(doc.classification ?? '')
    setEditNotes(doc.review_notes ?? '')
    setAnnotations([])
    setCurrentPage(undefined)
    setFormExpanded(false)
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

      const docName = selected.bates_number ?? selected.title ?? 'Document'

      // Find the next document in the filtered queue before removing current
      const currentIndex = filteredDocs.findIndex((d) => d.id === selected.id)
      const remaining = filteredDocs.filter((d) => d.id !== selected.id)
      // Advance to next doc at same index (or last if we were at end)
      const nextDoc = remaining.length > 0
        ? remaining[Math.min(currentIndex, remaining.length - 1)]
        : null

      // Remove from queue
      setDocuments((prev) => prev.filter((d) => d.id !== selected.id))

      // Auto-advance or clear
      if (nextDoc) {
        selectDocument(nextDoc)
      } else {
        setSelected(null)
        setAnnotations([])
        setCurrentPage(undefined)
      }

      // Toast
      const labels: Record<string, string> = {
        approve: 'Approved',
        flag: 'Flagged',
        reject: 'Rejected',
      }
      const types: Record<string, Toast['type']> = {
        approve: 'success',
        flag: 'warning',
        reject: 'error',
      }
      showToast(`${labels[action]} ${docName}`, types[action])
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleAnnotationsChange = useCallback((newAnnotations: Annotation[]) => {
    setAnnotations(newAnnotations)
  }, [])

  const handleNavigate = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const handleShowHelp = useCallback(() => setShowHelp(true), [])

  // Toggle queue via panel ref (used by keyboard shortcut + button)
  const toggleQueue = useCallback(() => {
    const panel = queuePanelRef.current
    if (!panel) return
    if (panel.isCollapsed()) {
      panel.expand()
    } else {
      panel.collapse()
    }
  }, [])

  // Client-side sort + filter on the queue
  const filteredDocs = useMemo(() => {
    let result = documents
    if (typeFilter.length > 0) {
      result = result.filter((d) => d.document_type !== null && typeFilter.includes(d.document_type))
    }
    return multiColumnSort(
      result as unknown as Record<string, unknown>[],
      queueSort,
    ) as unknown as ReviewDocument[]
  }, [documents, queueSort, typeFilter])

  useReviewShortcuts({
    documents: filteredDocs,
    selected,
    selectDocument,
    currentPage,
    setCurrentPage,
    numPages,
    handleAction,
    toggleQueue,
    formExpanded,
    setFormExpanded,
    saving,
    onShowHelp: handleShowHelp,
  })

  return (
    <>
      <div className="h-screen">
      <Group orientation="horizontal">
        {/* ─── Column 1: Queue ─────────────────────────── */}
        <Panel
          panelRef={queuePanelRef}
          defaultSize="18"
          minSize="3"
          maxSize="30"
          collapsible
          collapsedSize="3"
          onResize={(size) => setQueueCollapsed(size.asPercentage <= 3)}
        >
          <div className="flex h-full flex-col border-r border-border-default bg-surface">
            {/* Queue header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-default shrink-0">
              {!queueCollapsed && (
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Queue ({filteredDocs.length}{typeFilter.length > 0 ? `/${documents.length}` : ''})
                </p>
              )}
              <button
                onClick={toggleQueue}
                className="rounded p-1 text-text-muted hover:bg-elevated hover:text-text-secondary transition-colors"
                aria-label={queueCollapsed ? 'Expand queue' : 'Collapse queue'}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {queueCollapsed ? (
                    <polyline points="9 18 15 12 9 6" />
                  ) : (
                    <polyline points="15 18 9 12 15 6" />
                  )}
                </svg>
              </button>
            </div>

            {/* Queue controls — sort + filter */}
            {!queueCollapsed && documents.length > 0 && (
              <QueueControls
                sortStack={queueSort}
                onSortChange={setQueueSort}
                typeFilter={typeFilter}
                onTypeFilterChange={setTypeFilter}
              />
            )}

            {/* Queue list */}
            {!queueCollapsed && (
              <div className="flex-1 overflow-y-auto">
                {loading && (
                  <div className="p-4 text-sm text-text-muted">Loading...</div>
                )}
                {!loading && documents.length === 0 && (
                  <EmptyState
                    label="QUEUE EMPTY"
                    title="No documents to review"
                    description="Processed documents will appear here for review."
                    action={{ label: 'Processing queue', href: '/dashboard/processing' }}
                    className="py-10"
                  />
                )}
                {!loading && documents.length > 0 && filteredDocs.length === 0 && (
                  <div className="p-4 text-center">
                    <p className="text-xs text-text-muted">No documents match the current filter.</p>
                    <button
                      onClick={() => setTypeFilter([])}
                      className="text-xs text-info hover:underline mt-1"
                    >
                      Clear filter
                    </button>
                  </div>
                )}
                {filteredDocs.map((doc) => {
                  const score = doc.classify?.score ?? null
                  const sevColor =
                    doc.severity === 'extreme_critical' ? 'bg-critical' :
                    doc.severity === 'critical' ? 'bg-critical/70' :
                    doc.severity === 'high' ? 'bg-warning' :
                    'bg-text-muted/30'

                  return (
                    <button
                      key={doc.id}
                      onClick={() => selectDocument(doc)}
                      className={`w-full text-left px-3 py-3 border-b border-border-default transition-colors ${
                        selected?.id === doc.id
                          ? 'bg-info/5 border-l-2 border-l-info'
                          : 'hover:bg-elevated/50 border-l-2 border-l-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-text-primary font-medium truncate flex-1">
                          {doc.bates_number ?? doc.title ?? doc.id.slice(0, 8)}
                        </p>
                        {score !== null && (
                          <span className={`shrink-0 text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded ${
                            score >= 70 ? 'bg-critical/10 text-critical' :
                            score >= 40 ? 'bg-warning/10 text-warning' :
                            'bg-elevated text-text-muted'
                          }`}>
                            {score}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${sevColor}`} />
                        {doc.severity && (
                          <span className="text-[10px] text-text-muted capitalize">
                            {doc.severity.replace(/_/g, ' ')}
                          </span>
                        )}
                        {doc.document_type && (
                          <span className="text-[10px] text-text-muted capitalize">
                            · {doc.document_type.replace(/_/g, ' ')}
                          </span>
                        )}
                        {doc.page_count && (
                          <span className="text-[10px] text-text-muted">{doc.page_count}p</span>
                        )}
                        {doc.classify?.is_reprocess && (
                          <span className="text-[10px] text-info">re-proc</span>
                        )}
                      </div>
                      {doc.classify?.review_reasons && doc.classify.review_reasons.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {doc.classify.review_reasons.map((reason) => (
                            <span
                              key={reason}
                              className="text-[9px] bg-warning/8 text-warning/80 px-1 py-0.5 rounded"
                            >
                              {reason}
                            </span>
                          ))}
                        </div>
                      )}
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
                  )
                })}
              </div>
            )}

            {/* Collapsed: vertical "QUEUE" label */}
            {queueCollapsed && (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-[10px] font-medium text-text-muted uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">
                  Queue ({filteredDocs.length})
                </span>
              </div>
            )}
          </div>
        </Panel>

        <ResizeHandle />

        {/* ─── Column 2: PDF Viewer + Review Form Bar ── */}
        <Panel defaultSize="52" minSize="30">
          <div className="flex h-full flex-col min-w-0">
            {!selected ? (
              /* Empty state */
              <div className="flex-1 flex items-center justify-center bg-surface">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 text-text-muted/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  <p className="text-text-muted text-sm">Select a document from the queue</p>
                </div>
              </div>
            ) : (
              <>
                {/* Document header bar */}
                <div className="flex items-center justify-between px-4 py-2 bg-elevated border-b border-border-default shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate">
                      {selected.bates_number ?? selected.title ?? 'Untitled'}
                    </p>
                    {selected.document_type && (
                      <span className="text-[10px] bg-elevated rounded px-1.5 py-0.5 text-text-muted capitalize shrink-0">
                        {selected.document_type.replace(/_/g, ' ')}
                      </span>
                    )}
                    {selected.classify?.score != null && (
                      <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded shrink-0 ${
                        selected.classify.score >= 70 ? 'bg-critical/10 text-critical' :
                        selected.classify.score >= 40 ? 'bg-warning/10 text-warning' :
                        'bg-surface text-text-muted'
                      }`}>
                        Score {selected.classify.score}
                      </span>
                    )}
                    {selected.classify?.is_reprocess && (
                      <span className="text-[10px] bg-info/10 text-info px-1.5 py-0.5 rounded shrink-0">
                        Re-processed
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/dashboard/documents/${selected.id}`}
                    className="text-xs text-info hover:text-info/80 shrink-0"
                  >
                    Open detail
                  </Link>
                </div>

                {/* Score breakdown — shown when classify data exists */}
                {selected.classify?.reasons && selected.classify.reasons.length > 0 && (
                  <div className="px-4 py-2 bg-surface border-b border-border-default shrink-0">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      {selected.classify.reasons.map((reason, i) => {
                        const isPositive = reason.startsWith('+')
                        return (
                          <span
                            key={i}
                            className={`text-[10px] font-mono ${isPositive ? 'text-success' : 'text-text-muted'}`}
                          >
                            {reason}
                          </span>
                        )
                      })}
                    </div>
                    {selected.classify.review_reasons && selected.classify.review_reasons.length > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-text-muted">Review triggers:</span>
                        {selected.classify.review_reasons.map((reason) => (
                          <span
                            key={reason}
                            className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* PDF Viewer — fills available height */}
                <div className="flex-1 min-h-0">
                  <PdfViewer
                    fileUrl={`/api/documents/${selected.id}/file`}
                    annotations={annotations}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                    onNumPagesChange={setNumPages}
                    forensicMetadata={selected.forensic_metadata}
                  />
                </div>

                {/* Review form bar — collapsible */}
                <div className="border-t border-border-default bg-surface shrink-0">
                  {/* Collapsed bar: action buttons + form toggle */}
                  <div className="flex items-center justify-between px-4 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setFormExpanded(!formExpanded)}
                        className="rounded p-1 text-text-muted hover:bg-elevated hover:text-text-secondary transition-colors"
                        aria-label={formExpanded ? 'Collapse form' : 'Expand form'}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          {formExpanded ? (
                            <polyline points="18 15 12 9 6 15" />
                          ) : (
                            <polyline points="6 9 12 15 18 9" />
                          )}
                        </svg>
                      </button>

                      {/* Quick metadata display */}
                      {editSeverity && (
                        <span className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${
                          editSeverity === 'extreme_critical' ? 'bg-critical/10 text-critical' :
                          editSeverity === 'critical' ? 'bg-critical/10 text-critical' :
                          editSeverity === 'high' ? 'bg-warning/10 text-warning' :
                          'bg-elevated text-text-muted'
                        }`}>
                          {editSeverity.replace(/_/g, ' ')}
                        </span>
                      )}
                      <span className="text-[10px] text-text-muted">
                        {selected.page_count && `${selected.page_count}p`}
                        {selected.file_size_bytes && ` · ${formatBytes(selected.file_size_bytes)}`}
                      </span>
                    </div>

                    {/* Action buttons — always visible */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAction('approve')}
                        disabled={saving}
                        className="bg-success hover:bg-success/90 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {saving ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleAction('flag', 'needs_attention')}
                        disabled={saving}
                        className="bg-warning/10 hover:bg-warning/20 text-warning text-xs font-medium px-3 py-1.5 rounded-lg border border-warning/30 transition-colors"
                      >
                        Flag
                      </button>
                      <button
                        onClick={() => handleAction('reject')}
                        disabled={saving}
                        className="bg-critical/10 hover:bg-critical/20 text-critical text-xs font-medium px-3 py-1.5 rounded-lg border border-critical/30 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  </div>

                  {/* Expanded form */}
                  {formExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-border-default space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[10px] text-text-muted mb-1">Title</label>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full bg-elevated border border-border-default rounded px-2 py-1 text-xs text-text-primary focus:border-info focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-text-muted mb-1">Type</label>
                          <select
                            value={editType}
                            onChange={(e) => setEditType(e.target.value)}
                            className="w-full bg-elevated border border-border-default rounded px-2 py-1 text-xs text-text-primary focus:border-info focus:outline-none"
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
                          <label className="block text-[10px] text-text-muted mb-1">Date</label>
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="w-full bg-elevated border border-border-default rounded px-2 py-1 text-xs text-text-primary focus:border-info focus:outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-text-muted mb-1">Severity</label>
                            <select
                              value={editSeverity}
                              onChange={(e) => setEditSeverity(e.target.value)}
                              className="w-full bg-elevated border border-border-default rounded px-2 py-1 text-xs text-text-primary focus:border-info focus:outline-none"
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
                            <label className="block text-[10px] text-text-muted mb-1">Class.</label>
                            <select
                              value={editClassification}
                              onChange={(e) => setEditClassification(e.target.value)}
                              className="w-full bg-elevated border border-border-default rounded px-2 py-1 text-xs text-text-primary focus:border-info focus:outline-none"
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
                      <div>
                        <label className="block text-[10px] text-text-muted mb-1">Review Notes</label>
                        <textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Add notes..."
                          className="w-full h-14 bg-elevated border border-border-default rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted resize-none focus:border-info focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </Panel>

        <ResizeHandle />

        {/* ─── Column 3: Archer ────────────────────────── */}
        <Panel defaultSize="30" minSize="15" maxSize="45">
          <div className="flex h-full border-l border-border-default bg-surface">
            <ArcherPanel
              document={selected ? toArcherDocument(selected) : null}
              onAnnotationsChange={handleAnnotationsChange}
              onNavigate={handleNavigate}
            />
          </div>
        </Panel>
      </Group>
      </div>

      {/* Floating shortcut help button */}
      <button
        onClick={() => setShowHelp(true)}
        className="fixed bottom-4 right-4 z-40 w-8 h-8 rounded-full bg-elevated border border-border-default text-text-muted hover:text-text-secondary hover:bg-surface transition-colors flex items-center justify-center shadow-lg"
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
      >
        <span className="font-mono text-xs font-bold">?</span>
      </button>

      <ShortcutHelpOverlay open={showHelp} onClose={() => setShowHelp(false)} />

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg border text-sm font-medium ${
            toast.type === 'success' ? 'bg-success/10 border-success/30 text-success' :
            toast.type === 'warning' ? 'bg-warning/10 border-warning/30 text-warning' :
            'bg-critical/10 border-critical/30 text-critical'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              toast.type === 'success' ? 'bg-success' :
              toast.type === 'warning' ? 'bg-warning' :
              'bg-critical'
            }`} />
            {toast.message}
          </div>
        </div>
      )}
    </>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
