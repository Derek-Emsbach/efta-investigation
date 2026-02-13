'use client'

import { useState, useCallback, useMemo, type ReactNode } from 'react'
import { Skeleton } from './skeleton'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  sortable?: boolean
  className?: string
}

export type SortDirection = 'asc' | 'desc'

export interface SortState {
  key: string
  direction: SortDirection
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (row: T) => void
  isLoading?: boolean
  emptyState?: ReactNode
  /** Controlled multi-column sort stack. First element = primary sort. */
  sortStack?: SortState[]
  /** Callback when sort stack changes (controlled mode). */
  onSortChange?: (stack: SortState[]) => void
  /** Max number of simultaneous sort levels (default: 3). */
  maxSortLevels?: number
}

/** Compare two values for sorting. Handles null/undefined, strings, numbers. */
function compareValues(a: unknown, b: unknown): number {
  if (a === null || a === undefined) return 1
  if (b === null || b === undefined) return -1
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b)
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

/** Sort data by a stack of sort criteria. First non-zero comparison wins. */
export function multiColumnSort<T extends Record<string, unknown>>(
  data: T[],
  stack: SortState[],
): T[] {
  if (stack.length === 0) return data
  return [...data].sort((a, b) => {
    for (const { key, direction } of stack) {
      const cmp = compareValues(a[key], b[key])
      if (cmp !== 0) return direction === 'asc' ? cmp : -cmp
    }
    return 0
  })
}

function SortIndicator({ index, direction, active }: { index: number; direction: SortDirection; active: boolean }) {
  return (
    <span className={`inline-flex items-center ml-1 gap-0.5 ${active ? 'text-text-primary' : 'text-text-muted/40'}`}>
      {active && index >= 0 && (
        <span className="text-[9px] font-bold text-info min-w-[12px] text-center">{index + 1}</span>
      )}
      {direction === 'asc' ? (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      )}
    </span>
  )
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  isLoading = false,
  emptyState,
  sortStack: controlledStack,
  onSortChange,
  maxSortLevels = 3,
}: DataTableProps<T>) {
  // Internal single-sort for backward compat (when no controlled props)
  const [internalStack, setInternalStack] = useState<SortState[]>([])
  const isControlled = controlledStack !== undefined && onSortChange !== undefined
  const stack = isControlled ? controlledStack : internalStack

  const handleSort = useCallback((key: string) => {
    const update = (prev: SortState[]): SortState[] => {
      const existingIdx = prev.findIndex((s) => s.key === key)
      if (existingIdx !== -1) {
        // Cycle: asc → desc → remove
        const existing = prev[existingIdx]
        if (existing.direction === 'asc') {
          const next = [...prev]
          next[existingIdx] = { key, direction: 'desc' }
          return next
        }
        // Remove from stack
        return prev.filter((_, i) => i !== existingIdx)
      }
      // Add to stack (if below max)
      if (prev.length < maxSortLevels) {
        return [...prev, { key, direction: 'asc' }]
      }
      // At max — replace last
      return [...prev.slice(0, -1), { key, direction: 'asc' }]
    }

    if (isControlled) {
      onSortChange(update(controlledStack))
    } else {
      setInternalStack(update)
    }
  }, [isControlled, controlledStack, onSortChange, maxSortLevels])

  const sortedData = useMemo(() => multiColumnSort(data, stack), [data, stack])

  // Find sort index for a column (-1 if not sorted)
  const sortIndexOf = (key: string) => stack.findIndex((s) => s.key === key)

  if (isLoading) {
    return (
      <div className="w-full border border-border-default rounded-lg overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="bg-elevated">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted ${col.className ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {Array.from({ length: 5 }).map((_, rowIdx) => (
              <tr key={rowIdx} className="bg-surface">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <Skeleton className="h-4 w-3/4" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="w-full border border-border-default rounded-lg overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="bg-elevated">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted ${col.className ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
        </table>
        {emptyState ?? (
          <div className="flex items-center justify-center py-12 text-text-muted text-sm">
            No results found
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-full border border-border-default rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-elevated">
            {columns.map((col) => {
              const idx = sortIndexOf(col.key)
              const isActive = idx !== -1
              const direction = isActive ? stack[idx].direction : 'asc'

              return (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted ${
                    col.sortable ? 'cursor-pointer select-none hover:text-text-secondary transition-colors' : ''
                  } ${col.className ?? ''}`}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center">
                    {col.header}
                    {col.sortable && (
                      <SortIndicator index={idx} direction={direction} active={isActive} />
                    )}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-default">
          {sortedData.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className={`${
                rowIdx % 2 === 0 ? 'bg-surface' : 'bg-surface/50'
              } hover:bg-elevated/50 transition-colors ${
                onRowClick ? 'cursor-pointer' : ''
              }`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-3 text-sm text-text-primary ${col.className ?? ''}`}
                >
                  {col.render
                    ? col.render(row)
                    : (row[col.key] as ReactNode) ?? '\u2014'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
