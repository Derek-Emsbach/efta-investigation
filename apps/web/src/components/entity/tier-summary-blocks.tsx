'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { TIER_CONFIG } from '@efta/shared'
import type { Tier } from '@efta/shared'
import { TierBadge } from '@/components/ui/tier-badge'

interface TierStats {
  total: number
  byCategory: Record<string, number>
  byType: Record<string, number>
  byStatus: Record<string, number>
}

interface StatsResponse {
  tiers: Record<string, TierStats>
  total: number
}

const ALL_TIERS: Tier[] = [1, 2, 3, 4, 5, 6]

function formatLabel(str: string): string {
  return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function TierSummaryBlocks() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [expanded, setExpanded] = useState<Tier | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/entities/stats')
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

  const toggleExpand = (tier: Tier) => {
    setExpanded((prev) => (prev === tier ? null : tier))
  }

  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {ALL_TIERS.map((tier) => {
          const config = TIER_CONFIG[tier]
          const tierStats = stats.tiers[String(tier)]
          const isExpanded = expanded === tier

          return (
            <button
              key={tier}
              onClick={() => toggleExpand(tier)}
              className={`text-left border rounded-lg p-3 transition-all ${
                isExpanded
                  ? 'ring-1 ring-offset-1 ring-offset-background'
                  : 'hover:bg-elevated/30'
              }`}
              style={{
                borderColor: isExpanded ? config.color : undefined,
                borderLeftWidth: '3px',
                borderLeftColor: config.color,
                ...(isExpanded ? { ringColor: config.color } : {}),
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <TierBadge tier={tier} size="sm" />
                <span className="text-lg font-display font-bold text-text-primary">
                  {tierStats?.total ?? 0}
                </span>
              </div>
              <p className="text-[10px] text-text-muted leading-tight line-clamp-2">
                {config.description}
              </p>
              {/* Top category preview */}
              {tierStats && Object.keys(tierStats.byCategory).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {Object.entries(tierStats.byCategory)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 2)
                    .map(([cat, count]) => (
                      <span
                        key={cat}
                        className="text-[9px] bg-elevated rounded px-1.5 py-0.5 text-text-muted"
                      >
                        {formatLabel(cat)} {count}
                      </span>
                    ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Expanded detail panel */}
      {expanded !== null && stats.tiers[String(expanded)] && (
        <div
          className="mt-3 border rounded-lg p-4 bg-surface animate-in slide-in-from-top-2 duration-200"
          style={{ borderColor: TIER_CONFIG[expanded].color + '40' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <TierBadge tier={expanded} />
              <div>
                <h4 className="font-display font-semibold text-text-primary">
                  Tier {expanded}: {TIER_CONFIG[expanded].label}
                </h4>
                <p className="text-xs text-text-muted">{TIER_CONFIG[expanded].description}</p>
              </div>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Category distribution */}
            <div>
              <h5 className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2">
                By Category
              </h5>
              <div className="space-y-1.5">
                {Object.entries(stats.tiers[String(expanded)].byCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, count]) => (
                    <div key={cat} className="flex items-center justify-between">
                      <Link
                        href={`/entities?tier=${expanded}&category=${cat}`}
                        className="text-xs text-text-secondary hover:text-info transition-colors"
                      >
                        {formatLabel(cat)}
                      </Link>
                      <span className="text-xs font-medium text-text-primary">{count}</span>
                    </div>
                  ))}
                {Object.keys(stats.tiers[String(expanded)].byCategory).length === 0 && (
                  <p className="text-xs text-text-muted">No categories assigned</p>
                )}
              </div>
            </div>

            {/* Type distribution */}
            <div>
              <h5 className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2">
                By Type
              </h5>
              <div className="space-y-1.5">
                {Object.entries(stats.tiers[String(expanded)].byType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([typ, count]) => (
                    <div key={typ} className="flex items-center justify-between">
                      <span className="text-xs text-text-secondary capitalize">{typ}</span>
                      <span className="text-xs font-medium text-text-primary">{count}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Status distribution */}
            <div>
              <h5 className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2">
                By Status
              </h5>
              <div className="space-y-1.5">
                {Object.entries(stats.tiers[String(expanded)].byStatus)
                  .sort(([, a], [, b]) => b - a)
                  .map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span className="text-xs text-text-secondary">{formatLabel(status)}</span>
                      <span className="text-xs font-medium text-text-primary">{count}</span>
                    </div>
                  ))}
                {Object.keys(stats.tiers[String(expanded)].byStatus).length === 0 && (
                  <p className="text-xs text-text-muted">No statuses assigned</p>
                )}
              </div>
            </div>
          </div>

          {/* View filtered link */}
          <div className="mt-4 pt-3 border-t border-border-default">
            <Link
              href={`/entities?tier=${expanded}`}
              className="text-xs text-info hover:text-info/80 transition-colors"
            >
              View all {stats.tiers[String(expanded)].total} Tier {expanded} entities →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
