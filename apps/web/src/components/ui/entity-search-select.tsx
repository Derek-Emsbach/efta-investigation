'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { TierBadge } from './tier-badge'
import type { Tier } from '@efta/shared'

interface EntityResult {
  id: string
  name: string
  tier: number
}

interface EntitySearchSelectProps {
  onSelect: (entity: EntityResult) => void
  excludeIds?: string[]
  placeholder?: string
}

export function EntitySearchSelect({
  onSelect,
  excludeIds = [],
  placeholder = 'Search entities...',
}: EntitySearchSelectProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<EntityResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const fetchEntities = useCallback(async (search: string) => {
    if (search.length < 2) {
      setResults([])
      return
    }
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ search, limit: '8' })
      const res = await fetch(`/api/entities?${params}`)
      if (!res.ok) return
      const json = await res.json()
      const filtered = (json.data as EntityResult[]).filter(
        (e) => !excludeIds.includes(e.id)
      )
      setResults(filtered)
      setHighlightIdx(0)
    } finally {
      setIsLoading(false)
    }
  }, [excludeIds])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void fetchEntities(query)
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, fetchEntities])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(entity: EntityResult) {
    onSelect(entity)
    setQuery('')
    setResults([])
    setIsOpen(false)
    inputRef.current?.blur()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleSelect(results[highlightIdx])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const showDropdown = isOpen && query.length >= 2

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-3 py-1.5 text-sm bg-elevated border border-border-default rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-info transition-colors"
      />

      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-surface border border-border-default rounded shadow-lg">
          {isLoading ? (
            <div className="px-3 py-2 text-xs text-text-muted">Searching...</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-text-muted">No entities found</div>
          ) : (
            results.map((entity, idx) => (
              <button
                key={entity.id}
                onClick={() => handleSelect(entity)}
                onMouseEnter={() => setHighlightIdx(idx)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                  idx === highlightIdx ? 'bg-elevated text-text-primary' : 'text-text-secondary hover:bg-elevated/50'
                }`}
              >
                <span className="truncate flex-1">{entity.name}</span>
                <TierBadge tier={entity.tier as Tier} />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
