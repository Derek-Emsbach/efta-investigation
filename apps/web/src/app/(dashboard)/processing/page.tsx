'use client'

import { useCallback, useEffect, useState } from 'react'
import MainContent from '@/components/layout/main-content'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import Link from 'next/link'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchQueue = useCallback(async () => {
    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : ''
      const res = await fetch(`/api/processing${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setItems(data.items)
      setStats(data.stats)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  // Initial fetch + polling
  useEffect(() => {
    fetchQueue()
    const interval = setInterval(fetchQueue, POLL_INTERVAL)
    return () => clearInterval(interval)
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
          <StatCard label="Needs Review" value={stats.needs_review} accent="#F59E0B" />
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-text-muted">Filter:</span>
        {['all', 'queued', 'processing', 'completed', 'failed', 'needs_review'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
              statusFilter === s
                ? 'bg-info/10 text-info border border-info/30'
                : 'bg-elevated text-text-muted hover:text-text-secondary border border-border-default'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_STYLES[s]?.label ?? s}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 text-xs text-text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          Auto-refreshing
        </div>
      </div>

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
        <div className="bg-surface border border-border-default rounded-lg p-12 text-center">
          <svg className="w-12 h-12 mx-auto mb-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-text-muted text-sm mb-3">No documents in the processing queue</p>
          <Link
            href="/upload"
            className="text-sm text-info hover:text-info/80 underline transition-colors"
          >
            Upload documents to get started
          </Link>
        </div>
      )}

      {/* Queue table */}
      {!loading && items.length > 0 && (
        <div className="border border-border-default rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_120px_120px_100px_140px_140px] gap-4 px-4 py-2.5 bg-elevated text-xs font-medium text-text-muted uppercase tracking-wider">
            <div>Document</div>
            <div>Status</div>
            <div>Step</div>
            <div>Priority</div>
            <div>Started</div>
            <div>Completed</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border-default">
            {items.map((item) => {
              const style = STATUS_STYLES[item.status] ?? STATUS_STYLES.queued
              const doc = item.documents

              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_120px_120px_100px_140px_140px] gap-4 px-4 py-3 bg-surface hover:bg-elevated/50 transition-colors"
                >
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

                  {/* Completed */}
                  <div className="flex items-center text-xs text-text-muted">
                    {formatTime(item.completed_at)}
                  </div>

                  {/* Error message (full width row below if failed) */}
                  {item.status === 'failed' && item.error_message && (
                    <div className="col-span-6 -mt-1 mb-1">
                      <p className="text-xs text-critical bg-critical/5 rounded px-2 py-1">
                        {item.error_message}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </MainContent>
  )
}
