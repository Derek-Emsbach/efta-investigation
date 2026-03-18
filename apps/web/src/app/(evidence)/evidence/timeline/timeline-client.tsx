'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------

const PAGE_SIZE = 50

const EVENT_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'legal', label: 'Legal' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'communication', label: 'Communication' },
  { value: 'institutional', label: 'Institutional' },
  { value: 'personal', label: 'Personal' },
  { value: 'financial', label: 'Financial' },
  { value: 'legislative', label: 'Legislative' },
  { value: 'travel', label: 'Travel' },
  { value: 'sighting', label: 'Sighting' },
  { value: 'media', label: 'Media' },
  { value: 'community', label: 'Community' },
  { value: 'international', label: 'International' },
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
  media: '#8B5CF6',
  community: '#06B6D4',
  international: '#0EA5E9',
  other: '#6B7280',
}

const SOURCE_OPTIONS = [
  { value: '', label: 'All Events' },
  { value: 'investigation', label: 'Investigation' },
  { value: 'public', label: 'Public Record' },
] as const

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface LinkedEntity {
  name: string
  slug: string | null
  tier: number | null
  role: string | null
}

interface TimelineEvent {
  id: string
  title: string
  description: string | null
  date: string | null
  date_end: string | null
  event_type: string | null
  significance: string | null
  source?: 'investigation' | 'public'
  source_urls?: string[]
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
// Component
// -------------------------------------------------------------------

export function EvidenceTimelineClient() {
  const [eventType, setEventType] = useState('')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [source, setSource] = useState('')
  const [data, setData] = useState<TimelineEvent[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const pageRef = useRef(1)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Fetch a page of events — append=true for infinite scroll loads
  const fetchEvents = useCallback(async (pageNum: number, append: boolean) => {
    if (append) {
      setIsFetchingMore(true)
    } else {
      setIsLoading(true)
    }

    try {
      const params = new URLSearchParams()
      params.set('page', String(pageNum))
      params.set('limit', String(PAGE_SIZE))

      if (search) params.set('search', search)
      if (eventType) params.set('event_type', eventType)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      if (source) params.set('source', source)

      const res = await fetch(`/api/public/timeline?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch')

      const result: ApiResponse = await res.json()

      if (append) {
        setData((prev) => [...prev, ...result.data])
      } else {
        setData(result.data)
      }
      setTotalCount(result.count)
      setHasMore(pageNum * PAGE_SIZE < result.count)
    } catch {
      if (!append) {
        setData([])
        setTotalCount(0)
      }
      setHasMore(false)
    } finally {
      setIsLoading(false)
      setIsFetchingMore(false)
    }
  }, [search, eventType, dateFrom, dateTo, source])

  // Initial load + reset on filter change
  useEffect(() => {
    pageRef.current = 1
    setHasMore(true)
    void fetchEvents(1, false)
  }, [fetchEvents])

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isFetchingMore) {
          pageRef.current += 1
          void fetchEvents(pageRef.current, true)
        }
      },
      { rootMargin: '400px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isLoading, isFetchingMore, fetchEvents])

  const groups = useMemo(() => groupByMonth(data), [data])

  const hasFilters = eventType || search || dateFrom || dateTo || source

  // Reset helper for filters
  const resetFilters = () => {
    setEventType('')
    setSearch('')
    setDateFrom('')
    setDateTo('')
    setSource('')
  }

  return (
    <div className="min-h-[calc(100vh-120px)]">
      <div className="mx-auto max-w-5xl xl:max-w-newspaper px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold text-text-primary">Timeline</h1>
          <p className="mt-1 text-sm text-text-muted">
            {isLoading ? 'Loading...' : `${totalCount} events in chronological order`}
          </p>
        </div>

        {/* Source filter — segmented control */}
        <div className="flex items-center gap-1 mb-4 p-1 bg-surface rounded-lg border border-border-default w-fit">
          {SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSource(opt.value)}
              className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors ${
                source === opt.value
                  ? 'bg-background text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          {/* Event type */}
          <div className="relative">
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="appearance-none bg-surface border border-border-default rounded-lg text-text-primary text-sm px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-critical/30 focus:border-critical transition-colors cursor-pointer font-mono"
            >
              {EVENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events..."
              className="w-full bg-surface border border-border-default rounded-lg pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-critical/30 focus:border-critical transition-colors font-mono"
            />
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-muted font-mono">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-surface border border-border-default rounded-lg text-text-primary text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-critical/30 focus:border-critical transition-colors font-mono"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-muted font-mono">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-surface border border-border-default rounded-lg text-text-primary text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-critical/30 focus:border-critical transition-colors font-mono"
            />
          </div>

          {hasFilters && (
            <button
              onClick={resetFilters}
              className="text-xs text-text-muted hover:text-text-primary transition-colors font-mono"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Initial loading */}
        {isLoading && (
          <div className="space-y-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-24 h-4 bg-surface rounded animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-2/3 bg-surface rounded animate-pulse" />
                  <div className="h-4 w-full bg-surface rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && data.length === 0 && (
          <div className="text-center py-16">
            <svg className="h-10 w-10 text-text-muted mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <p className="text-sm text-text-muted font-mono mt-4">No events found</p>
            <p className="text-xs text-text-muted mt-1">Try adjusting your filters</p>
          </div>
        )}

        {/* Timeline */}
        {!isLoading && data.length > 0 && (
          <div className="space-y-10">
            {groups.map((group) => (
              <div key={group.label}>
                {/* Month header */}
                <h3 className="font-display text-lg font-semibold text-text-primary mb-4 sticky top-12 bg-background/80 backdrop-blur-sm py-2 z-10 border-b border-border-default">
                  {group.label}
                </h3>

                {/* Events */}
                <div className="relative ml-4 border-l-2 border-border-default">
                  {group.events.map((event) => {
                    const typeColor = EVENT_TYPE_COLORS[event.event_type ?? ''] ?? '#6B7280'
                    const isPublic = event.source === 'public'

                    return (
                      <div key={event.id} className="relative pl-8 pb-6 last:pb-0">
                        {/* Dot */}
                        <span
                          className="absolute left-[-5px] top-2 w-2 h-2 rounded-full"
                          style={{ backgroundColor: typeColor }}
                        />

                        {/* Card */}
                        <div className={`bg-surface border rounded-lg p-4 ${
                          isPublic
                            ? 'border-border-default border-l-2'
                            : 'border-border-default'
                        }`} style={isPublic ? { borderLeftColor: '#06B6D4' } : undefined}>
                          <div className="flex items-start gap-3 flex-wrap">
                            <h4 className="text-sm font-medium text-text-primary flex-1 min-w-0">
                              {event.title}
                            </h4>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isPublic && (
                                <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#06B6D4]/10 text-[#06B6D4]">
                                  Public Record
                                </span>
                              )}
                              {event.event_type && (
                                <span
                                  className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded"
                                  style={{ color: typeColor, backgroundColor: `${typeColor}15` }}
                                >
                                  {formatLabel(event.event_type)}
                                </span>
                              )}
                            </div>
                          </div>

                          {event.date && (
                            <p className="text-xs font-mono text-text-muted mt-1">
                              {formatDate(event.date)}
                              {event.date_end && event.date_end !== event.date && (
                                <> — {formatDate(event.date_end)}</>
                              )}
                            </p>
                          )}

                          {event.description && (
                            <p className="text-sm text-text-secondary mt-2 leading-relaxed">
                              {event.description}
                            </p>
                          )}

                          {event.significance && (
                            <p className="text-xs text-text-muted italic mt-2">{event.significance}</p>
                          )}

                          {/* Source URLs (public events only) */}
                          {isPublic && event.source_urls && event.source_urls.length > 0 && (
                            <div className="flex items-center gap-3 mt-2">
                              {event.source_urls.map((url, idx) => (
                                <a
                                  key={idx}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] font-mono text-text-muted hover:text-[#06B6D4] transition-colors"
                                >
                                  Source {event.source_urls!.length > 1 ? idx + 1 : ''} ↗
                                </a>
                              ))}
                            </div>
                          )}

                          {/* Linked entities */}
                          {event.linked_entities.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border-default">
                              <span className="text-xs text-text-muted font-mono">Involves:</span>
                              {event.linked_entities.map((le, idx) => (
                                le.slug ? (
                                  <Link
                                    key={idx}
                                    href={`/evidence/entities/${le.slug}`}
                                    className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-critical transition-colors"
                                  >
                                    <span className="font-medium">{le.name}</span>
                                    {le.tier && (
                                      <span className="text-[10px] text-text-muted font-mono">T{le.tier}</span>
                                    )}
                                  </Link>
                                ) : (
                                  <span key={idx} className="text-xs text-text-muted">
                                    {le.name}
                                  </span>
                                )
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

        {/* Infinite scroll sentinel + loading indicator */}
        <div ref={sentinelRef} className="h-1" />
        {isFetchingMore && (
          <div className="flex items-center justify-center gap-2 py-8">
            <div className="h-1.5 w-1.5 rounded-full bg-text-muted animate-pulse" />
            <div className="h-1.5 w-1.5 rounded-full bg-text-muted animate-pulse [animation-delay:150ms]" />
            <div className="h-1.5 w-1.5 rounded-full bg-text-muted animate-pulse [animation-delay:300ms]" />
          </div>
        )}

        {/* End of timeline indicator */}
        {!isLoading && !hasMore && data.length > 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-text-muted font-mono">
              {totalCount} events loaded
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
