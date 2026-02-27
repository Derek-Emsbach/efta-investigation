'use client'

import { useState } from 'react'
import Link from 'next/link'
import { TierBadge } from '@/components/ui/tier-badge'
import { SightingList } from '@/components/locations/sighting-list'
import { CoPresencePanel } from '@/components/locations/co-presence-panel'
import type { Tier } from '@efta/shared'

interface EntitySummary {
  id: string
  name: string
  tier: number | null
  category: string | null
  visit_count: number
  last_seen: string
}

interface LocationDetailTabsProps {
  sightings: Record<string, unknown>[]
  entities: EntitySummary[]
  isAirport: boolean
  flightDepartures: number
  flightArrivals: number
}

type Tab = 'sightings' | 'entities' | 'co-presence'

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function LocationDetailTabs({
  sightings,
  entities,
  isAirport,
  flightDepartures,
  flightArrivals,
}: LocationDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('sightings')

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'sightings', label: 'Sightings', count: sightings.length },
    { key: 'entities', label: 'Entities', count: entities.length },
    { key: 'co-presence', label: 'Co-Presence' },
  ]

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border-default mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-critical text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 text-xs text-text-muted">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'sightings' && (
        <SightingList sightings={sightings as never} />
      )}

      {activeTab === 'entities' && (
        <div>
          {entities.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-sm">
              No entities recorded at this location.
            </div>
          ) : (
            <div className="space-y-2">
              {entities.map((entity) => (
                <Link
                  key={entity.id}
                  href={`/dashboard/entities/${entity.id}`}
                  className="flex items-center justify-between bg-surface border border-border-default rounded-lg p-4 hover:bg-elevated/30 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-display font-medium text-sm text-text-primary group-hover:text-info transition-colors">
                      {entity.name}
                    </span>
                    {entity.tier && <TierBadge tier={entity.tier as Tier} size="sm" />}
                    {entity.category && (
                      <span className="text-[10px] text-text-muted uppercase tracking-wider">
                        {entity.category.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-text-secondary shrink-0">
                    <span>
                      <span className="font-medium text-text-primary">{entity.visit_count}</span> visit{entity.visit_count !== 1 ? 's' : ''}
                    </span>
                    <span className="text-text-muted">
                      Last: {formatDate(entity.last_seen)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Airport flight breakdown */}
          {isAirport && (flightDepartures > 0 || flightArrivals > 0) && (
            <div className="mt-6 bg-info/5 border border-info/20 rounded-lg p-4">
              <h4 className="font-display text-sm font-semibold text-text-primary mb-3">Flight Activity Breakdown</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-display font-bold text-info">{flightDepartures}</div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider">Departures</div>
                </div>
                <div>
                  <div className="text-lg font-display font-bold text-info">{flightArrivals}</div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider">Arrivals</div>
                </div>
                <div>
                  <div className="text-lg font-display font-bold text-text-primary">{flightDepartures + flightArrivals}</div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider">Total</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'co-presence' && (
        <CoPresencePanel sightings={sightings as never} />
      )}
    </div>
  )
}
