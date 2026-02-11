'use client'

import { useState, useCallback, type ReactNode } from 'react'
import { Skeleton } from './skeleton'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  sortable?: boolean
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (row: T) => void
  isLoading?: boolean
}

type SortDirection = 'asc' | 'desc'

interface SortState {
  key: string
  direction: SortDirection
}

function SortArrow({ direction, active }: { direction: SortDirection; active: boolean }) {
  return (
    <span className={`inline-flex ml-1 ${active ? 'text-text-primary' : 'text-text-muted/40'}`}>
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
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState | null>(null)

  const handleSort = useCallback((key: string) => {
    setSort((prev) => {
      if (prev?.key === key) {
        return prev.direction === 'asc'
          ? { key, direction: 'desc' }
          : null
      }
      return { key, direction: 'asc' }
    })
  }, [])

  const sortedData = (() => {
    if (!sort) return data
    const { key, direction } = sort
    return [...data].sort((a, b) => {
      const aVal = a[key]
      const bVal = b[key]

      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1

      let comparison = 0
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal)
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal
      } else {
        comparison = String(aVal).localeCompare(String(bVal))
      }

      return direction === 'asc' ? comparison : -comparison
    })
  })()

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
        <div className="flex items-center justify-center py-12 text-text-muted text-sm">
          No results found
        </div>
      </div>
    )
  }

  return (
    <div className="w-full border border-border-default rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-elevated">
            {columns.map((col) => (
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
                    <SortArrow
                      direction={sort?.key === col.key ? sort.direction : 'asc'}
                      active={sort?.key === col.key}
                    />
                  )}
                </span>
              </th>
            ))}
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
