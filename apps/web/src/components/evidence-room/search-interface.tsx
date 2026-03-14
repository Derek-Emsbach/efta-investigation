'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import type { CorpusSearchHit, CorpusEnrichment, CorpusSearchResponse } from '@efta/shared'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResult {
  id: string
  bates_number: string | null
  title: string | null
  document_type: string | null
  original_date: string | null
  severity: string | null
  page_count: number | null
  summary: string | null
  dataset_id: string | null
  excerpt: string
}

interface SearchResponse {
  results: SearchResult[]
  query: string
  total: number
  offset: number
  limit: number
}

type SearchMode = 'database' | 'corpus'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<string, string> = {
  email: 'Email',
  fbi_302: 'FBI 302',
  financial: 'Financial',
  photo: 'Photo',
  memo: 'Memo',
  prosecution_memo: 'Prosecution',
  court_filing: 'Court Filing',
  victim_journal: 'Journal',
  senate_letter: 'Senate Letter',
  legal_report: 'Legal Report',
  call_notes: 'Call Notes',
  blank: 'Blank',
}

const TYPE_COLORS: Record<string, string> = {
  email: '#60a5fa',
  fbi_302: '#e63950',
  financial: '#34d399',
  photo: '#a78bfa',
  memo: '#f59e0b',
  prosecution_memo: '#e63950',
  court_filing: '#60a5fa',
  victim_journal: '#f59e0b',
  senate_letter: '#22d3ee',
  legal_report: '#60a5fa',
  call_notes: '#34d399',
}

const SEVERITY_COLORS: Record<string, string> = {
  extreme_critical: '#e63950',
  critical: '#ef4444',
  high: '#f59e0b',
  routine: '#6b7585',
}

const FILTER_TYPES = ['email', 'fbi_302', 'financial', 'memo', 'court_filing', 'prosecution_memo', 'photo']
const FILTER_SEVERITY = ['extreme_critical', 'critical', 'high', 'routine']
const DATASETS = Array.from({ length: 12 }, (_, i) => i + 1)

const MODE_DESCRIPTIONS: Record<SearchMode, string> = {
  database: 'Searches document metadata (titles, summaries, Bates numbers)',
  corpus: 'Searches 2.77M pages of OCR-extracted text across all 12 DOJ datasets',
}

// DOJ PDF URL builder (mirrors corpus-db.ts logic, client-safe)
const DATASET_RANGES = [
  { ds: 1, min: 1, max: 4521 },
  { ds: 2, min: 4522, max: 5586 },
  { ds: 3, min: 5705, max: 69044 },
  { ds: 4, min: 69045, max: 90321 },
  { ds: 5, min: 90322, max: 96905 },
  { ds: 6, min: 96906, max: 107252 },
  { ds: 7, min: 107253, max: 117395 },
  { ds: 8, min: 117396, max: 176563 },
  { ds: 9, min: 176564, max: 1243099 },
  { ds: 10, min: 1243100, max: 1524192 },
  { ds: 11, min: 1524193, max: 2640992 },
  { ds: 12, min: 2640993, max: 2858497 },
]

function dojPdfUrl(efta: string): string {
  const padded = efta.replace(/^EFTA/, '')
  const num = parseInt(padded, 10)
  const range = DATASET_RANGES.find((r) => num >= r.min && num <= r.max)
  return `https://www.justice.gov/epstein/files/DataSet%20${range?.ds ?? 1}/EFTA${padded}.pdf`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SearchInterface() {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<SearchMode>('database')
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Database mode state
  const [results, setResults] = useState<SearchResult[]>([])
  const [activeType, setActiveType] = useState<string | null>(null)
  const [activeSeverity, setActiveSeverity] = useState<string | null>(null)

  // Corpus mode state
  const [corpusResults, setCorpusResults] = useState<CorpusSearchHit[]>([])
  const [enrichment, setEnrichment] = useState<Record<string, CorpusEnrichment>>({})
  const [activeDataset, setActiveDataset] = useState<number | null>(null)

  const searchDatabase = useCallback(async (searchQuery: string, newOffset: number) => {
    const params = new URLSearchParams({ q: searchQuery, offset: String(newOffset), limit: '20' })
    if (activeType) params.set('type', activeType)
    if (activeSeverity) params.set('severity', activeSeverity)

    const res = await fetch(`/api/public/evidence/search?${params}`)
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Search failed')
    }
    const data: SearchResponse = await res.json()

    if (newOffset === 0) {
      setResults(data.results)
    } else {
      setResults((prev) => [...prev, ...data.results])
    }
    setCorpusResults([])
    setTotal(data.total)
  }, [activeType, activeSeverity])

  const searchCorpus = useCallback(async (searchQuery: string, newOffset: number) => {
    const params = new URLSearchParams({ q: searchQuery, offset: String(newOffset), limit: '20' })
    if (activeDataset) params.set('dataset', String(activeDataset))

    const res = await fetch(`/api/public/evidence/corpus-search?${params}`)
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Corpus search failed')
    }
    const data: CorpusSearchResponse = await res.json()

    if (newOffset === 0) {
      setCorpusResults(data.results)
      setEnrichment(data.enrichment)
    } else {
      setCorpusResults((prev) => [...prev, ...data.results])
      setEnrichment((prev) => ({ ...prev, ...data.enrichment }))
    }
    setResults([])
    setTotal(data.total)
  }, [activeDataset])

  const search = useCallback(async (searchQuery: string, newOffset = 0) => {
    if (searchQuery.trim().length < 2) return

    setIsLoading(true)
    setHasSearched(true)
    setOffset(newOffset)
    setError(null)

    try {
      if (mode === 'corpus') {
        await searchCorpus(searchQuery, newOffset)
      } else {
        await searchDatabase(searchQuery, newOffset)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setIsLoading(false)
    }
  }, [mode, searchDatabase, searchCorpus])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    search(query, 0)
  }

  const switchMode = (newMode: SearchMode) => {
    if (newMode === mode) return
    setMode(newMode)
    setHasSearched(false)
    setResults([])
    setCorpusResults([])
    setEnrichment({})
    setTotal(0)
    setOffset(0)
    setError(null)
  }

  const toggleType = (type: string) => {
    setActiveType((prev) => (prev === type ? null : type))
  }

  const toggleSeverity = (sev: string) => {
    setActiveSeverity((prev) => (prev === sev ? null : sev))
  }

  const toggleDataset = (ds: number) => {
    setActiveDataset((prev) => (prev === ds ? null : ds))
  }

  const currentResults = mode === 'corpus' ? corpusResults : results
  const pageSize = 20

  return (
    <div>
      {/* Search input */}
      <form onSubmit={handleSubmit} className="mx-auto max-w-[800px]">
        <div className="flex items-center border border-border-default bg-surface transition-colors focus-within:border-critical">
          <svg className="w-4 h-4 text-text-muted ml-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === 'corpus'
              ? 'Search full corpus text... (supports "exact phrase", AND, OR, NOT)'
              : 'Search documents, Bates numbers, entities...'}
            data-no-focus-ring
            className="flex-1 bg-transparent px-3 py-3 font-mono text-sm text-text-primary placeholder:text-text-muted outline-none"
          />
          <button
            type="submit"
            disabled={isLoading || query.trim().length < 2}
            className="px-5 py-3 bg-critical text-white font-mono text-xs font-semibold uppercase tracking-wider hover:bg-[#d42d47] disabled:opacity-40 transition-colors"
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Mode toggle */}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => switchMode('database')}
            className={`font-mono text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5 border transition-colors ${
              mode === 'database'
                ? 'bg-critical/20 border-critical text-critical'
                : 'border-border-default text-text-muted hover:border-text-muted'
            }`}
          >
            Database
          </button>
          <button
            type="button"
            onClick={() => switchMode('corpus')}
            className={`font-mono text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5 border transition-colors ${
              mode === 'corpus'
                ? 'bg-critical/20 border-critical text-critical'
                : 'border-border-default text-text-muted hover:border-text-muted'
            }`}
          >
            Full Corpus
          </button>
          <span className="font-mono text-[9px] text-text-muted ml-2">
            {MODE_DESCRIPTIONS[mode]}
          </span>
        </div>

        {/* Filters — conditional on mode */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {mode === 'database' ? (
            <>
              {FILTER_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
                  className={`font-mono text-[10px] font-medium uppercase tracking-wider px-2.5 py-1 border transition-colors ${
                    activeType === type
                      ? 'bg-critical/20 border-critical text-critical'
                      : 'border-border-default text-text-muted hover:border-text-muted'
                  }`}
                >
                  {TYPE_LABELS[type] ?? type}
                </button>
              ))}
              <span className="w-px h-5 bg-border-default self-center mx-1" />
              {FILTER_SEVERITY.map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => toggleSeverity(sev)}
                  className={`font-mono text-[10px] font-medium uppercase tracking-wider px-2.5 py-1 border transition-colors ${
                    activeSeverity === sev
                      ? 'bg-critical/20 border-critical text-critical'
                      : 'border-border-default text-text-muted hover:border-text-muted'
                  }`}
                >
                  {sev === 'extreme_critical' ? 'Extreme' : sev}
                </button>
              ))}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setActiveDataset(null)}
                className={`font-mono text-[10px] font-medium uppercase tracking-wider px-2.5 py-1 border transition-colors ${
                  activeDataset === null
                    ? 'bg-critical/20 border-critical text-critical'
                    : 'border-border-default text-text-muted hover:border-text-muted'
                }`}
              >
                All
              </button>
              {DATASETS.map((ds) => (
                <button
                  key={ds}
                  type="button"
                  onClick={() => toggleDataset(ds)}
                  className={`font-mono text-[10px] font-medium uppercase tracking-wider px-2.5 py-1 border transition-colors ${
                    activeDataset === ds
                      ? 'bg-critical/20 border-critical text-critical'
                      : 'border-border-default text-text-muted hover:border-text-muted'
                  }`}
                >
                  DS {ds}
                </button>
              ))}
            </>
          )}
        </div>
      </form>

      {/* Error display */}
      {error && (
        <div className="mt-6 max-w-[800px] mx-auto">
          <div className="border border-critical/30 bg-critical/5 px-4 py-3">
            <p className="font-mono text-xs text-critical">{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {hasSearched && !error && (
        <div className="mt-10 max-w-[800px] mx-auto">
          {/* Results header */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border-default">
            <span className="font-mono text-xs text-text-muted">
              {isLoading ? 'Searching...' : `${currentResults.length} results`}
            </span>
            {mode === 'corpus' && !isLoading && currentResults.length > 0 && (
              <span className="font-mono text-[9px] text-text-muted">
                Page-level matches from FTS5 corpus
              </span>
            )}
          </div>

          {/* Result cards */}
          {currentResults.length === 0 && !isLoading ? (
            <div className="py-16 text-center">
              <p className="font-mono text-sm text-text-muted">
                {mode === 'corpus' ? 'No pages found.' : 'No documents found.'}
              </p>
              <p className="mt-2 font-body text-xs text-text-muted">
                {mode === 'corpus'
                  ? 'Try different search terms. Use quotes for exact phrases: "leon black"'
                  : 'Try different search terms or remove filters.'}
              </p>
            </div>
          ) : (
            <div className="space-y-0 divide-y divide-border-default">
              {mode === 'corpus'
                ? corpusResults.map((hit, i) => (
                    <CorpusResultCard
                      key={`${hit.efta_number}-${hit.page_number}-${i}`}
                      hit={hit}
                      enrichment={enrichment[hit.efta_number]}
                    />
                  ))
                : results.map((doc) => (
                    <ResultCard key={doc.id} doc={doc} query={query} />
                  ))}
            </div>
          )}

          {/* Load more */}
          {currentResults.length >= pageSize && !isLoading && (
            <div className="mt-6 text-center">
              <button
                onClick={() => search(query, offset + pageSize)}
                className="font-mono text-xs text-text-muted border border-border-default px-4 py-2 hover:text-text-primary hover:border-text-muted transition-colors"
              >
                Load more results
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Database Result Card (existing)
// ---------------------------------------------------------------------------

function ResultCard({ doc, query }: { doc: SearchResult; query: string }) {
  const typeColor = doc.document_type ? TYPE_COLORS[doc.document_type] ?? '#6b7585' : '#6b7585'
  const sevColor = doc.severity ? SEVERITY_COLORS[doc.severity] ?? '#6b7585' : '#6b7585'

  const content = (
    <div className="py-4 hover:bg-surface/50 transition-colors">
      {/* Top row: Bates + badges */}
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        {doc.bates_number && (
          <span className="font-mono text-xs font-semibold text-neon-blue">
            {doc.bates_number}
          </span>
        )}
        {doc.document_type && (
          <span
            className="font-mono text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5"
            style={{ color: typeColor, backgroundColor: `${typeColor}20` }}
          >
            {TYPE_LABELS[doc.document_type] ?? doc.document_type}
          </span>
        )}
        {doc.severity && doc.severity !== 'routine' && (
          <span
            className="font-mono text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5"
            style={{ color: sevColor, backgroundColor: `${sevColor}20` }}
          >
            {doc.severity === 'extreme_critical' ? 'EXTREME' : doc.severity}
          </span>
        )}
        {doc.page_count && (
          <span className="font-mono text-[9px] text-text-muted ml-auto">
            {doc.page_count} pg
          </span>
        )}
      </div>

      {/* Title */}
      <div className="font-body text-[15px] font-semibold text-text-primary">
        {doc.title || doc.bates_number || 'Untitled'}
      </div>

      {/* Excerpt with highlight */}
      {doc.excerpt && (
        <p
          className="mt-1.5 font-body text-[13px] text-text-muted leading-relaxed line-clamp-3"
          dangerouslySetInnerHTML={{
            __html: highlightTerms(doc.excerpt, query),
          }}
        />
      )}

      {/* Meta row */}
      <div className="mt-2 flex items-center gap-3 text-text-muted">
        {doc.original_date && (
          <span className="font-mono text-[10px]">{doc.original_date}</span>
        )}
      </div>
    </div>
  )

  if (doc.bates_number) {
    return (
      <Link href={`/evidence/documents/${doc.bates_number}`} className="block">
        {content}
      </Link>
    )
  }

  return content
}

// ---------------------------------------------------------------------------
// Corpus Result Card (new)
// ---------------------------------------------------------------------------

function CorpusResultCard({
  hit,
  enrichment,
}: {
  hit: CorpusSearchHit
  enrichment: CorpusEnrichment | undefined
}) {
  const hasEnrichment = !!enrichment
  const typeColor = enrichment?.document_type ? TYPE_COLORS[enrichment.document_type] ?? '#6b7585' : '#6b7585'
  const sevColor = enrichment?.severity ? SEVERITY_COLORS[enrichment.severity] ?? '#6b7585' : '#6b7585'

  const content = (
    <div className="py-4 hover:bg-surface/50 transition-colors">
      {/* Top row: EFTA + page + dataset */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="font-mono text-xs font-semibold text-neon-blue">
          {hit.efta_number}
        </span>
        <span className="font-mono text-[10px] text-text-muted">
          PAGE {hit.page_number}
        </span>
        {hit.dataset && (
          <span className="font-mono text-[9px] font-medium text-text-muted border border-border-default px-1.5 py-0.5 ml-auto">
            DS {hit.dataset}
          </span>
        )}
      </div>

      {/* Snippet */}
      <p
        className="font-mono text-[13px] text-text-secondary leading-relaxed line-clamp-4 whitespace-pre-wrap"
        dangerouslySetInnerHTML={{
          __html: formatCorpusSnippet(hit.snippet),
        }}
      />

      {/* Enrichment row */}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        {hasEnrichment ? (
          <>
            {enrichment.document_type && (
              <span
                className="font-mono text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5"
                style={{ color: typeColor, backgroundColor: `${typeColor}20` }}
              >
                {TYPE_LABELS[enrichment.document_type] ?? enrichment.document_type}
              </span>
            )}
            {enrichment.severity && enrichment.severity !== 'routine' && (
              <span
                className="font-mono text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5"
                style={{ color: sevColor, backgroundColor: `${sevColor}20` }}
              >
                {enrichment.severity === 'extreme_critical' ? 'EXTREME' : enrichment.severity}
              </span>
            )}
            {enrichment.original_date && (
              <span className="font-mono text-[10px] text-text-muted">
                {enrichment.original_date}
              </span>
            )}
            {enrichment.page_count && (
              <span className="font-mono text-[10px] text-text-muted">
                {enrichment.page_count} pg
              </span>
            )}
            {enrichment.entities.length > 0 && (
              <span className="font-mono text-[9px] text-neon-blue ml-auto">
                {enrichment.entities.length} {enrichment.entities.length === 1 ? 'entity' : 'entities'}
              </span>
            )}
          </>
        ) : (
          <span className="font-mono text-[9px] text-text-muted italic">
            Not yet cataloged
          </span>
        )}
      </div>
    </div>
  )

  // Link to evidence room doc page if in Supabase, otherwise DOJ PDF
  if (hasEnrichment) {
    return (
      <Link href={`/evidence/documents/${hit.efta_number}`} className="block">
        {content}
      </Link>
    )
  }

  return (
    <a href={dojPdfUrl(hit.efta_number)} target="_blank" rel="noopener noreferrer" className="block">
      {content}
    </a>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCorpusSnippet(snippet: string): string {
  // Escape HTML first, then replace FTS5 markers with highlight tags
  let result = escapeHtml(snippet)
  result = result.replace(/&gt;&gt;&gt;/g, '<mark class="bg-critical/20 text-critical font-semibold px-0.5">')
  result = result.replace(/&lt;&lt;&lt;/g, '</mark>')
  return result
}

function highlightTerms(text: string, query: string): string {
  if (!query) return escapeHtml(text)
  const words = query.split(/\s+/).filter((w) => w.length > 1)
  let result = escapeHtml(text)
  for (const word of words) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${escaped})`, 'gi')
    result = result.replace(regex, '<mark class="bg-critical/20 text-critical px-0.5">$1</mark>')
  }
  return result
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
