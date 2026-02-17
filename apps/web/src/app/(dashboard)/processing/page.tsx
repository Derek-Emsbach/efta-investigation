'use client'

import { useCallback, useEffect, useState } from 'react'
import MainContent from '@/components/layout/main-content'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'
import Link from 'next/link'

const PAGE_SIZE = 50

interface QueueDocument {
  id: string
  bates_number: string | null
  title: string | null
  file_size_bytes: number | null
  processing_status: string
  dataset_id: string | null
}

interface QueueItem {
  id: string
  document_id: string
  status: string
  priority: number
  current_step: string | null
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  results: Record<string, unknown> | null
  created_at: string
  documents: QueueDocument | null
}

interface QueueStats {
  queued: number
  processing: number
  completed: number
  failed: number
  needs_review: number
  total: number
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  queued: { bg: 'bg-text-muted/10', text: 'text-text-muted', label: 'Queued' },
  processing: { bg: 'bg-info/10', text: 'text-info', label: 'Processing' },
  completed: { bg: 'bg-success/10', text: 'text-success', label: 'Completed' },
  failed: { bg: 'bg-critical/10', text: 'text-critical', label: 'Failed' },
  needs_review: { bg: 'bg-warning/10', text: 'text-warning', label: 'Needs Review' },
}

const POLL_INTERVAL = 5000

export default function ProcessingPage() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [stats, setStats] = useState<QueueStats | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const fetchQueue = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      params.set('page', String(page))
      params.set('limit', String(PAGE_SIZE))
      const res = await fetch(`/api/processing?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setItems(data.items)
      setStats(data.stats)
      setTotalCount(data.totalCount ?? data.items.length)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, page])

  // Initial fetch + polling
  useEffect(() => {
    fetchQueue()
    const interval = setInterval(fetchQueue, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchQueue])

  // Clear selection when filter/page changes
  useEffect(() => {
    setSelected(new Set())
  }, [statusFilter, page])

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const handleStatusFilter = useCallback((status: string) => {
    setStatusFilter(status)
    setPage(1)
  }, [])

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === items.length) return new Set()
      return new Set(items.map((i) => i.id))
    })
  }, [items])

  const retryItems = useCallback(async (ids?: string[]) => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/processing/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids ? { ids } : {}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to retry')
      setToast({ message: data.message, type: 'success' })
      setSelected(new Set())
      await fetchQueue()
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Retry failed', type: 'error' })
    } finally {
      setActionLoading(false)
    }
  }, [fetchQueue])

  const clearCompleted = useCallback(async (ids?: string[]) => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/processing/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids ? { ids } : {}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to clear')
      setToast({ message: data.message, type: 'success' })
      setSelected(new Set())
      await fetchQueue()
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Clear failed', type: 'error' })
    } finally {
      setActionLoading(false)
    }
  }, [fetchQueue])

  const formatTime = (ts: string | null) => {
    if (!ts) return '—'
    return new Date(ts).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const selectedFailed = items.filter((i) => selected.has(i.id) && i.status === 'failed')
  const selectedCompleted = items.filter((i) => selected.has(i.id) && i.status === 'completed')

  return (
    <MainContent>
      <PageHeader
        title="Processing Queue"
        subtitle="Document ingestion pipeline status"
      />

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <StatCard label="Queued" value={stats.queued} accent="#6B7280" />
          <StatCard label="Processing" value={stats.processing} accent="#3B82F6" />
          <StatCard label="Completed" value={stats.completed} accent="#10B981" />
          <StatCard label="Failed" value={stats.failed} accent="#DC2626" />
          <Link href="/review" className="block">
            <StatCard label="Needs Review" value={stats.needs_review} accent="#F59E0B" />
          </Link>
        </div>
      )}

      {/* Review banner */}
      {stats && stats.needs_review > 0 && (
        <Link
          href="/review"
          className="flex items-center justify-between mb-4 px-4 py-3 rounded-lg bg-warning/5 border border-warning/20 hover:bg-warning/10 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span className="text-sm font-medium text-text-primary">
              {stats.needs_review} document{stats.needs_review !== 1 ? 's' : ''} ready for review
            </span>
          </div>
          <span className="text-xs text-warning group-hover:underline">
            Open review queue →
          </span>
        </Link>
      )}

      {/* Filter bar + bulk actions */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs text-text-muted">Filter:</span>
        {['all', 'queued', 'processing', 'completed', 'failed'].map((s) => (
          <button
            key={s}
            onClick={() => handleStatusFilter(s)}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
              statusFilter === s
                ? 'bg-info/10 text-info border border-info/30'
                : 'bg-elevated text-text-muted hover:text-text-secondary border border-border-default'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_STYLES[s]?.label ?? s}
          </button>
        ))}

        {/* Bulk action buttons — right side */}
        <div className="ml-auto flex items-center gap-2">
          {/* Retry All Failed — visible when filtering by failed or when failed items are selected */}
          {(statusFilter === 'failed' || selectedFailed.length > 0) && stats && stats.failed > 0 && (
            <button
              onClick={() => {
                if (selectedFailed.length > 0) {
                  retryItems(selectedFailed.map((i) => i.id))
                } else {
                  retryItems()
                }
              }}
              disabled={actionLoading}
              className="text-xs px-3 py-1.5 rounded-lg bg-critical/10 text-critical hover:bg-critical/20 border border-critical/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {selectedFailed.length > 0
                ? `Retry ${selectedFailed.length} selected`
                : `Retry all failed (${stats.failed})`}
            </button>
          )}

          {/* Clear Completed — visible when filtering by completed or when completed items are selected */}
          {(statusFilter === 'completed' || selectedCompleted.length > 0) && stats && stats.completed > 0 && (
            <button
              onClick={() => {
                if (selectedCompleted.length > 0) {
                  clearCompleted(selectedCompleted.map((i) => i.id))
                } else {
                  clearCompleted()
                }
              }}
              disabled={actionLoading}
              className="text-xs px-3 py-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20 border border-success/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {selectedCompleted.length > 0
                ? `Clear ${selectedCompleted.length} selected`
                : `Clear completed (${stats.completed})`}
            </button>
          )}

          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Auto-refreshing
          </div>
        </div>
      </div>

      {/* Selection indicator */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-info/5 border border-info/20 rounded-lg text-xs text-info">
          <span className="font-medium">{selected.size} item{selected.size > 1 ? 's' : ''} selected</span>
          <button
            onClick={() => setSelected(new Set())}
            className="hover:underline"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in slide-in-from-bottom-4 ${
            toast.type === 'success'
              ? 'bg-success/10 text-success border border-success/30'
              : 'bg-critical/10 text-critical border border-critical/30'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-critical/10 border border-critical/30 rounded-lg p-4 mb-4 text-sm text-critical">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-surface border border-border-default rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <EmptyState
          icon={
            <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          label="ALL CLEAR"
          title="No documents in the queue"
          description="The processing pipeline is empty. Upload documents to begin automated analysis."
          action={{ label: 'Upload documents', href: '/upload' }}
        />
      )}

      {/* Queue table */}
      {!loading && items.length > 0 && (
        <div className="border border-border-default rounded-lg overflow-x-auto">
          <div className="min-w-[750px]">
          {/* Header */}
          <div className="grid grid-cols-[36px_1fr_120px_120px_80px_140px_80px] gap-4 px-4 py-2.5 bg-elevated text-xs font-medium text-text-muted uppercase tracking-wider">
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={selected.size === items.length && items.length > 0}
                onChange={toggleSelectAll}
                className="w-3.5 h-3.5 rounded border-border-default accent-info cursor-pointer"
                aria-label="Select all"
              />
            </div>
            <div>Document</div>
            <div>Status</div>
            <div>Step</div>
            <div>Priority</div>
            <div>Started</div>
            <div></div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border-default">
            {items.map((item) => {
              const style = STATUS_STYLES[item.status] ?? STATUS_STYLES.queued
              const doc = item.documents
              const isSelected = selected.has(item.id)

              return (
                <div key={item.id}>
                  <div
                    className={`grid grid-cols-[36px_1fr_120px_120px_80px_140px_80px] gap-4 px-4 py-3 transition-colors ${
                      isSelected
                        ? 'bg-info/5 hover:bg-info/10'
                        : 'bg-surface hover:bg-elevated/50'
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.id)}
                        className="w-3.5 h-3.5 rounded border-border-default accent-info cursor-pointer"
                        aria-label={`Select ${doc?.bates_number ?? item.document_id}`}
                      />
                    </div>

                    {/* Document info */}
                    <div className="min-w-0">
                      <Link
                        href={`/documents/${item.document_id}`}
                        className="text-sm text-text-primary hover:text-info transition-colors truncate block"
                      >
                        {doc?.bates_number ?? doc?.title ?? item.document_id.slice(0, 8)}
                      </Link>
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        {doc?.title && doc.bates_number && (
                          <span className="truncate">{doc.title}</span>
                        )}
                        <span>{formatBytes(doc?.file_size_bytes ?? null)}</span>
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="flex items-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                    </div>

                    {/* Current step */}
                    <div className="flex items-center text-xs text-text-secondary">
                      {item.current_step ?? '—'}
                    </div>

                    {/* Priority */}
                    <div className="flex items-center">
                      <span className={`text-xs font-mono ${
                        item.priority <= 3 ? 'text-critical' : item.priority <= 5 ? 'text-warning' : 'text-text-muted'
                      }`}>
                        P{item.priority}
                      </span>
                    </div>

                    {/* Started */}
                    <div className="flex items-center text-xs text-text-muted">
                      {formatTime(item.started_at)}
                    </div>

                    {/* Row action */}
                    <div className="flex items-center justify-end">
                      {item.status === 'failed' && (
                        <button
                          onClick={() => retryItems([item.id])}
                          disabled={actionLoading}
                          className="text-[10px] px-2 py-0.5 rounded bg-critical/10 text-critical hover:bg-critical/20 transition-colors disabled:opacity-50"
                          title="Retry this document"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Error message (full width below if failed) */}
                  {item.status === 'failed' && item.error_message && (
                    <div className="px-4 pb-3 -mt-1">
                      <p className="text-xs text-critical bg-critical/5 rounded px-2 py-1 ml-[52px]">
                        {item.error_message}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          </div>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={Math.ceil(totalCount / PAGE_SIZE)}
        onPageChange={setPage}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        noun="items"
      />
    </MainContent>
  )
}
