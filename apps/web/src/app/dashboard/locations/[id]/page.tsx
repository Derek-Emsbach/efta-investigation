import { notFound } from 'next/navigation'
import Link from 'next/link'
import MainContent from '@/components/layout/main-content'
import Breadcrumbs from '@/components/ui/breadcrumbs'
import { StatCard } from '@/components/ui/stat-card'
import { TierBadge } from '@/components/ui/tier-badge'
import LocationDetailTabs from '@/components/locations/location-detail-tabs'
import { createClient } from '@/lib/supabase/server'
import type { Tier } from '@efta/shared'

function TypeBadge({ type }: { type: string | null }) {
  if (!type) return null

  const colorMap: Record<string, string> = {
    property: 'bg-warning/10 text-warning',
    airport: 'bg-info/10 text-info',
    office: 'bg-text-secondary/10 text-text-secondary',
    court: 'bg-critical/10 text-critical',
    restaurant: 'bg-success/10 text-success',
    hotel: 'bg-info/10 text-info',
    school: 'bg-warning/10 text-warning',
    other: 'bg-text-muted/10 text-text-muted',
  }

  return (
    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded capitalize ${colorMap[type] ?? colorMap.other}`}>
      {type}
    </span>
  )
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A'
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch location with owner
  const { data: location, error: locError } = await supabase
    .from('locations')
    .select('*, owner:entities!owner_entity_id(id, name, tier, category)')
    .eq('id', id)
    .single()

  if (locError || !location) {
    notFound()
  }

  // Fetch sightings with entity and document joins
  const { data: sightings } = await supabase
    .from('entity_sightings')
    .select('*, entity:entities!entity_id(id, name, tier, category), document:documents!document_id(id, bates_number, title)')
    .eq('location_id', id)
    .order('date', { ascending: false })

  const allSightings = sightings ?? []

  // Compute stats
  const entityMap = new Map<string, { id: string; name: string; tier: number | null; category: string | null; visit_count: number; last_seen: string }>()
  for (const s of allSightings) {
    const entity = s.entity as { id: string; name: string; tier: number | null; category: string | null } | null
    if (!entity) continue
    const existing = entityMap.get(entity.id)
    if (existing) {
      existing.visit_count++
      if ((s.date as string) > existing.last_seen) existing.last_seen = s.date as string
    } else {
      entityMap.set(entity.id, {
        ...entity,
        visit_count: 1,
        last_seen: s.date as string,
      })
    }
  }

  const dates = allSightings.map((s) => s.date as string).sort()
  const firstActivity = dates[0] ?? null
  const lastActivity = dates[dates.length - 1] ?? null

  // Co-presence events
  const byDate = new Map<string, typeof allSightings>()
  for (const s of allSightings) {
    const d = s.date as string
    if (!byDate.has(d)) byDate.set(d, [])
    byDate.get(d)!.push(s)
  }
  const coPresenceCount = Array.from(byDate.values()).filter((group) => {
    const uniqueEntities = new Set(group.map((s) => (s.entity as { id: string } | null)?.id).filter(Boolean))
    return uniqueEntities.size > 1
  }).length

  const entities = Array.from(entityMap.values()).sort((a, b) => b.visit_count - a.visit_count)

  // Flight activity breakdown (for airports)
  const isAirport = location.location_type === 'airport'
  let flightDepartures = 0
  let flightArrivals = 0
  if (isAirport) {
    for (const s of allSightings) {
      if (s.sighting_type === 'flight_departure') flightDepartures++
      if (s.sighting_type === 'flight_arrival') flightArrivals++
    }
  }

  const owner = location.owner as { id: string; name: string; tier: number | null; category: string | null } | null

  return (
    <MainContent>
      <Breadcrumbs current={location.name as string} />

      {/* Hero */}
      <div className="mb-8">
        <div className="flex items-start gap-5">
          {/* Map pin icon */}
          <div className="w-16 h-16 rounded-full bg-elevated border border-border-default flex items-center justify-center shrink-0">
            <svg className="w-7 h-7 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-3xl font-bold text-text-primary">
                {location.name as string}
              </h1>
              <TypeBadge type={location.location_type as string | null} />
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {(location.address || location.city || location.state || location.country) && (
                <span className="text-sm text-text-secondary">
                  {[location.address, location.city, location.state, location.country]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              )}
              {owner && (
                <span className="text-sm text-text-muted">
                  Owned by{' '}
                  <Link href={`/dashboard/entities/${owner.id}`} className="text-info hover:text-info/80 transition-colors">
                    {owner.name}
                  </Link>
                </span>
              )}
            </div>
            {typeof location.description === 'string' && location.description && (
              <p className="text-sm text-text-muted italic mt-2">{location.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Total Sightings" value={allSightings.length} accent="#F59E0B" />
        <StatCard label="Unique Entities" value={entityMap.size} accent="#3B82F6" />
        <StatCard label="Co-Presence Events" value={coPresenceCount} accent="#DC2626" />
        <StatCard
          label="First Activity"
          value={firstActivity ? formatDate(firstActivity) : 'N/A'}
          accent="#10B981"
        />
        <StatCard
          label="Last Activity"
          value={lastActivity ? formatDate(lastActivity) : 'N/A'}
          accent="#8B5CF6"
        />
      </div>

      {/* Main layout: 2 col on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content (2 cols) */}
        <div className="lg:col-span-2">
          <LocationDetailTabs
            sightings={allSightings}
            entities={entities}
            isAirport={isAirport}
            flightDepartures={flightDepartures}
            flightArrivals={flightArrivals}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Facts */}
          <div className="bg-surface border border-border-default rounded-lg p-5">
            <h3 className="font-display text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">
              Quick Facts
            </h3>
            <dl className="space-y-4">
              {location.location_type && (
                <div>
                  <dt className="text-xs text-text-muted uppercase tracking-wider">Type</dt>
                  <dd className="text-sm text-text-primary mt-0.5 capitalize">
                    {(location.location_type as string).replace(/_/g, ' ')}
                  </dd>
                </div>
              )}

              {owner && (
                <div>
                  <dt className="text-xs text-text-muted uppercase tracking-wider">Owner</dt>
                  <dd className="mt-0.5">
                    <Link href={`/dashboard/entities/${owner.id}`} className="text-sm text-info hover:text-info/80 transition-colors">
                      {owner.name}
                    </Link>
                    {owner.tier && <TierBadge tier={owner.tier as Tier} size="sm" />}
                  </dd>
                </div>
              )}

              {location.address && (
                <div>
                  <dt className="text-xs text-text-muted uppercase tracking-wider">Address</dt>
                  <dd className="text-sm text-text-primary mt-0.5">{location.address as string}</dd>
                </div>
              )}

              {(location.city || location.state) && (
                <div>
                  <dt className="text-xs text-text-muted uppercase tracking-wider">City / State</dt>
                  <dd className="text-sm text-text-primary mt-0.5">
                    {[location.city, location.state].filter(Boolean).join(', ')}
                  </dd>
                </div>
              )}

              {location.country && (
                <div>
                  <dt className="text-xs text-text-muted uppercase tracking-wider">Country</dt>
                  <dd className="text-sm text-text-primary mt-0.5">{location.country as string}</dd>
                </div>
              )}

              {location.latitude && location.longitude && (
                <div>
                  <dt className="text-xs text-text-muted uppercase tracking-wider">Coordinates</dt>
                  <dd className="text-sm text-text-primary mt-0.5 font-mono text-xs">
                    {Number(location.latitude).toFixed(4)}, {Number(location.longitude).toFixed(4)}
                  </dd>
                </div>
              )}

              {firstActivity && (
                <div>
                  <dt className="text-xs text-text-muted uppercase tracking-wider">Activity Range</dt>
                  <dd className="text-sm text-text-primary mt-0.5">
                    {formatDate(firstActivity)} — {formatDate(lastActivity)}
                  </dd>
                </div>
              )}

              {Array.isArray(location.aliases) && (location.aliases as string[]).length > 0 && (
                <div>
                  <dt className="text-xs text-text-muted uppercase tracking-wider">Aliases</dt>
                  <dd className="space-y-1 mt-1">
                    {(location.aliases as string[]).map((alias) => (
                      <div key={alias} className="text-sm text-text-secondary">{alias}</div>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Flight Activity (airports only) */}
          {isAirport && (flightDepartures > 0 || flightArrivals > 0) && (
            <div className="bg-surface border border-border-default rounded-lg p-5">
              <h3 className="font-display text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">
                Flight Activity
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-secondary">Departures</span>
                  <span className="text-sm font-medium text-text-primary">{flightDepartures}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-secondary">Arrivals</span>
                  <span className="text-sm font-medium text-text-primary">{flightArrivals}</span>
                </div>
                <div className="border-t border-border-default pt-2 flex items-center justify-between">
                  <span className="text-xs text-text-muted">Total</span>
                  <span className="text-sm font-bold text-text-primary">{flightDepartures + flightArrivals}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainContent>
  )
}
