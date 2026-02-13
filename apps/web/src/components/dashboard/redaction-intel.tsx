'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface RedactionStats {
  categories: Record<string, number>
  suspectCount: number
  totalRedactions: number
  suspectDocCount: number
}

const CATEGORY_INFO: Record<string, { label: string; description: string; color: string; bgColor: string }> = {
  A: { label: 'Victim Protection', description: 'Generally appropriate', color: 'text-success', bgColor: 'bg-success/10 border-success/20' },
  B: { label: 'Legal Privilege', description: 'Context-dependent', color: 'text-info', bgColor: 'bg-info/10 border-info/20' },
  C: { label: 'Institutional', description: 'Often suspect', color: 'text-warning', bgColor: 'bg-warning/10 border-warning/20' },
  D: { label: 'Perpetrator', description: 'Suspect', color: 'text-critical', bgColor: 'bg-critical/10 border-critical/20' },
}

export function RedactionIntel() {
  const [stats, setStats] = useState<RedactionStats | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/alerts')
      if (!res.ok) return
      const data = await res.json()

      // Build category counts from suspect redactions + total query
      setStats({
        categories: data.suspectRedactions.byCategory ?? {},
        suspectCount: data.suspectRedactions.total,
        totalRedactions: 0, // Will be populated from server
        suspectDocCount: 0,
      })
    } catch {
      // Silent fail
    }
  }, [])

  useEffect(() => {
    void fetchStats()
  }, [fetchStats])

  if (!stats) return null

  return (
    <div>
      <h3 className="font-display text-lg font-semibold text-text-primary mb-4">
        Redaction Intelligence
      </h3>
      <div className="bg-surface border border-border-default rounded-lg p-5">
        {/* Category cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {(['A', 'B', 'C', 'D'] as const).map((cat) => {
            const info = CATEGORY_INFO[cat]
            const count = stats.categories[cat] ?? 0

            return (
              <div
                key={cat}
                className={`border rounded-lg p-3 ${info.bgColor}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-lg font-display font-bold ${info.color}`}>
                    {cat}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {info.label}
                  </span>
                </div>
                <p className="text-[10px] text-text-muted">
                  {info.description}
                </p>
                {count > 0 && (
                  <p className={`text-sm font-medium mt-1 ${info.color}`}>
                    {count} suspect
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* Suspect callout */}
        {stats.suspectCount > 0 && (
          <Link
            href="/documents"
            className="flex items-center gap-2 bg-critical/5 border border-critical/20 rounded-lg px-4 py-2.5 hover:bg-critical/10 transition-colors group"
          >
            <svg className="w-4 h-4 text-critical shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span className="text-xs text-text-primary group-hover:text-info transition-colors">
              {stats.suspectCount} suspect redaction{stats.suspectCount !== 1 ? 's' : ''} flagged for investigation
            </span>
          </Link>
        )}

        {stats.suspectCount === 0 && (
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            No suspect redactions detected
          </div>
        )}
      </div>
    </div>
  )
}
