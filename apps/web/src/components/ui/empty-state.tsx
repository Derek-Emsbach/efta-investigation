import Link from 'next/link'

interface EmptyStateProps {
  icon?: React.ReactNode
  label?: string
  title: string
  description?: string
  action?: { label: string; href?: string; onClick?: () => void }
  className?: string
}

export function EmptyState({
  icon,
  label,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 text-center ${className}`}>
      {icon && <div className="mb-4 text-text-muted">{icon}</div>}
      {label && (
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-text-muted mb-3">
          {label}
        </p>
      )}
      <h3 className="font-display text-lg font-semibold text-text-primary">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-text-muted">{description}</p>
      )}
      {action && (
        <div className="mt-6">
          {action.href ? (
            <Link
              href={action.href}
              className="inline-block rounded border border-border-default bg-elevated px-5 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface"
            >
              {action.label}
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className="rounded border border-border-default bg-elevated px-5 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
