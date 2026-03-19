'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import type { SortState, SortDirection } from '@/components/ui/data-table'

export interface ReviewFilters {
  typeFilter: string[]
  severityFilter: string[]
  classificationFilter: string[]
  datasetId: string | null
  entityId: string | null
  entityName: string | null
  dateFrom: string
  dateTo: string
  minPages: string
  maxPages: string
}

interface QueueControlsProps {
  sortStack: SortState[]
  onSortChange: (stack: SortState[]) => void
  filters: ReviewFilters
  onFiltersChange: (filters: ReviewFilters) => void
  totalCount: number
  filteredCount: number
}

interface DatasetOption {
  id: string
  number: number
  name: string
}

interface EntityResult {
  id: string
  name: string
  tier: number
}

const SORT_OPTIONS = [
  { key: 'bates_number', label: 'Bates #' },
  { key: 'document_type', label: 'Type' },
  { key: 'page_count', label: 'Pages' },
  { key: 'severity', label: 'Severity' },
  { key: 'processing_status', label: 'Status' },
] as const

const DOC_TYPE_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'fbi_302', label: 'FBI 302' },
  { value: 'financial', label: 'Financial' },
  { value: 'photo', label: 'Photo' },
  { value: 'memo', label: 'Memo' },
  { value: 'prosecution_memo', label: 'Prosecution Memo' },
  { value: 'court_filing', label: 'Court Filing' },
  { value: 'victim_journal', label: 'Victim Journal' },
  { value: 'senate_letter', label: 'Senate Letter' },
  { value: 'legal_report', label: 'Legal Report' },
  { value: 'call_notes', label: 'Call Notes' },
  { value: 'blank', label: 'Blank' },
]

const SEVERITY_OPTIONS = [
  { value: 'extreme_critical', label: 'Extreme Critical' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'routine', label: 'Routine' },
]

const CLASSIFICATION_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const activeFilterCount = (f: ReviewFilters): number => {
  let n = 0
  if (f.typeFilter.length > 0) n++
  if (f.severityFilter.length > 0) n++
  if (f.classificationFilter.length > 0) n++
  if (f.datasetId) n++
  if (f.entityId) n++
  if (f.dateFrom || f.dateTo) n++
  if (f.minPages || f.maxPages) n++
  return n
}

export const emptyFilters: ReviewFilters = {
  typeFilter: [],
  severityFilter: [],
  classificationFilter: [],
  datasetId: null,
  entityId: null,
  entityName: null,
  dateFrom: '',
  dateTo: '',
  minPages: '',
  maxPages: '',
}

export function QueueControls({ sortStack, onSortChange, filters, onFiltersChange, totalCount, filteredCount }: QueueControlsProps) {
  const [sortOpen, setSortOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)
  const filterRef = useRef<HTMLDivElement>(null)

  // Dataset options
  const [datasets, setDatasets] = useState<DatasetOption[]>([])
  useEffect(() => {
    fetch('/api/datasets')
      .then((r) => r.json())
      .then((d) => setDatasets(d.data ?? []))
      .catch(() => {})
  }, [])

  // Entity typeahead
  const [entityQuery, setEntityQuery] = useState('')
  const [entityResults, setEntityResults] = useState<EntityResult[]>([])
  const [entitySearching, setEntitySearching] = useState(false)
  const entityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (entityQuery.length < 2) {
      setEntityResults([])
      return
    }
    if (entityTimerRef.current) clearTimeout(entityTimerRef.current)
    entityTimerRef.current = setTimeout(async () => {
      setEntitySearching(true)
      try {
        const res = await fetch(`/api/entities?search=${encodeURIComponent(entityQuery)}&limit=10`)
        const json = await res.json()
        setEntityResults((json.data ?? []).map((e: Record<string, unknown>) => ({
          id: e.id as string,
          name: e.name as string,
          tier: e.tier as number,
        })))
      } catch {
        setEntityResults([])
      } finally {
        setEntitySearching(false)
      }
    }, 300)
  }, [entityQuery])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false)
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSortClick = useCallback((key: string) => {
    onSortChange((() => {
      const idx = sortStack.findIndex((s) => s.key === key)
      if (idx !== -1) {
        const existing = sortStack[idx]
        if (existing.direction === 'asc') {
          const next = [...sortStack]
          next[idx] = { key, direction: 'desc' as SortDirection }
          return next
        }
        return sortStack.filter((_, i) => i !== idx)
      }
      if (sortStack.length < 2) {
        return [...sortStack, { key, direction: 'asc' as SortDirection }]
      }
      return [...sortStack.slice(0, -1), { key, direction: 'asc' as SortDirection }]
    })())
    setSortOpen(false)
  }, [sortStack, onSortChange])

  const update = useCallback((patch: Partial<ReviewFilters>) => {
    onFiltersChange({ ...filters, ...patch })
  }, [filters, onFiltersChange])

  const toggleMulti = useCallback((field: 'typeFilter' | 'severityFilter' | 'classificationFilter', value: string) => {
    const current = filters[field]
    if (current.includes(value)) {
      update({ [field]: current.filter((v) => v !== value) })
    } else {
      update({ [field]: [...current, value] })
    }
  }, [filters, update])

  const filterCount = activeFilterCount(filters)

  return (
    <div className="border-b border-border-default">
      {/* Top row: Sort + Filter toggle */}
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        {/* Sort dropdown */}
        <div ref={sortRef} className="relative">
          <button
            onClick={() => { setSortOpen(!sortOpen); setFilterOpen(false) }}
            className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-1 rounded transition-colors ${
              sortStack.length > 0
                ? 'bg-info/10 text-info'
                : 'text-text-muted hover:bg-elevated hover:text-text-secondary'
            }`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h7M3 12h5M3 17h3M16 3v18M16 3l4 4M16 3l-4 4" />
            </svg>
            Sort{sortStack.length > 0 && <span className="text-[9px]">({sortStack.length})</span>}
          </button>

          {sortOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-surface border border-border-default rounded-lg shadow-lg py-1 min-w-[140px]">
              {SORT_OPTIONS.map((opt) => {
                const idx = sortStack.findIndex((s) => s.key === opt.key)
                const isActive = idx !== -1
                const dir = isActive ? sortStack[idx].direction : null

                return (
                  <button
                    key={opt.key}
                    onClick={() => handleSortClick(opt.key)}
                    className={`w-full text-left px-3 py-1.5 text-[11px] flex items-center justify-between gap-2 transition-colors ${
                      isActive ? 'text-info bg-info/5' : 'text-text-secondary hover:bg-elevated'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isActive && (
                      <span className="flex items-center gap-0.5 text-[9px] text-info">
                        {idx + 1}
                        {dir === 'asc' ? '\u2191' : '\u2193'}
                      </span>
                    )}
                  </button>
                )
              })}
              {sortStack.length > 0 && (
                <>
                  <div className="border-t border-border-default my-1" />
                  <button
                    onClick={() => { onSortChange([]); setSortOpen(false) }}
                    className="w-full text-left px-3 py-1.5 text-[11px] text-text-muted hover:bg-elevated transition-colors"
                  >
                    Clear sort
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Filter panel toggle */}
        <div ref={filterRef} className="relative">
          <button
            onClick={() => { setFilterOpen(!filterOpen); setSortOpen(false) }}
            className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-1 rounded transition-colors ${
              filterCount > 0
                ? 'bg-info/10 text-info'
                : 'text-text-muted hover:bg-elevated hover:text-text-secondary'
            }`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
            </svg>
            Filters{filterCount > 0 && <span className="text-[9px]">({filterCount})</span>}
          </button>
        </div>

        {/* Clear all */}
        {filterCount > 0 && (
          <button
            onClick={() => onFiltersChange(emptyFilters)}
            className="text-[10px] text-text-muted hover:text-info ml-auto"
          >
            Clear all
          </button>
        )}

        {/* Active sort pills */}
        {sortStack.length > 0 && filterCount === 0 && (
          <div className="flex items-center gap-1 ml-auto">
            {sortStack.map((s, i) => {
              const label = SORT_OPTIONS.find((o) => o.key === s.key)?.label ?? s.key
              return (
                <span key={s.key} className="text-[9px] text-info bg-info/5 rounded px-1.5 py-0.5">
                  {i + 1}. {label} {s.direction === 'asc' ? '\u2191' : '\u2193'}
                </span>
              )
            })}
          </div>
        )}

        {/* Count */}
        {filterCount > 0 && (
          <span className="text-[10px] text-text-muted tabular-nums">
            {filteredCount}/{totalCount}
          </span>
        )}
      </div>

      {/* Expanded filter panel */}
      {filterOpen && (
        <div className="px-3 pb-2.5 space-y-2.5">
          {/* Row 1: Severity + Classification */}
          <div className="grid grid-cols-2 gap-2">
            <FilterMultiSelect
              label="Severity"
              options={SEVERITY_OPTIONS}
              selected={filters.severityFilter}
              onToggle={(v) => toggleMulti('severityFilter', v)}
            />
            <FilterMultiSelect
              label="Classification"
              options={CLASSIFICATION_OPTIONS}
              selected={filters.classificationFilter}
              onToggle={(v) => toggleMulti('classificationFilter', v)}
            />
          </div>

          {/* Row 2: Doc Type */}
          <FilterMultiSelect
            label="Doc Type"
            options={DOC_TYPE_OPTIONS}
            selected={filters.typeFilter}
            onToggle={(v) => toggleMulti('typeFilter', v)}
          />

          {/* Row 3: Dataset */}
          <div>
            <label className="block text-[10px] text-text-muted mb-0.5">Dataset</label>
            <select
              value={filters.datasetId ?? ''}
              onChange={(e) => update({ datasetId: e.target.value || null })}
              className="w-full bg-elevated border border-border-default rounded px-2 py-1 text-[11px] text-text-primary focus:border-info focus:outline-none"
            >
              <option value="">All datasets</option>
              {datasets.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  DS{ds.number}: {ds.name}
                </option>
              ))}
            </select>
          </div>

          {/* Row 4: Entity search */}
          <div>
            <label className="block text-[10px] text-text-muted mb-0.5">Entity</label>
            {filters.entityId ? (
              <div className="flex items-center gap-1.5 bg-info/5 border border-info/20 rounded px-2 py-1">
                <span className="text-[11px] text-info flex-1 truncate">{filters.entityName}</span>
                <button
                  onClick={() => { update({ entityId: null, entityName: null }); setEntityQuery('') }}
                  className="text-text-muted hover:text-text-secondary shrink-0"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={entityQuery}
                  onChange={(e) => setEntityQuery(e.target.value)}
                  placeholder="Search entities..."
                  className="w-full bg-elevated border border-border-default rounded px-2 py-1 text-[11px] text-text-primary placeholder:text-text-muted focus:border-info focus:outline-none"
                />
                {entitySearching && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-text-muted">...</span>
                )}
                {entityResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-surface border border-border-default rounded-lg shadow-lg py-1 max-h-[180px] overflow-y-auto">
                    {entityResults.map((e) => (
                      <button
                        key={e.id}
                        onClick={() => {
                          update({ entityId: e.id, entityName: e.name })
                          setEntityQuery('')
                          setEntityResults([])
                        }}
                        className="w-full text-left px-3 py-1.5 text-[11px] text-text-secondary hover:bg-elevated transition-colors flex items-center justify-between"
                      >
                        <span>{e.name}</span>
                        <span className="text-[9px] text-text-muted">T{e.tier}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Row 5: Date range + Page count */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-text-muted mb-0.5">Date Range</label>
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => update({ dateFrom: e.target.value })}
                  className="flex-1 min-w-0 bg-elevated border border-border-default rounded px-1.5 py-1 text-[10px] text-text-primary focus:border-info focus:outline-none"
                />
                <span className="text-[10px] text-text-muted shrink-0">&ndash;</span>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => update({ dateTo: e.target.value })}
                  className="flex-1 min-w-0 bg-elevated border border-border-default rounded px-1.5 py-1 text-[10px] text-text-primary focus:border-info focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-text-muted mb-0.5">Page Count</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={filters.minPages}
                  onChange={(e) => update({ minPages: e.target.value })}
                  placeholder="Min"
                  min={0}
                  className="flex-1 min-w-0 bg-elevated border border-border-default rounded px-1.5 py-1 text-[10px] text-text-primary placeholder:text-text-muted focus:border-info focus:outline-none"
                />
                <span className="text-[10px] text-text-muted shrink-0">&ndash;</span>
                <input
                  type="number"
                  value={filters.maxPages}
                  onChange={(e) => update({ maxPages: e.target.value })}
                  placeholder="Max"
                  min={0}
                  className="flex-1 min-w-0 bg-elevated border border-border-default rounded px-1.5 py-1 text-[10px] text-text-primary placeholder:text-text-muted focus:border-info focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Reusable multi-select checkbox list (inline, wrapping pills) ──

function FilterMultiSelect({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  return (
    <div>
      <label className="block text-[10px] text-text-muted mb-0.5">{label}</label>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => {
          const active = selected.includes(opt.value)
          return (
            <button
              key={opt.value}
              onClick={() => onToggle(opt.value)}
              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                active
                  ? 'bg-info/10 border-info/30 text-info'
                  : 'bg-elevated border-border-default text-text-muted hover:text-text-secondary hover:border-border-default/80'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
