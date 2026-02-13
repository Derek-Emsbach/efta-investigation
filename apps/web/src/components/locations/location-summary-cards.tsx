'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface TopLocation {
  id: string
  name: string
  location_type: string | null
  city: string | null
  country: string | null
  sighting_count: number
  entity_count: number
}

interface StatsResponse {
  totalLocations: number
  totalSightings: number
  byType: Record<string, number>
  byCountry: Record<string, number>
  topLocations: TopLocation[]
}

const TYPE_COLORS: Record<string, string> = {
  property: 'text-warning',
  airport: 'text-info',
  office: 'text-text-secondary',
  court: 'text-critical',
  restaurant: 'text-success',
  hotel: 'text-info',
  school: 'text-warning',
  other: 'text-text-muted',
}

function formatType(type: string | null): string {
  if (!type) return 'Unknown'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export function LocationSummaryCards() {
  const [stats, setStats] = useState<StatsResponse | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/locations/stats')
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

  if (!stats || stats.topLocations.length === 0) return null

  return (
    <div className="mb-6">
      {/* Summary stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="bg-surface border border-border-default rounded-lg p-4" style={{ borderLeftWidth: '3px', borderLeftColor: '#F59E0B' }}>
          <div className="text-2xl font-display font-bold text-text-primary">{stats.totalLocations}</div>
          <div className="text-xs text-text-muted mt-1">Total Locations</div>
        </div>
        <div className="bg-surface border border-border-default rounded-lg p-4" style={{ borderLeftWidth: '3px', borderLeftColor: '#3B82F6' }}>
          <div className="text-2xl font-display font-bold text-text-primary">{stats.totalSightings}</div>
          <div className="text-xs text-text-muted mt-1">Total Sightings</div>
        </div>
        <div className="bg-surface border border-border-default rounded-lg p-4" style={{ borderLeftWidth: '3px', borderLeftColor: '#10B981' }}>
          <div className="text-2xl font-display font-bold text-text-primary">{Object.keys(stats.byType).length}</div>
          <div className="text-xs text-text-muted mt-1">Location Types</div>
        </div>
        <div className="bg-surface border border-border-default rounded-lg p-4" style={{ borderLeftWidth: '3px', borderLeftColor: '#DC2626' }}>
          <div className="text-2xl font-display font-bold text-text-primary">{Object.keys(stats.byCountry).length}</div>
          <div className="text-xs text-text-muted mt-1">Countries</div>
        </div>
      </div>

      {/* Top locations */}
      <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-3">Key Locations by Activity</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {stats.topLocations.map((loc) => (
          <Link
            key={loc.id}
            href={`/locations/${loc.id}`}
            className="bg-surface border border-border-default rounded-lg p-4 hover:bg-elevated/30 transition-colors group"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="min-w-0">
                <h4 className="font-display font-semibold text-text-primary group-hover:text-info transition-colors truncate">
                  {loc.name}
                </h4>
                {(loc.city || loc.country) && (
                  <p className="text-xs text-text-muted mt-0.5 truncate">
                    {[loc.city, loc.country].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
              <span className={`text-[10px] font-medium uppercase tracking-wider shrink-0 ml-2 ${TYPE_COLORS[loc.location_type ?? 'other']}`}>
                {formatType(loc.location_type)}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-text-secondary">
                <span className="font-medium text-text-primary">{loc.sighting_count}</span> sightings
              </span>
              <span className="text-text-secondary">
                <span className="font-medium text-text-primary">{loc.entity_count}</span> entities
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
