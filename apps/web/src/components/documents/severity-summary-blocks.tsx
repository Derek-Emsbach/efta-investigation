'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { SEVERITY_CONFIG } from '@efta/shared'
import type { Severity } from '@efta/shared'
import { SeverityMarker } from '@/components/ui/severity-marker'

interface SeverityStats {
  total: number
  byType: Record<string, number>
  byStatus: Record<string, number>
}

interface StatsResponse {
  severities: Record<string, SeverityStats>
  unassessed: number
  total: number
}

const ALL_SEVERITIES: Severity[] = ['extreme_critical', 'critical', 'high', 'routine']

function formatLabel(str: string): string {
  return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function SeveritySummaryBlocks() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/documents/stats')
      if (!res.ok) return
      const data: StatsResponse = await res.json()
      setStats(data)
    } catch {
      // Silent fail
    }
  }, [])

  useEffect(() => {
    void fetchStats()
  }, [fetchStats])

  if (!stats) return null

  const toggleExpand = (key: string) => {
    setExpanded((prev) => (prev === key ? null : key))
  }

  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {ALL_SEVERITIES.map((sev) => {
          const config = SEVERITY_CONFIG[sev]
          const sevStats = stats.severities[sev]
          const isExpanded = expanded === sev

          return (
            <button
              key={sev}
              onClick={() => toggleExpand(sev)}
              className={`text-left border rounded-lg p-3 transition-all ${
                isExpanded ? 'ring-1 ring-offset-1 ring-offset-background' : 'hover:bg-elevated/30'
              } ${config.pulse ? 'animate-severity-pulse' : ''}`}
              style={{
                borderColor: isExpanded ? config.color : undefined,
                borderLeftWidth: '3px',
                borderLeftColor: config.color,
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <SeverityMarker severity={sev} />
                <span className="text-lg font-display font-bold text-text-primary">
                  {sevStats?.total ?? 0}
                </span>
              </div>
              {/* Top types preview */}
              {sevStats && Object.keys(sevStats.byType).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {Object.entries(sevStats.byType)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 2)
                    .map(([typ, count]) => (
                      <span
                        key={typ}
                        className="text-[9px] bg-elevated rounded px-1.5 py-0.5 text-text-muted"
                      >
                        {formatLabel(typ)} {count}
                      </span>
                    ))}
                </div>
              )}
            </button>
          )
        })}

        {/* Unassessed card */}
        <button
          onClick={() => toggleExpand('unassessed')}
          className={`text-left border rounded-lg p-3 transition-all ${
            expanded === 'unassessed'
              ? 'ring-1 ring-offset-1 ring-offset-background border-text-muted'
              : 'hover:bg-elevated/30 border-border-default'
          }`}
          style={{ borderLeftWidth: '3px', borderLeftColor: '#6B7280' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
              Unassessed
            </span>
            <span className="text-lg font-display font-bold text-text-primary">
              {stats.unassessed}
            </span>
          </div>
          <p className="text-[9px] text-text-muted">Severity not yet assigned</p>
        </button>
      </div>

      {/* Expanded detail panel */}
      {expanded !== null && expanded !== 'unassessed' && stats.severities[expanded] && (
        <div
          className="mt-3 border rounded-lg p-4 bg-surface animate-in slide-in-from-top-2 duration-200"
          style={{ borderColor: SEVERITY_CONFIG[expanded as Severity].color + '40' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <SeverityMarker severity={expanded as Severity} />
              <h4 className="font-display font-semibold text-text-primary">
                {SEVERITY_CONFIG[expanded as Severity].label} Documents
              </h4>
            </div>
            <button
              onClick={() => setExpanded(null)}
              className="text-text-muted hover:text-text-secondary transition-colors p-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Type distribution */}
            <div>
              <h5 className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2">
                By Document Type
              </h5>
              <div className="space-y-1.5">
                {Object.entries(stats.severities[expanded].byType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([typ, count]) => {
                    const pct = Math.round((count / stats.severities[expanded].total) * 100)
                    return (
                      <div key={typ}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-text-secondary">{formatLabel(typ)}</span>
                          <span className="text-xs font-medium text-text-primary">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-1 bg-elevated rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: SEVERITY_CONFIG[expanded as Severity].color,
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Status distribution */}
            <div>
              <h5 className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2">
                By Processing Status
              </h5>
              <div className="space-y-1.5">
                {Object.entries(stats.severities[expanded].byStatus)
                  .sort(([, a], [, b]) => b - a)
                  .map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span className="text-xs text-text-secondary">{formatLabel(status)}</span>
                      <span className="text-xs font-medium text-text-primary">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* View filtered link */}
          <div className="mt-4 pt-3 border-t border-border-default">
            <Link
              href={`/documents?severity=${expanded}`}
              className="text-xs text-info hover:text-info/80 transition-colors"
            >
              View all {stats.severities[expanded].total}{' '}
              {SEVERITY_CONFIG[expanded as Severity].label.toLowerCase()} documents →
            </Link>
          </div>
        </div>
      )}

      {/* Unassessed expanded */}
      {expanded === 'unassessed' && stats.unassessed > 0 && (
        <div className="mt-3 border border-border-default rounded-lg p-4 bg-surface animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-display font-semibold text-text-primary">
              Unassessed Documents
            </h4>
            <button
              onClick={() => setExpanded(null)}
              className="text-text-muted hover:text-text-secondary transition-colors p-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-text-muted mb-3">
            {stats.unassessed} documents have not yet been assigned a severity level.
            These may be newly uploaded or still in processing.
          </p>
          <Link
            href="/documents?severity="
            className="text-xs text-info hover:text-info/80 transition-colors"
          >
            View unassessed documents →
          </Link>
        </div>
      )}
    </div>
  )
}
