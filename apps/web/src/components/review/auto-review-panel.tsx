'use client'

import { useState } from 'react'

interface PendingEntity {
  name: string
  tier: number
  category: string
  context: string
}

interface PendingRedaction {
  page: number
  current_category: string
  proposed_category: string
  reason: string
}

interface AutoReviewData {
  auto_applied: number
  applied_links: { name: string; role: string }[]
  pending_entities: PendingEntity[]
  pending_redactions: PendingRedaction[]
  has_pending: boolean
  summary: string
}

interface AutoReviewPanelProps {
  documentId: string
  data: AutoReviewData
  onUpdate: () => void
}

const TIER_LABELS: Record<number, string> = {
  1: 'T1 Direct',
  2: 'T2 Immunized',
  3: 'T3 Circumstantial',
  4: 'T4 Associated',
  5: 'T5 Victim/Witness',
  6: 'T6 Peripheral',
}

const TIER_COLORS: Record<number, string> = {
  1: 'text-red-400',
  2: 'text-orange-400',
  3: 'text-yellow-400',
  4: 'text-blue-400',
  5: 'text-emerald-400',
  6: 'text-gray-400',
}

const CAT_LABELS: Record<string, string> = {
  A: 'A (Victim)',
  B: 'B (Privilege)',
  C: 'C (Institutional)',
  D: 'D (Perpetrator)',
}

export function AutoReviewPanel({ documentId, data, onUpdate }: AutoReviewPanelProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hasSafeEntities = data.pending_entities.some(e => e.tier >= 5)
  const totalPending = data.pending_entities.length + data.pending_redactions.length

  async function handleAction(action: string, index?: number) {
    const key = `${action}-${index ?? 'all'}`
    setLoading(key)
    setError(null)

    try {
      const res = await fetch('/api/review/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, document_id: documentId, index }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Request failed')
      }

      onUpdate()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(null)
    }
  }

  if (!data.has_pending && data.auto_applied === 0) {
    return null
  }

  return (
    <div className="border border-[#1F2937] rounded-lg bg-[#111827] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1F2937] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-amber-400">AI Auto-Review</span>
          {totalPending > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300">
              {totalPending} pending
            </span>
          )}
        </div>
        {hasSafeEntities && (
          <button
            onClick={() => handleAction('approve_all_safe')}
            disabled={loading !== null}
            className="text-xs px-2 py-1 rounded bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/50 disabled:opacity-50 transition-colors"
          >
            Approve Safe (T5/T6)
          </button>
        )}
      </div>

      {/* Summary */}
      {data.summary && (
        <div className="px-4 py-2 text-xs text-text-secondary border-b border-[#1F2937]">
          {data.summary}
        </div>
      )}

      {/* Auto-applied summary */}
      {data.auto_applied > 0 && (
        <div className="px-4 py-2 text-xs text-emerald-400/80 border-b border-[#1F2937]">
          Auto-applied: {data.auto_applied} entity link{data.auto_applied !== 1 ? 's' : ''}
        </div>
      )}

      {/* Pending entities */}
      {data.pending_entities.length > 0 && (
        <div className="px-4 py-2 space-y-2">
          <div className="text-xs text-text-secondary uppercase tracking-wide">New Entities</div>
          {data.pending_entities.map((entity, i) => (
            <div key={`entity-${i}`} className="flex items-start gap-2 text-sm">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary truncate">{entity.name}</span>
                  <span className={`text-xs ${TIER_COLORS[entity.tier] || 'text-gray-400'}`}>
                    {TIER_LABELS[entity.tier] || `T${entity.tier}`}
                  </span>
                  <span className="text-xs text-text-secondary">{entity.category}</span>
                </div>
                {entity.context && (
                  <div className="text-xs text-text-secondary mt-0.5 line-clamp-2">{entity.context}</div>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => handleAction('approve_entity', i)}
                  disabled={loading !== null}
                  className="text-xs px-1.5 py-0.5 rounded bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 disabled:opacity-50 transition-colors"
                >
                  {loading === `approve_entity-${i}` ? '...' : 'Add'}
                </button>
                <button
                  onClick={() => handleAction('reject_entity', i)}
                  disabled={loading !== null}
                  className="text-xs px-1.5 py-0.5 rounded bg-red-600/20 text-red-400 hover:bg-red-600/40 disabled:opacity-50 transition-colors"
                >
                  {loading === `reject_entity-${i}` ? '...' : 'Skip'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending redaction overrides */}
      {data.pending_redactions.length > 0 && (
        <div className="px-4 py-2 space-y-2 border-t border-[#1F2937]">
          <div className="text-xs text-text-secondary uppercase tracking-wide">Redaction Overrides</div>
          {data.pending_redactions.map((r, i) => (
            <div key={`redaction-${i}`} className="flex items-start gap-2 text-sm">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-secondary">Page {r.page}:</span>
                  <span className="text-xs text-yellow-400">
                    {CAT_LABELS[r.current_category] || r.current_category}
                  </span>
                  <span className="text-xs text-text-secondary">→</span>
                  <span className="text-xs text-red-400">
                    {CAT_LABELS[r.proposed_category] || r.proposed_category}
                  </span>
                </div>
                {r.reason && (
                  <div className="text-xs text-text-secondary mt-0.5 line-clamp-2">{r.reason}</div>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => handleAction('approve_redaction', i)}
                  disabled={loading !== null}
                  className="text-xs px-1.5 py-0.5 rounded bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 disabled:opacity-50 transition-colors"
                >
                  {loading === `approve_redaction-${i}` ? '...' : 'Apply'}
                </button>
                <button
                  onClick={() => handleAction('reject_redaction', i)}
                  disabled={loading !== null}
                  className="text-xs px-1.5 py-0.5 rounded bg-red-600/20 text-red-400 hover:bg-red-600/40 disabled:opacity-50 transition-colors"
                >
                  {loading === `reject_redaction-${i}` ? '...' : 'Dismiss'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 text-xs text-red-400 border-t border-[#1F2937]">
          Error: {error}
        </div>
      )}
    </div>
  )
}
