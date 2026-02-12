'use client'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  totalCount?: number
  pageSize?: number
  noun?: string
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  totalCount,
  pageSize,
  noun = 'items',
}: PaginationProps) {
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
