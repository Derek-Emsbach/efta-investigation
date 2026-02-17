'use client'

// ─── Offset mode (default) ─────────────────────────────

interface OffsetPaginationProps {
  mode?: 'offset'
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  totalCount?: number
  pageSize?: number
  noun?: string
}

// ─── Cursor mode ───────────────────────────────────────

interface CursorPaginationProps {
  mode: 'cursor'
  hasNext: boolean
  hasPrev: boolean
  onNext: () => void
  onPrev: () => void
  estimatedTotal: number
  noun?: string
}

type PaginationProps = OffsetPaginationProps | CursorPaginationProps

function formatEstimate(n: number): string {
  if (n >= 1_000_000) return `~${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `~${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function Pagination(props: PaginationProps) {
  if (props.mode === 'cursor') {
    const { hasNext, hasPrev, onNext, onPrev, estimatedTotal, noun = 'documents' } = props

    if (!hasNext && !hasPrev) return null

    return (
      <div className="flex items-center justify-between mt-6">
        <p className="text-sm text-text-muted">
          {formatEstimate(estimatedTotal)} {noun}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            disabled={!hasPrev}
            className="px-3 py-1.5 text-sm font-medium rounded border border-border-default bg-elevated text-text-primary hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <button
            onClick={onNext}
            disabled={!hasNext}
            className="px-3 py-1.5 text-sm font-medium rounded border border-border-default bg-elevated text-text-primary hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    )
  }

  // Offset mode (default)
  const { page, totalPages, onPageChange, totalCount, pageSize, noun = 'items' } = props

  if (totalPages <= 1) return null

  const rangeStart = pageSize ? (page - 1) * pageSize + 1 : undefined
  const rangeEnd =
    pageSize && totalCount ? Math.min(page * pageSize, totalCount) : undefined

  return (
    <div className="flex items-center justify-between mt-6">
      {rangeStart !== undefined && rangeEnd !== undefined && totalCount !== undefined ? (
        <p className="text-sm text-text-muted">
          Showing {rangeStart}&ndash;{rangeEnd} of {totalCount.toLocaleString()} {noun}
        </p>
      ) : (
        <div />
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="px-3 py-1.5 text-sm font-medium rounded border border-border-default bg-elevated text-text-primary hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <span className="text-sm text-text-muted px-2">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="px-3 py-1.5 text-sm font-medium rounded border border-border-default bg-elevated text-text-primary hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}
