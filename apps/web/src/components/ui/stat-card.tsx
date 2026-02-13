import Link from 'next/link'
import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: number | string
  accent?: string
  icon?: ReactNode
  context?: string
  href?: string
  pulse?: boolean
}

export function StatCard({ label, value, accent, icon, context, href, pulse }: StatCardProps) {
  const inner = (
    <div
      className={`bg-surface border border-border-default rounded-lg p-4 sm:p-5 transition-colors ${
        href ? 'hover:bg-elevated/30 cursor-pointer group' : ''
      } ${pulse ? 'animate-severity-pulse' : ''}`}
      style={accent ? { borderLeftWidth: '4px', borderLeftColor: accent } : undefined}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-text-primary group-hover:text-info transition-colors">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
          <div className="text-sm text-text-muted mt-1">{label}</div>
          {context && (
            <div className="text-xs text-text-muted mt-0.5">{context}</div>
          )}
        </div>
        {icon && (
          <div className="text-text-muted/40 group-hover:text-text-muted transition-colors shrink-0">
            {icon}
          </div>
        )}
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{inner}</Link>
  }

  return inner
}
