'use client'

import { useState, useEffect } from 'react'

interface RankInfo {
  name: string
  xp_required: number
  description: string
}

interface RanksData {
  current_rank: RankInfo
  next_rank: RankInfo | null
  progress: {
    xp_current: number
    xp_needed: number
    xp_remaining: number
    percentage: number
  } | null
  all_ranks: RankInfo[]
  xp_total: number
}

const XP_SOURCES = [
  { action: 'Entity submission approved', xp: 75 },
  { action: 'Finding submission approved', xp: 50 },
  { action: 'Connection submission approved', xp: 30 },
  { action: 'Correction submission approved', xp: 25 },
]

export default function RanksPage() {
  const [data, setData] = useState<RanksData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/investigate/ranks')
        if (!res.ok) throw new Error('Failed to load')
        setData(await res.json())
      } catch {
        setError('Failed to load rank data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-critical border-t-transparent" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-text-muted">{error ?? 'Failed to load'}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {/* Current rank hero */}
      <div className="text-center mb-10">
        <p className="font-mono text-[10px] tracking-[0.2em] text-text-muted uppercase mb-2">
          Current Rank
        </p>
        <h1 className="font-mono text-2xl font-bold text-critical mb-1">
          {data.current_rank.name}
        </h1>
        <p className="text-sm text-text-muted mb-4">{data.current_rank.description}</p>
        <p className="font-mono text-3xl font-bold text-text-primary">
          {data.xp_total.toLocaleString()} <span className="text-sm text-text-muted">XP</span>
        </p>

        {/* Progress bar to next rank */}
        {data.progress && data.next_rank && (
          <div className="mt-6 max-w-sm mx-auto">
            <div className="flex items-center justify-between text-[10px] font-mono text-text-muted mb-1">
              <span>{data.current_rank.name}</span>
              <span>{data.next_rank.name}</span>
            </div>
            <div className="h-2 bg-border-default rounded-full overflow-hidden">
              <div
                className="h-full bg-critical rounded-full transition-all duration-500"
                style={{ width: `${data.progress.percentage}%` }}
              />
            </div>
            <p className="text-[10px] text-text-muted mt-1">
              {data.progress.xp_remaining.toLocaleString()} XP to next rank ({data.progress.percentage}%)
            </p>
          </div>
        )}
      </div>

      {/* All ranks */}
      <div className="mb-10">
        <h2 className="font-mono text-sm font-bold tracking-wide text-text-secondary mb-4">
          All Ranks
        </h2>
        <div className="space-y-2">
          {data.all_ranks.map((rank) => {
            const isCurrent = rank.name === data.current_rank.name
            const isAchieved = data.xp_total >= rank.xp_required
            return (
              <div
                key={rank.name}
                className={`flex items-center gap-4 rounded border p-3 ${
                  isCurrent
                    ? 'border-critical bg-critical/10'
                    : isAchieved
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-border-default bg-surface/30'
                }`}
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center">
                  {isAchieved ? (
                    <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-mono text-sm font-bold ${isCurrent ? 'text-critical' : isAchieved ? 'text-text-primary' : 'text-text-muted'}`}>
                      {rank.name}
                    </p>
                    {isCurrent && (
                      <span className="text-[10px] font-mono text-critical bg-critical/20 px-1.5 py-0.5 rounded">
                        CURRENT
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">{rank.description}</p>
                </div>
                <div className="flex-shrink-0 font-mono text-xs text-text-muted">
                  {rank.xp_required.toLocaleString()} XP
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* How to earn XP */}
      <div>
        <h2 className="font-mono text-sm font-bold tracking-wide text-text-secondary mb-4">
          How to Earn XP
        </h2>
        <div className="rounded border border-border-default bg-surface/30 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default">
                <th className="text-left px-4 py-2 font-mono text-[10px] tracking-wider text-text-muted uppercase">Action</th>
                <th className="text-right px-4 py-2 font-mono text-[10px] tracking-wider text-text-muted uppercase">XP</th>
              </tr>
            </thead>
            <tbody>
              {XP_SOURCES.map((src) => (
                <tr key={src.action} className="border-b border-border-default last:border-b-0">
                  <td className="px-4 py-2.5 text-sm text-text-secondary">{src.action}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm font-bold text-green-400">+{src.xp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-text-muted mt-2">
          XP is awarded when submissions are reviewed and approved by the investigation team.
        </p>
      </div>
    </div>
  )
}
