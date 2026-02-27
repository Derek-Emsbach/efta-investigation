'use client'

import Link from 'next/link'
import type { Entity, Tier } from '@efta/shared'
import { TierBadge } from '@/components/ui/tier-badge'

interface SightingEntity {
  id: string
  name: string
  tier: Tier | null
  category: string | null
}

interface SightingDocument {
  id: string
  bates_number: string | null
  title: string | null
}

interface Sighting {
  id: string
  entity_id: string
  location_id: string | null
  date: string
  time_start: string | null
  time_end: string | null
  time_precision: string
  sighting_type: string
  confidence: string
  description: string | null
  with_entities: string[]
  entity: SightingEntity | null
  document: SightingDocument | null
}

interface SightingListProps {
  sightings: Sighting[]
}

const CONFIDENCE_COLORS: Record<string, string> = {
  confirmed: 'bg-success/10 text-success',
  likely: 'bg-info/10 text-info',
  possible: 'bg-warning/10 text-warning',
  inferred: 'bg-text-muted/10 text-text-muted',
}

function formatSightingType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function SightingList({ sightings }: SightingListProps) {
  if (sightings.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted text-sm">
        No sightings recorded for this location.
      </div>
    )
  }

  // Group by date
  const groups = new Map<string, Sighting[]>()
  for (const s of sightings) {
    if (!groups.has(s.date)) groups.set(s.date, [])
    groups.get(s.date)!.push(s)
  }

  return (
    <div className="space-y-6">
      {Array.from(groups.entries()).map(([date, dateSightings]) => {
        const uniqueEntities = new Set(dateSightings.map((s) => s.entity?.id).filter(Boolean))
        const isCoPresence = uniqueEntities.size > 1

        return (
          <div key={date}>
            {/* Date header */}
            <div className="flex items-center gap-3 mb-3">
              <h4 className="font-display text-sm font-semibold text-text-primary">
                {formatDate(date)}
              </h4>
              <span className="text-xs text-text-muted">{dateSightings.length} sighting{dateSightings.length !== 1 ? 's' : ''}</span>
              {isCoPresence && (
                <span className="inline-flex text-[10px] font-medium px-2 py-0.5 rounded bg-warning/10 text-warning border border-warning/20">
                  Co-presence: {uniqueEntities.size} entities
                </span>
              )}
            </div>

            {/* Individual sightings */}
            <div className="space-y-2 ml-4 border-l-2 border-border-light pl-4">
              {dateSightings.map((s) => (
                <div key={s.id} className="bg-surface border border-border-default rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {/* Entity + type */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {s.entity && (
                          <Link
                            href={`/dashboard/entities/${s.entity.id}`}
                            className="font-display font-medium text-sm text-text-primary hover:text-info transition-colors"
                          >
                            {s.entity.name}
                          </Link>
                        )}
                        {s.entity?.tier && <TierBadge tier={s.entity.tier} size="sm" />}
                        <span className="text-[10px] text-text-muted uppercase tracking-wider">
                          {formatSightingType(s.sighting_type)}
                        </span>
                      </div>

                      {/* Time */}
                      {s.time_start && (
                        <p className="text-xs text-text-muted mt-1">
                          {s.time_start}{s.time_end ? ` – ${s.time_end}` : ''}
                          {s.time_precision !== 'exact' && ` (${s.time_precision})`}
                        </p>
                      )}

                      {/* Description */}
                      {s.description && (
                        <p className="text-xs text-text-secondary mt-1 line-clamp-2">{s.description}</p>
                      )}

                      {/* Source document */}
                      {s.document && (
                        <Link
                          href={`/dashboard/documents/${s.document.id}`}
                          className="inline-flex items-center gap-1 text-[10px] text-text-muted hover:text-info transition-colors mt-1.5"
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          {s.document.bates_number ?? s.document.title ?? 'Source document'}
                        </Link>
                      )}
                    </div>

                    {/* Confidence badge */}
                    <span className={`inline-flex text-[10px] font-medium px-2 py-0.5 rounded shrink-0 ${CONFIDENCE_COLORS[s.confidence] ?? CONFIDENCE_COLORS.inferred}`}>
                      {s.confidence}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
