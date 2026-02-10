'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import MainContent from '@/components/layout/main-content'
import { TierBadge } from '@/components/ui/tier-badge'
import { SeverityMarker } from '@/components/ui/severity-marker'
import { Skeleton } from '@/components/ui/skeleton'
import type { Entity, Document, Event, Tier, Severity } from '@efta/shared'

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface SearchResults {
  entities: Partial<Entity>[]
  documents: Partial<Document>[]
  events: Partial<Event>[]
  query: string
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatLabel(str: string): string {
  return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// -------------------------------------------------------------------
// Page
// -------------------------------------------------------------------

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const executeSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim()
    if (!trimmed) {
      setResults(null)
      setHasSearched(false)
      return
    }

    setIsLoading(true)
    setHasSearched(true)

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
      if (!response.ok) throw new Error('Search failed')
      const data: SearchResults = await response.json()
      setResults(data)
    } catch {
      setResults({ entities: [], documents: [], events: [], query: trimmed })
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      void executeSearch(query)
    },
    [query, executeSearch]
  )

  const totalResults = results
    ? results.entities.length + results.documents.length + results.events.length
    : 0

  return (
    <MainContent>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-text-primary mb-2">
          Search
        </h1>
        <p className="text-sm text-text-muted">
          Search across entities, documents, and timeline events
        </p>
      </div>

      {/* Search input */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for entities, documents, events..."
            className="w-full rounded-lg border border-border-default bg-surface px-4 py-3 pl-11 text-sm text-text-primary placeholder:text-text-muted focus:border-info focus:outline-none focus:ring-2 focus:ring-info/30 transition-colors"
            autoFocus
          />
          {/* Search icon */}
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {/* Submit button */}
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-medium rounded bg-info text-white hover:bg-info/80 transition-colors"
          >
            Search
          </button>
        </div>
      </form>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="w-16 h-4" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!isLoading && results && (
        <div>
          {/* Result count */}
          <p className="text-sm text-text-muted mb-6">
            {totalResults === 0
              ? `No results found for "${results.query}"`
              : `${totalResults} result${totalResults === 1 ? '' : 's'} for "${results.query}"`}
          </p>

          {/* Entity results */}
          {results.entities.length > 0 && (
            <ResultSection
              title="Entities"
              count={results.entities.length}
              icon={
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
            >
              {results.entities.map((entity) => (
                <Link
                  key={entity.id}
                  href={`/entities/${entity.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-elevated/50 transition-colors"
                >
                  <span className="font-display font-medium text-text-primary text-sm">
                    {entity.name}
                  </span>
                  {entity.tier && <TierBadge tier={entity.tier as Tier} size="sm" />}
                  {entity.category && (
                    <span className="text-xs text-text-muted uppercase tracking-wider">
                      {formatLabel(entity.category)}
                    </span>
                  )}
                  {entity.status && (
                    <StatusBadge status={entity.status} />
                  )}
                  <span className="text-xs text-text-muted ml-auto capitalize">
                    {entity.entity_type}
                  </span>
                </Link>
              ))}
            </ResultSection>
          )}

          {/* Document results */}
          {results.documents.length > 0 && (
            <ResultSection
              title="Documents"
              count={results.documents.length}
              icon={
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              }
            >
              {results.documents.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/documents/${doc.id}`}
                  className="block px-5 py-3.5 hover:bg-elevated/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {doc.bates_number && (
                      <span className="font-mono text-sm font-medium text-info">
                        {doc.bates_number}
                      </span>
                    )}
                    {doc.document_type && (
                      <span className="text-xs font-medium uppercase tracking-wider text-text-muted bg-elevated px-2 py-0.5 rounded">
                        {formatLabel(doc.document_type)}
                      </span>
                    )}
                    {doc.severity && (
                      <span className="ml-auto shrink-0">
                        <SeverityMarker severity={doc.severity as Severity} />
                      </span>
                    )}
                  </div>
                  {doc.title && (
                    <p className="text-sm text-text-primary mt-1">{doc.title}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    {doc.original_date && (
                      <span className="text-xs text-text-muted">{formatDate(doc.original_date)}</span>
                    )}
                    {doc.summary && (
                      <p className="text-xs text-text-muted line-clamp-1 flex-1">{doc.summary}</p>
                    )}
                  </div>
                </Link>
              ))}
            </ResultSection>
          )}

          {/* Event results */}
          {results.events.length > 0 && (
            <ResultSection
              title="Timeline Events"
              count={results.events.length}
              icon={
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              }
            >
              {results.events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-4 px-5 py-3.5"
                >
                  {event.date && (
                    <span className="text-xs font-mono text-text-muted shrink-0 w-24">
                      {formatDate(event.date)}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">
                        {event.title}
                      </span>
                      {event.event_type && (
                        <span className="text-xs font-medium uppercase tracking-wider text-text-muted bg-elevated px-2 py-0.5 rounded">
                          {formatLabel(event.event_type)}
                        </span>
                      )}
                    </div>
                    {event.description && (
                      <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{event.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </ResultSection>
          )}
        </div>
      )}

      {/* Empty initial state */}
      {!isLoading && !hasSearched && (
        <div className="py-16 text-center">
          <svg
            className="w-12 h-12 text-text-muted mx-auto mb-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <p className="text-sm text-text-muted">
            Search across {' '}
            <span className="text-text-secondary">entities</span>,{' '}
            <span className="text-text-secondary">documents</span>, and{' '}
            <span className="text-text-secondary">timeline events</span>
          </p>
          <p className="text-xs text-text-muted mt-2">
            Try &ldquo;Leon Black&rdquo;, &ldquo;prosecution&rdquo;, or &ldquo;victim journal&rdquo;
          </p>
        </div>
      )}
    </MainContent>
  )
}

// -------------------------------------------------------------------
// Sub-components
// -------------------------------------------------------------------

function ResultSection({
  title,
  count,
  icon,
  children,
}: {
  title: string
  count: number
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-text-muted">{icon}</span>
        <h3 className="font-display text-sm font-semibold text-text-primary uppercase tracking-wider">
          {title}
        </h3>
        <span className="text-xs bg-elevated text-text-muted rounded-full px-1.5 py-0.5">
          {count}
        </span>
      </div>
      <div className="bg-surface border border-border-default rounded-lg divide-y divide-border-default">
        {children}
      </div>
    </section>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    convicted: 'bg-critical/10 text-critical',
    not_investigated: 'bg-warning/10 text-warning',
    settled: 'bg-info/10 text-info',
    identified: 'bg-text-secondary/10 text-text-secondary',
    deceased: 'bg-text-muted/10 text-text-muted',
    active: 'bg-success/10 text-success',
    unknown: 'bg-text-muted/10 text-text-muted',
  }

  return (
    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded ${colorMap[status] ?? 'bg-text-muted/10 text-text-muted'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}
