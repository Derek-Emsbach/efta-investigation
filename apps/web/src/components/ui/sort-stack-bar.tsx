'use client'

import type { SortState } from './data-table'

interface SortStackBarProps {
  stack: SortState[]
  onChange: (stack: SortState[]) => void
  /** Map from sort key to display label. Falls back to the key itself. */
  labels?: Record<string, string>
  /** Compact mode for smaller spaces (e.g., review queue). */
  compact?: boolean
}

export function SortStackBar({ stack, onChange, labels, compact }: SortStackBarProps) {
  if (stack.length === 0) return null

  const remove = (idx: number) => onChange(stack.filter((_, i) => i !== idx))
  const clearAll = () => onChange([])

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
      <span className="text-text-muted text-xs">Sorted by:</span>
      {stack.map((s, idx) => (
        <span
          key={s.key}
          className="inline-flex items-center gap-1 bg-elevated border border-border-default rounded px-2 py-0.5 text-text-secondary"
        >
          <span className="text-[9px] font-bold text-info">{idx + 1}</span>
          <span className="capitalize">{labels?.[s.key] ?? s.key.replace(/_/g, ' ')}</span>
          <span className="text-text-muted">
            {s.direction === 'asc' ? '↑' : '↓'}
          </span>
          <button
            onClick={() => remove(idx)}
            className="ml-0.5 text-text-muted hover:text-critical transition-colors"
            aria-label={`Remove ${s.key} sort`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
      {stack.length > 1 && (
        <button
          onClick={clearAll}
          className="text-xs text-text-muted hover:text-critical transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
