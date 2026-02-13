'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import type { SortState, SortDirection } from '@/components/ui/data-table'

interface QueueControlsProps {
  sortStack: SortState[]
  onSortChange: (stack: SortState[]) => void
  typeFilter: string[]
  onTypeFilterChange: (types: string[]) => void
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

export function QueueControls({ sortStack, onSortChange, typeFilter, onTypeFilterChange }: QueueControlsProps) {
  const [sortOpen, setSortOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)
  const filterRef = useRef<HTMLDivElement>(null)

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

  const handleTypeToggle = useCallback((value: string) => {
    if (typeFilter.includes(value)) {
      onTypeFilterChange(typeFilter.filter((t) => t !== value))
    } else {
      onTypeFilterChange([...typeFilter, value])
    }
  }, [typeFilter, onTypeFilterChange])

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border-default">
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
                      {dir === 'asc' ? '↑' : '↓'}
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

      {/* Type filter dropdown */}
      <div ref={filterRef} className="relative">
        <button
          onClick={() => { setFilterOpen(!filterOpen); setSortOpen(false) }}
          className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-1 rounded transition-colors ${
            typeFilter.length > 0
              ? 'bg-info/10 text-info'
              : 'text-text-muted hover:bg-elevated hover:text-text-secondary'
          }`}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
          </svg>
          Type{typeFilter.length > 0 && <span className="text-[9px]">({typeFilter.length})</span>}
        </button>

        {filterOpen && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-surface border border-border-default rounded-lg shadow-lg py-1 min-w-[160px] max-h-[280px] overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-1 border-b border-border-default mb-1">
              <button
                onClick={() => onTypeFilterChange(DOC_TYPE_OPTIONS.map((o) => o.value))}
                className="text-[10px] text-info hover:underline"
              >
                All
              </button>
              <button
                onClick={() => onTypeFilterChange([])}
                className="text-[10px] text-text-muted hover:underline"
              >
                Clear
              </button>
            </div>
            {DOC_TYPE_OPTIONS.map((opt) => {
              const checked = typeFilter.includes(opt.value)
              return (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-text-secondary hover:bg-elevated cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleTypeToggle(opt.value)}
                    className="rounded border-border-default text-info focus:ring-info/30 w-3 h-3"
                  />
                  {opt.label}
                </label>
              )
            })}
          </div>
        )}
      </div>

      {/* Active sort pills */}
      {sortStack.length > 0 && (
        <div className="flex items-center gap-1 ml-auto">
          {sortStack.map((s, i) => {
            const label = SORT_OPTIONS.find((o) => o.key === s.key)?.label ?? s.key
            return (
              <span key={s.key} className="text-[9px] text-info bg-info/5 rounded px-1.5 py-0.5">
                {i + 1}. {label} {s.direction === 'asc' ? '↑' : '↓'}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
