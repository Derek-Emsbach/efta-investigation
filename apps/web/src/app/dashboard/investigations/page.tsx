'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import MainContent from '@/components/layout/main-content'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'

// ── Types ──────────────────────────────────────────────────

interface InvestigationListItem {
  id: string
  name: string
  status: string
  summary: string | null
  open_questions: string[]
  created_at: string
  updated_at: string
  entity_count: number
  document_count: number
  event_count: number
  note_count: number
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-success/10', text: 'text-success', label: 'Active' },
  pending: { bg: 'bg-warning/10', text: 'text-warning', label: 'Pending' },
  completed: { bg: 'bg-info/10', text: 'text-info', label: 'Completed' },
}

// ── Create Modal ───────────────────────────────────────────

function CreateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/investigations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), summary: summary.trim() || null }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to create')
      }
      setName('')
      setSummary('')
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border-default rounded-lg shadow-lg max-w-lg w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border-default">
          <h2 className="font-display text-sm font-semibold text-text-primary">
            New Investigation
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              Investigation Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Epstein Death Investigation"
              className="w-full bg-elevated border border-border-default rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-info"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              Summary (optional)
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief description of the investigation scope..."
              rows={3}
              className="w-full bg-elevated border border-border-default rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-info resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-critical">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || saving}
              className="px-4 py-1.5 text-xs font-medium bg-info text-white rounded hover:bg-info/80 transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Investigation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────

export default function InvestigationsPage() {
  const [investigations, setInvestigations] = useState<InvestigationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)

  const fetchInvestigations = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/investigations?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setInvestigations(data.investigations)
    } catch {
      // Silently fail on list fetch
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchInvestigations()
  }, [fetchInvestigations])

  return (
    <MainContent>
      <PageHeader
        title="Investigations"
        subtitle="Build cases by linking evidence and analyzing patterns"
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-xs font-medium bg-info text-white rounded hover:bg-info/80 transition-colors"
          >
            + New Investigation
          </button>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-xs text-text-muted">Status:</span>
        {['all', 'active', 'pending', 'completed'].map((s) => (
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
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-40 bg-surface border border-border-default rounded-lg animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && investigations.length === 0 && (
        <EmptyState
          icon={
            <svg
              className="h-12 w-12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z"
              />
            </svg>
          }
          label="NO CASES"
          title="No investigations yet"
          description="Create an investigation to start building a case. Link entities, documents, and events — then use Archer to analyze patterns and gaps."
          action={{
            label: 'Create first investigation',
            onClick: () => setShowCreate(true),
          }}
        />
      )}

      {/* Investigation cards */}
      {!loading && investigations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {investigations.map((inv) => {
            const style = STATUS_STYLES[inv.status] ?? STATUS_STYLES.active
            return (
              <Link
                key={inv.id}
                href={`/dashboard/investigations/${inv.id}`}
                className="bg-surface border border-border-default rounded-lg p-5 hover:border-info/30 transition-colors group"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-display text-sm font-semibold text-text-primary group-hover:text-info transition-colors">
                    {inv.name}
                  </h3>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded ${style.bg} ${style.text} shrink-0 ml-2`}
                  >
                    {style.label}
                  </span>
                </div>

                {inv.summary && (
                  <p className="text-xs text-text-secondary line-clamp-2 mb-3">
                    {inv.summary}
                  </p>
                )}

                {/* Evidence counts */}
                <div className="flex items-center gap-4 text-xs text-text-muted">
                  <span>{inv.entity_count} entities</span>
                  <span>{inv.document_count} documents</span>
                  <span>{inv.event_count} events</span>
                </div>

                {/* Open questions preview */}
                {inv.open_questions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border-default">
                    <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
                      Open Questions ({inv.open_questions.length})
                    </p>
                    <p className="text-xs text-text-secondary truncate">
                      {inv.open_questions[0]}
                    </p>
                  </div>
                )}

                <p className="text-[10px] text-text-muted mt-3">
                  Updated{' '}
                  {new Date(inv.updated_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </Link>
            )
          })}
        </div>
      )}

      <CreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={fetchInvestigations}
      />
    </MainContent>
  )
}
