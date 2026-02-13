'use client'

import Link from 'next/link'
import { TierBadge } from '@/components/ui/tier-badge'
import type { Tier } from '@efta/shared'

interface SightingEntity {
  id: string
  name: string
  tier: Tier | null
  category: string | null
}

interface Sighting {
  id: string
  entity_id: string
  date: string
  sighting_type: string
  entity: SightingEntity | null
}

interface CoPresencePanelProps {
  sightings: Sighting[]
}

interface CoPresenceEvent {
  date: string
  entities: SightingEntity[]
  sightingTypes: string[]
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function CoPresencePanel({ sightings }: CoPresencePanelProps) {
  // Group by date and find co-presence events
  const byDate = new Map<string, Sighting[]>()
  for (const s of sightings) {
    if (!byDate.has(s.date)) byDate.set(s.date, [])
    byDate.get(s.date)!.push(s)
  }

  const coPresenceEvents: CoPresenceEvent[] = []
  for (const [date, dateSightings] of byDate.entries()) {
    const entityMap = new Map<string, SightingEntity>()
    const types = new Set<string>()

    for (const s of dateSightings) {
      if (s.entity) {
        entityMap.set(s.entity.id, s.entity)
      }
      types.add(s.sighting_type)
    }

    if (entityMap.size > 1) {
      coPresenceEvents.push({
        date,
        entities: Array.from(entityMap.values()),
        sightingTypes: Array.from(types),
      })
    }
  }

  // Sort by date descending
  coPresenceEvents.sort((a, b) => b.date.localeCompare(a.date))

  if (coPresenceEvents.length === 0) {
    return (
      <div className="bg-surface border border-border-default rounded-lg p-5">
        <h3 className="font-display text-sm font-semibold text-text-primary uppercase tracking-wider mb-3">
          Co-Presence Analysis
        </h3>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          No co-presence events detected at this location.
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border-default rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-sm font-semibold text-text-primary uppercase tracking-wider">
          Co-Presence Analysis
        </h3>
        <span className="text-xs font-medium text-warning bg-warning/10 px-2 py-0.5 rounded">
          {coPresenceEvents.length} event{coPresenceEvents.length !== 1 ? 's' : ''}
        </span>
      </div>

      <p className="text-xs text-text-muted mb-4">
        Dates when multiple entities were recorded at this location simultaneously.
      </p>

      <div className="space-y-4">
        {coPresenceEvents.map((event) => (
          <div key={event.date} className="border border-warning/20 bg-warning/5 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-3.5 h-3.5 text-warning shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span className="font-display text-sm font-semibold text-text-primary">
                {formatDate(event.date)}
              </span>
              <span className="text-[10px] text-text-muted">
                {event.entities.length} entities present
              </span>
            </div>

            {/* Entities present */}
            <div className="flex flex-wrap gap-2 mb-2">
              {event.entities.map((entity) => (
                <Link
                  key={entity.id}
                  href={`/entities/${entity.id}`}
                  className="inline-flex items-center gap-1.5 text-xs bg-surface border border-border-default rounded px-2 py-1 hover:border-info transition-colors"
                >
                  <span className="text-text-primary font-medium">{entity.name}</span>
                  {entity.tier && <TierBadge tier={entity.tier} size="sm" />}
                </Link>
              ))}
            </div>

            {/* Activity types */}
            <div className="flex flex-wrap gap-1">
              {event.sightingTypes.map((type) => (
                <span
                  key={type}
                  className="text-[9px] bg-elevated rounded px-1.5 py-0.5 text-text-muted"
                >
                  {formatType(type)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
