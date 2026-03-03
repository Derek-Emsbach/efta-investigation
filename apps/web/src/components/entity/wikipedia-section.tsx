'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { VerificationBadge } from '@/components/ui/verification-badge'
import type { VerificationStatus } from '@efta/shared'

interface WikiSource {
  title: string | null
  summary: string | null
  source_url: string | null
  thumbnail_url: string | null
  verification_status: VerificationStatus
  metadata: Record<string, unknown>
}

interface WikipediaSectionProps {
  entityId: string
}

export function WikipediaSection({ entityId }: WikipediaSectionProps) {
  const [source, setSource] = useState<WikiSource | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const fetchWikipedia = useCallback(async () => {
    try {
      const res = await fetch(`/api/entities/${entityId}/wikipedia`)
      if (!res.ok) return
      const data = await res.json()

      if (data.notFound) {
        setNotFound(true)
      } else if (data.source) {
        setSource(data.source as WikiSource)
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }, [entityId])

  useEffect(() => {
    void fetchWikipedia()
  }, [fetchWikipedia])

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-elevated rounded w-1/3" />
        <div className="h-20 bg-elevated rounded" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="text-xs text-text-muted flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        No Wikipedia article found for this entity
      </div>
    )
  }

  if (!source) return null

  return (
    <div className="bg-surface border border-border-default rounded-lg p-5">
      <div className="flex items-start gap-4">
        {/* Thumbnail */}
        {source.thumbnail_url && (
          <div className="shrink-0">
            <Image
              src={source.thumbnail_url}
              alt={source.title ?? 'Wikipedia thumbnail'}
              width={80}
              height={80}
              className="w-20 h-20 rounded-lg object-cover border border-border-default"
              unoptimized={!source.thumbnail_url.includes('wikimedia.org')}
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-display text-sm font-semibold text-text-primary truncate">
              {source.title}
            </h4>
            <VerificationBadge status={source.verification_status} />
          </div>

          {/* Summary */}
          {source.summary && (
            <p className="text-xs text-text-secondary leading-relaxed line-clamp-4">
              {source.summary}
            </p>
          )}

          {/* Description from metadata */}
          {typeof source.metadata?.description === 'string' && (
            <p className="text-[10px] text-text-muted italic mt-1">
              {source.metadata.description}
            </p>
          )}

          {/* Link */}
          {source.source_url && (
            <a
              href={source.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-info hover:text-info/80 mt-2 transition-colors"
            >
              View on Wikipedia
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
