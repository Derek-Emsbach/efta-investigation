'use client'

import { useEffect, useState } from 'react'

interface Stats {
  documents: number
  pages: number
  entities: number
  datasets: number
  connections: number
}

export function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetch('/api/public/evidence/stats')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {
        // Fallback
        setStats({
          documents: 1_370_000,
          pages: 2_770_000,
          entities: 99,
          datasets: 12,
          connections: 0,
        })
      })
  }, [])

  if (!stats) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 border-y border-border-default">
      <StatCell
        value={formatNumber(stats.documents)}
        label="Documents"
        color="#e63950"
      />
      <StatCell
        value={formatNumber(stats.pages)}
        label="Pages"
        color="#34d399"
      />
      <StatCell
        value={String(stats.entities)}
        label="Entities"
        color="#f59e0b"
      />
      <StatCell
        value={String(stats.datasets)}
        label="DOJ Datasets"
        color="#60a5fa"
      />
    </div>
  )
}

function StatCell({
  value,
  label,
  color,
}: {
  value: string
  label: string
  color: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-4 border-r border-border-default last:border-r-0">
      <span
        className="font-mono text-xl sm:text-2xl font-bold"
        style={{ color }}
      >
        {value}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted mt-0.5">
        {label}
      </span>
    </div>
  )
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}
