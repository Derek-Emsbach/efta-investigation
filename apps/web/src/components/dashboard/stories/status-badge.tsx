'use client'

import type { EditorialStatus } from '@efta/shared'

const STATUS_CONFIG: Record<EditorialStatus, { label: string; className: string }> = {
  draft: {
    label: 'Draft',
    className: 'bg-text-muted/20 text-text-muted',
  },
  review: {
    label: 'Review',
    className: 'bg-warning/20 text-warning',
  },
  published: {
    label: 'Published',
    className: 'bg-success/20 text-success',
  },
}

export function StatusBadge({ status }: { status: EditorialStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider ${config.className}`}>
      {config.label}
    </span>
  )
}

export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider bg-critical/20 text-critical">
      <span className="h-1.5 w-1.5 rounded-full bg-critical animate-pulse" />
      Live
    </span>
  )
}
