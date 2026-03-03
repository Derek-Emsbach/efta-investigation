'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { AnalysisInsight } from '@/app/api/admin/analysis/route'
import type { ReactNode } from 'react'

const SEVERITY_STYLES: Record<string, { border: string; icon: string; dot: string }> = {
  critical: { border: 'border-l-critical', icon: 'text-critical', dot: 'bg-critical' },
  warning: { border: 'border-l-warning', icon: 'text-warning', dot: 'bg-warning' },
  info: { border: 'border-l-info', icon: 'text-info', dot: 'bg-info' },
}

const TYPE_ICONS: Record<string, ReactNode> = {
  missing_connections: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.07-9.07l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
    </svg>
  ),
  under_investigated: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
  stale_reviews: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  timeline_gaps: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  redaction_inconsistencies: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  ),
}

export function AnalysisInsights() {
  const [insights, setInsights] = useState<AnalysisInsight[] | null>(null)
  const [expandedType, setExpandedType] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchInsights = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/analysis')
      if (!res.ok) return
      setInsights(await res.json())
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchInsights()
    // Refresh every 5 minutes (these are heavy queries)
    const interval = setInterval(fetchInsights, 300_000)
    return () => clearInterval(interval)
  }, [fetchInsights])

  if (loading) {
    return (
      <div className="bg-surface border border-border-default rounded-lg p-5">
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
          Running analysis&hellip;
        </div>
      </div>
    )
  }

  if (!insights || insights.length === 0) {
    return (
      <div className="bg-surface border border-success/20 rounded-lg p-5 flex items-center gap-3">
        <svg className="w-5 h-5 text-success shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-text-primary">No data quality issues found</p>
          <p className="text-xs text-text-muted">All analysis checks passed</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {insights.map((insight) => {
        const styles = SEVERITY_STYLES[insight.severity]
        const icon = TYPE_ICONS[insight.type]
        const isExpanded = expandedType === insight.type

        return (
          <div
            key={insight.type}
            className={`bg-surface border border-border-default ${styles.border} border-l-4 rounded-lg overflow-hidden`}
          >
            {/* Header — clickable to expand */}
            <button
              onClick={() => setExpandedType(isExpanded ? null : insight.type)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-elevated/30 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className={styles.icon}>{icon}</span>
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {insight.title}
                  </p>
                  <p className="text-xs text-text-muted">
                    {insight.count} issue{insight.count !== 1 ? 's' : ''} detected
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                  insight.severity === 'critical' ? 'bg-critical/10 text-critical' :
                  insight.severity === 'warning' ? 'bg-warning/10 text-warning' :
                  'bg-info/10 text-info'
                }`}>
                  {insight.severity}
                </span>
                <svg
                  className={`w-4 h-4 text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </button>

            {/* Expanded items list */}
            {isExpanded && (
              <div className="border-t border-border-default divide-y divide-border-default">
                {insight.items.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex items-start gap-3 px-4 py-2.5 hover:bg-elevated/30 transition-colors group"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${styles.dot} mt-1.5 shrink-0`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text-primary font-medium truncate group-hover:text-info transition-colors">
                        {item.label}
                      </p>
                      <p className="text-xs text-text-muted truncate">
                        {item.detail}
                      </p>
                    </div>
                  </Link>
                ))}

                {insight.count > insight.items.length && (
                  <Link
                    href={insight.href}
                    className="block px-4 py-2 text-xs text-info hover:text-info/80 transition-colors text-center"
                  >
                    View all {insight.count} &rarr;
                  </Link>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
