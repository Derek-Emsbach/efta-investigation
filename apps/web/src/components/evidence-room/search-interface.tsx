'use client'

import { useState, useCallback } from 'react'

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

export function SearchInterface() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)

  // Filters
  const [activeType, setActiveType] = useState<string | null>(null)
  const [activeSeverity, setActiveSeverity] = useState<string | null>(null)

  const search = useCallback(async (searchQuery: string, newOffset = 0) => {
    if (searchQuery.trim().length < 2) return

    setIsLoading(true)
    setHasSearched(true)
    setOffset(newOffset)

    try {
      const params = new URLSearchParams({ q: searchQuery, offset: String(newOffset), limit: '20' })
      if (activeType) params.set('type', activeType)
      if (activeSeverity) params.set('severity', activeSeverity)

      const res = await fetch(`/api/public/evidence/search?${params}`)
      const data: SearchResponse = await res.json()

      if (newOffset === 0) {
        setResults(data.results)
      } else {
        setResults((prev) => [...prev, ...data.results])
      }
      setTotal(data.total)
    } catch {
      // Silent fail
    } finally {
      setIsLoading(false)
    }
  }, [activeType, activeSeverity])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    search(query, 0)
  }

  const toggleType = (type: string) => {
    setActiveType((prev) => (prev === type ? null : type))
  }

  const toggleSeverity = (sev: string) => {
    setActiveSeverity((prev) => (prev === sev ? null : sev))
  }

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
            placeholder="Search documents, Bates numbers, entities..."
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

        {/* Filter chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
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
        </div>
      </form>

      {/* Results */}
      {hasSearched && (
        <div className="mt-10 max-w-[800px] mx-auto">
          {/* Results header */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border-default">
            <span className="font-mono text-xs text-text-muted">
              {isLoading ? 'Searching...' : `${results.length} results`}
            </span>
          </div>

          {/* Result cards */}
          {results.length === 0 && !isLoading ? (
            <div className="py-16 text-center">
              <p className="font-mono text-sm text-text-muted">No documents found.</p>
              <p className="mt-2 font-body text-xs text-text-muted">
                Try different search terms or remove filters.
              </p>
            </div>
          ) : (
            <div className="space-y-0 divide-y divide-border-default">
              {results.map((doc) => (
                <ResultCard key={doc.id} doc={doc} query={query} />
              ))}
            </div>
          )}

          {/* Load more */}
          {results.length >= 20 && !isLoading && (
            <div className="mt-6 text-center">
              <button
                onClick={() => search(query, offset + 20)}
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

function ResultCard({ doc, query }: { doc: SearchResult; query: string }) {
  const typeColor = doc.document_type ? TYPE_COLORS[doc.document_type] ?? '#6b7585' : '#6b7585'
  const sevColor = doc.severity ? SEVERITY_COLORS[doc.severity] ?? '#6b7585' : '#6b7585'

  return (
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
