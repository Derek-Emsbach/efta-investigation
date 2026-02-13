'use client'

import { useState, useEffect, useCallback } from 'react'

interface MentionsSummarySectionProps {
  entityId: string
}

interface MentionsSummary {
  text: string
  generated_at: string
  doc_count: number
  role_distribution: Record<string, number>
}

function formatLabel(str: string): string {
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function MentionsSummarySection({ entityId }: MentionsSummarySectionProps) {
  const [summary, setSummary] = useState<MentionsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [notAvailable, setNotAvailable] = useState(false)

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`/api/entities/${entityId}/mentions`)
      if (!res.ok) return
      const data = await res.json()
      if (data.summary) {
        setSummary(data.summary)
      } else {
        setNotAvailable(true)
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }, [entityId])

  useEffect(() => {
    void fetchSummary()
  }, [fetchSummary])

  if (loading) {
    return (
      <div className="bg-surface border border-border-default rounded-lg p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-elevated rounded w-2/3" />
          <div className="h-3 bg-elevated rounded w-full" />
          <div className="h-3 bg-elevated rounded w-5/6" />
          <div className="h-3 bg-elevated rounded w-3/4" />
        </div>
      </div>
    )
  }

  if (notAvailable || !summary) return null

  const roles = Object.entries(summary.role_distribution).sort(
    ([, a], [, b]) => b - a,
  )

  return (
    <div className="bg-surface border border-border-default rounded-lg p-5">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-display text-sm font-semibold text-text-primary uppercase tracking-wider">
          Document Mentions
        </h3>
        <svg className="w-3.5 h-3.5 text-info/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
        </svg>
      </div>

      {/* AI-generated narrative */}
      <p className="text-xs text-text-secondary leading-relaxed">
        {summary.text}
      </p>

      {/* Role distribution chips */}
      {roles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {roles.map(([role, count]) => (
            <span
              key={role}
              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-elevated text-text-muted border border-border-light"
            >
              {formatLabel(role)}
              <span className="text-text-secondary font-mono">{count}</span>
            </span>
          ))}
        </div>
      )}

      {/* Meta */}
      <div className="flex items-center gap-2 mt-3 text-[10px] text-text-muted">
        <span>{summary.doc_count} document{summary.doc_count !== 1 ? 's' : ''} analyzed</span>
        <span>&middot;</span>
        <span>AI-generated</span>
      </div>
    </div>
  )
}
