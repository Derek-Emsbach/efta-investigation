interface StatCardProps {
  label: string
  value: number | string
  accent?: string
}

export function StatCard({ label, value, accent }: StatCardProps) {
  return (
    <div
      className="bg-surface border border-border-default rounded-lg p-4 sm:p-5"
      style={accent ? { borderLeftWidth: '4px', borderLeftColor: accent } : undefined}
    >
      <div className="text-2xl sm:text-3xl font-display font-bold text-text-primary">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="text-sm text-text-muted mt-1">{label}</div>
    </div>
  )
}
