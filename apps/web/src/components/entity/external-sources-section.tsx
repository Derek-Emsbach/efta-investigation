'use client'

import { useState, useEffect, useCallback } from 'react'
import { VerificationBadge } from '@/components/ui/verification-badge'
import type { ExternalSource, SourceType, VerificationStatus } from '@efta/shared'

interface ExternalSourcesSectionProps {
  entityId: string
}

const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  wikipedia: 'Wikipedia',
  news_article: 'News',
  court_record: 'Court Record',
  flight_log: 'Flight Log',
  public_record: 'Public Record',
  financial_disclosure: 'Financial',
}

const SOURCE_TYPE_COLORS: Record<SourceType, string> = {
  wikipedia: 'bg-info/10 text-info',
  news_article: 'bg-warning/10 text-warning',
  court_record: 'bg-critical/10 text-critical',
  flight_log: 'bg-success/10 text-success',
  public_record: 'bg-text-secondary/10 text-text-secondary',
  financial_disclosure: 'bg-tier-3/10 text-tier-3',
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export function ExternalSourcesSection({ entityId }: ExternalSourcesSectionProps) {
  const [sources, setSources] = useState<ExternalSource[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch(`/api/entities/${entityId}/sources`)
      if (!res.ok) return
      const data = await res.json()
      // Filter out wikipedia — that has its own section
      const nonWiki = (data.data ?? []).filter(
        (s: ExternalSource) => s.source_type !== 'wikipedia'
      )
      setSources(nonWiki)

      // If no news articles cached, trigger background fetch
      const hasNews = nonWiki.some((s: ExternalSource) => s.source_type === 'news_article')
      if (!hasNews) {
        fetch(`/api/entities/${entityId}/news`).then(async (newsRes) => {
          if (!newsRes.ok) return
          const newsData = await newsRes.json()
          if (newsData.count > 0) {
            // Re-fetch sources to include new articles
            const refreshRes = await fetch(`/api/entities/${entityId}/sources`)
            if (refreshRes.ok) {
              const refreshData = await refreshRes.json()
              setSources(
                (refreshData.data ?? []).filter(
                  (s: ExternalSource) => s.source_type !== 'wikipedia'
                )
              )
            }
          }
        }).catch(() => { /* silent */ })
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }, [entityId])

  useEffect(() => {
    void fetchSources()
  }, [fetchSources])

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-elevated rounded w-1/3" />
        <div className="h-16 bg-elevated rounded" />
      </div>
    )
  }

  if (sources.length === 0) return null

  return (
    <div className="bg-surface border border-border-default rounded-lg p-5">
      <h3 className="font-display text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">
        External Sources
      </h3>
      <div className="space-y-3">
        {sources.map((source) => (
          <div
            key={source.id}
            className="border border-border-default rounded-lg p-3 bg-background"
          >
            {/* Source type + verification */}
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  SOURCE_TYPE_COLORS[source.source_type as SourceType] ?? 'bg-elevated text-text-muted'
                }`}
              >
                {SOURCE_TYPE_LABELS[source.source_type as SourceType] ?? source.source_type}
              </span>
              <VerificationBadge status={source.verification_status as VerificationStatus} />
            </div>

            {/* Title */}
            {source.title && (
              <p className="text-xs font-medium text-text-primary line-clamp-2">
                {source.title}
              </p>
            )}

            {/* Summary */}
            {source.summary && (
              <p className="text-[11px] text-text-secondary leading-relaxed line-clamp-3 mt-1">
                {source.summary}
              </p>
            )}

            {/* Footer: source name + date + link */}
            <div className="flex items-center gap-2 mt-2">
              {source.source_name && (
                <span className="text-[10px] text-text-muted">
                  {source.source_name}
                </span>
              )}
              {source.published_date && (
                <span className="text-[10px] text-text-muted">
                  {formatDate(source.published_date)}
                </span>
              )}
              {source.source_url && (
                <a
                  href={source.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-[10px] text-info hover:text-info/80 transition-colors flex items-center gap-0.5"
                >
                  View
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
