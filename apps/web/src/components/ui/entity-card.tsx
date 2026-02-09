import type { EntityWithCounts } from '@efta/shared'
import { TierBadge } from './tier-badge'

interface EntityCardProps {
  entity: EntityWithCounts
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function formatCategory(category: string | null): string {
  if (!category) return ''
  return category.replace(/_/g, ' ').toUpperCase()
}

function formatStatus(status: string | null): string {
  if (!status) return 'UNKNOWN'
  return status.replace(/_/g, ' ')
}

interface StatItemProps {
  icon: React.ReactNode
  count: number
  label: string
}

function StatItem({ icon, count, label }: StatItemProps) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-text-muted" title={label}>
      {icon}
      <span>{count}</span>
    </span>
  )
}

export function EntityCard({ entity }: EntityCardProps) {
  return (
    <div className="group bg-surface border border-border-default rounded-lg p-4 hover:border-border-light transition-colors">
      {/* Top section: avatar + identity */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-elevated flex items-center justify-center shrink-0">
          <span className="font-display text-sm text-text-secondary">
            {getInitials(entity.name)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base text-text-primary truncate">
            {entity.name}
          </h3>
          {entity.tier !== null && (
            <div className="mt-1">
              <TierBadge tier={entity.tier} />
            </div>
          )}
        </div>
      </div>

      {/* Category + status */}
      <div className="flex items-center gap-2 mb-3">
        {entity.category && (
          <span className="text-xs text-text-muted uppercase tracking-wider">
            {formatCategory(entity.category)}
          </span>
        )}
        {entity.status && (
          <span className="text-xs px-2 py-0.5 rounded bg-elevated text-text-secondary capitalize">
            {formatStatus(entity.status)}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 pt-3 border-t border-border-default">
        <StatItem
          icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          }
          count={entity.doc_count}
          label="Documents"
        />
        <StatItem
          icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
          }
          count={entity.event_count}
          label="Events"
        />
        <StatItem
          icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-2.99a4.5 4.5 0 0 0-1.242-7.244l4.5-4.5a4.5 4.5 0 0 1 6.364 6.364l-1.757 1.757" />
            </svg>
          }
          count={entity.connection_count}
          label="Connections"
        />
      </div>
    </div>
  )
}
