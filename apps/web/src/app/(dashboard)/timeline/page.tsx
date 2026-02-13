'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import MainContent from '@/components/layout/main-content'
import { PageHeader } from '@/components/ui/page-header'
import { SearchInput } from '@/components/ui/search-input'
import { FilterBar, type FilterDef } from '@/components/ui/filter-bar'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'
import { TierBadge } from '@/components/ui/tier-badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { Event, Entity, EntityEvent, Tier } from '@efta/shared'

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------

const PAGE_SIZE = 50

const EVENT_TYPE_OPTIONS = [
  { value: 'legal', label: 'Legal' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'communication', label: 'Communication' },
  { value: 'institutional', label: 'Institutional' },
  { value: 'personal', label: 'Personal' },
  { value: 'financial', label: 'Financial' },
  { value: 'legislative', label: 'Legislative' },
  { value: 'travel', label: 'Travel' },
  { value: 'sighting', label: 'Sighting' },
]

const FILTER_DEFS: FilterDef[] = [
  { key: 'event_type', label: 'Event Types', options: EVENT_TYPE_OPTIONS },
]

const EVENT_TYPE_COLORS: Record<string, string> = {
  legal: '#3B82F6',
  evidence: '#DC2626',
  communication: '#F59E0B',
  institutional: '#6B7280',
  personal: '#A855F7',
  financial: '#10B981',
  legislative: '#14B8A6',
  travel: '#F97316',
  sighting: '#EC4899',
}

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface LinkedEntity extends EntityEvent {
  entity: Entity
}

interface TimelineEvent extends Event {
  linked_entities: LinkedEntity[]
}

interface ApiResponse {
  data: TimelineEvent[]
  count: number
  page: number
  limit: number
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatMonthYear(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatLabel(str: string): string {
  return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Group events by month-year for section headers */
function groupByMonth(events: TimelineEvent[]): { label: string; events: TimelineEvent[] }[] {
  const groups: { label: string; events: TimelineEvent[] }[] = []
  let currentLabel = ''

  for (const event of events) {
    const label = event.date ? formatMonthYear(event.date) : 'Unknown Date'
    if (label !== currentLabel) {
      currentLabel = label
      groups.push({ label, events: [] })
    }
    groups[groups.length - 1].events.push(event)
  }

  return groups
}

// -------------------------------------------------------------------
// Page Component
// -------------------------------------------------------------------

export default function TimelinePage() {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, string | string[]>>({
    event_type: '',
  })
  const [page, setPage] = useState(1)
  const [data, setData] = useState<TimelineEvent[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchEvents = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(PAGE_SIZE))

      if (search) params.set('search', search)
      if (filters.event_type && typeof filters.event_type === 'string') params.set('event_type', filters.event_type)

      const response = await fetch(`/api/timeline?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch timeline')
      }

      const result: ApiResponse = await response.json()
      setData(result.data)
      setTotalCount(result.count)
    } catch {
      setData([])
      setTotalCount(0)
    } finally {
      setIsLoading(false)
    }
  }, [page, search, filters])

  useEffect(() => {
    void fetchEvents()
  }, [fetchEvents])

  const handleSearch = useCallback((query: string) => {
    setSearch(query)
    setPage(1)
  }, [])

  const handleFilterChange = useCallback((key: string, value: string | string[]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }, [])

  const groups = groupByMonth(data)

  return (
    <MainContent>
      <PageHeader
        title="Timeline"
        subtitle="Chronological events across the investigation"
      />

      {/* Filters */}
      <div className="mb-8 space-y-4">
        <FilterBar filters={FILTER_DEFS} values={filters} onChange={handleFilterChange} />
        <SearchInput placeholder="Search events..." onSearch={handleSearch} />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="w-24 h-4" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && data.length === 0 && (
        <EmptyState
          icon={
            <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
          title="No events found"
          description="No timeline events match your current filters. Try adjusting your search criteria."
        />
      )}

      {/* Timeline */}
      {!isLoading && data.length > 0 && (
        <div className="space-y-10">
          {groups.map((group) => (
            <div key={group.label}>
              {/* Month-year header */}
              <h3 className="font-display text-lg font-semibold text-text-primary mb-4 sticky top-0 bg-background/80 backdrop-blur-sm py-2 z-10">
                {group.label}
              </h3>

              {/* Events in this month */}
              <div className="relative ml-4 border-l-2 border-border-default">
                {group.events.map((event) => {
                  const typeColor = EVENT_TYPE_COLORS[event.event_type ?? ''] ?? '#6B7280'

                  return (
                    <div key={event.id} className="relative pl-8 pb-8 last:pb-0">
                      {/* Timeline dot */}
                      <span
                        className="absolute left-[-5px] top-1.5 w-2 h-2 rounded-full"
                        style={{ backgroundColor: typeColor }}
                      />

                      {/* Event card */}
                      <div className="bg-surface border border-border-default rounded-lg p-4">
                        {/* Header row */}
                        <div className="flex items-start gap-3 flex-wrap">
                          <h4 className="font-display text-sm font-semibold text-text-primary flex-1 min-w-0">
                            {event.title}
                          </h4>
                          {event.event_type && (
                            <span
                              className="text-xs font-medium uppercase tracking-wider px-2 py-0.5 rounded shrink-0"
                              style={{
                                color: typeColor,
                                backgroundColor: `${typeColor}15`,
                              }}
                            >
                              {formatLabel(event.event_type)}
                            </span>
                          )}
                        </div>

                        {/* Date */}
                        {event.date && (
                          <p className="text-xs font-mono text-text-muted mt-1">
                            {formatDate(event.date)}
                            {event.date_end && event.date_end !== event.date && (
                              <> &mdash; {formatDate(event.date_end)}</>
                            )}
                          </p>
                        )}

                        {/* Description */}
                        {event.description && (
                          <p className="text-sm text-text-secondary mt-2 leading-relaxed">
                            {event.description}
                          </p>
                        )}

                        {/* Significance */}
                        {event.significance && (
                          <p className="text-xs text-text-muted italic mt-2">
                            {event.significance}
                          </p>
                        )}

                        {/* Linked entities */}
                        {event.linked_entities.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border-default">
                            <span className="text-xs text-text-muted">Involves:</span>
                            {event.linked_entities.map((le) => (
                              <Link
                                key={le.id}
                                href={`/entities/${le.entity.id}`}
                                className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-info transition-colors"
                              >
                                <span className="font-medium">{le.entity.name}</span>
                                {le.entity.tier && (
                                  <TierBadge tier={le.entity.tier as Tier} size="sm" />
                                )}
                                {le.role && (
                                  <span className="text-text-muted">({le.role})</span>
                                )}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={Math.ceil(totalCount / PAGE_SIZE)}
        onPageChange={setPage}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        noun="events"
      />
    </MainContent>
  )
}
