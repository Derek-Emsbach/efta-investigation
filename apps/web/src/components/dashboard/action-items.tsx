'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface AlertsData {
  pendingReviews: {
    total: number
    bySeverity: Record<string, number>
  }
  failedProcessing: {
    total: number
    errors: string[]
  }
  suspectRedactions: {
    total: number
    byCategory: Record<string, number>
  }
}

export function ActionItems() {
  const [data, setData] = useState<AlertsData | null>(null)

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/alerts')
      if (!res.ok) return
      const json = await res.json()
      setData({
        pendingReviews: json.pendingReviews,
        failedProcessing: json.failedProcessing,
        suspectRedactions: json.suspectRedactions,
      })
    } catch {
      // Silent fail
    }
  }, [])

  useEffect(() => {
    void fetchAlerts()
    const interval = setInterval(fetchAlerts, 30_000)
    return () => clearInterval(interval)
  }, [fetchAlerts])

  if (!data) return null

  const hasReviews = data.pendingReviews.total > 0
  const hasFailed = data.failedProcessing.total > 0
  const hasSuspect = data.suspectRedactions.total > 0
  const allClear = !hasReviews && !hasFailed && !hasSuspect

  if (allClear) {
    return (
      <div className="bg-surface border border-success/20 rounded-lg p-5 flex items-center gap-3">
        <svg className="w-5 h-5 text-success shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-text-primary">All clear</p>
          <p className="text-xs text-text-muted">No pending actions required</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Pending Reviews */}
      {hasReviews && (
        <Link
          href="/review"
          className="block bg-surface border-l-4 border-warning rounded-lg p-4 hover:bg-elevated/30 transition-colors group"
        >
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-warning shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary group-hover:text-info transition-colors">
                {data.pendingReviews.total} document{data.pendingReviews.total !== 1 ? 's' : ''} awaiting review
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                {Object.entries(data.pendingReviews.bySeverity)
                  .filter(([, count]) => count > 0)
                  .sort(([a], [b]) => {
                    const order = ['extreme_critical', 'critical', 'high', 'routine']
                    return order.indexOf(a) - order.indexOf(b)
                  })
                  .map(([severity, count]) => (
                    <span
                      key={severity}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-elevated text-text-muted capitalize"
                    >
                      {count} {severity.replace(/_/g, ' ')}
                    </span>
                  ))}
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Failed Processing */}
      {hasFailed && (
        <Link
          href="/processing"
          className="block bg-surface border-l-4 border-critical rounded-lg p-4 hover:bg-elevated/30 transition-colors group"
        >
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-critical shrink-0 mt-0.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary group-hover:text-info transition-colors">
                {data.failedProcessing.total} document{data.failedProcessing.total !== 1 ? 's' : ''} failed processing
              </p>
              {data.failedProcessing.errors.length > 0 && (
                <p className="text-xs text-text-muted mt-0.5 truncate font-mono">
                  {data.failedProcessing.errors[0]}
                </p>
              )}
            </div>
          </div>
        </Link>
      )}

      {/* Suspect Redactions */}
      {hasSuspect && (
        <Link
          href="/documents"
          className="block bg-surface border-l-4 border-critical/70 rounded-lg p-4 hover:bg-elevated/30 transition-colors group"
        >
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-critical/70 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary group-hover:text-info transition-colors">
                {data.suspectRedactions.total} suspect redaction{data.suspectRedactions.total !== 1 ? 's' : ''} detected
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                {Object.entries(data.suspectRedactions.byCategory)
                  .filter(([, count]) => count > 0)
                  .map(([cat, count]) => (
                    <span
                      key={cat}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        cat === 'D' ? 'bg-critical/10 text-critical' :
                        cat === 'C' ? 'bg-warning/10 text-warning' :
                        'bg-elevated text-text-muted'
                      }`}
                    >
                      {count} Category {cat}
                    </span>
                  ))}
              </div>
            </div>
          </div>
        </Link>
      )}
    </div>
  )
}
