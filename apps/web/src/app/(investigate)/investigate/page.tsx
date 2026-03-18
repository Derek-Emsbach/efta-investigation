'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Stats {
  xp_total: number
  current_rank: string
  submissions_count: number
  approved_submissions_count: number
  ai_queries_used: number
  ai_queries_daily_limit: number
}

interface XpEntry {
  id: string
  event_type: string
  xp_amount: number
  notes: string | null
  created_at: string
}

const EVENT_LABELS: Record<string, string> = {
  finding_approved: 'Finding Approved',
  daily_login: 'Daily Login',
  first_note: 'First Note',
  first_submission: 'First Submission',
  streak_bonus: 'Streak Bonus',
}

export default function InvestigateOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentXp, setRecentXp] = useState<XpEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/investigate/stats')
        if (!res.ok) {
          if (res.status === 403) {
            setError('Investigator account required. Upgrade to access the workspace.')
          } else if (res.status === 401) {
            setError('Please sign in to access the investigator workspace.')
          } else {
            setError('Failed to load stats')
          }
          return
        }
        const data = await res.json()
        setStats(data.stats)
        setRecentXp(data.recent_xp ?? [])
      } catch {
        setError('Failed to load workspace data')
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

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h2 className="font-mono text-lg text-text-primary mb-2">Access Required</h2>
        <p className="text-text-muted text-sm mb-6">{error}</p>
        <Link
          href="/account"
          className="inline-flex items-center gap-2 rounded bg-critical px-4 py-2 text-sm font-mono text-white hover:bg-critical/90 transition-colors"
        >
          Manage Account
        </Link>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Welcome header */}
      <div className="mb-8">
        <h1 className="font-mono text-xl font-bold tracking-wide text-text-primary mb-1">
          Welcome, {stats.current_rank}
        </h1>
        <p className="text-sm text-text-muted">
          Your investigator workspace — research, take notes, and submit findings.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="XP Total" value={stats.xp_total.toLocaleString()} />
        <StatCard label="Current Rank" value={stats.current_rank} />
        <StatCard
          label="Submissions"
          value={`${stats.approved_submissions_count}/${stats.submissions_count}`}
          sublabel="approved / total"
        />
        <StatCard
          label="AI Queries Today"
          value={`${stats.ai_queries_used}/${stats.ai_queries_daily_limit}`}
          sublabel="used / limit"
        />
      </div>

      {/* Quick actions */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <QuickAction
          href="/investigate/detective"
          title="Research with Detective"
          description="AI-powered research assistant with database access"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          }
        />
        <QuickAction
          href="/investigate/notes"
          title="Research Notes"
          description="Private markdown notes linked to entities"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
          }
        />
        <QuickAction
          href="/investigate/submit"
          title="Submit Finding"
          description="Contribute findings for review and earn XP"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
            </svg>
          }
        />
      </div>

      {/* Recent XP */}
      {recentXp.length > 0 && (
        <div>
          <h2 className="font-mono text-sm font-bold tracking-wide text-text-secondary mb-3">
            Recent XP Activity
          </h2>
          <div className="space-y-2">
            {recentXp.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded border border-border-default bg-surface/50 px-4 py-2.5"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">
                    {EVENT_LABELS[entry.event_type] ?? entry.event_type}
                  </p>
                  {entry.notes && (
                    <p className="text-xs text-text-muted truncate mt-0.5">{entry.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className="font-mono text-sm font-bold text-green-400">
                    +{entry.xp_amount}
                  </span>
                  <span className="text-[10px] text-text-muted whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  sublabel,
}: {
  label: string
  value: string
  sublabel?: string
}) {
  return (
    <div className="rounded border border-border-default bg-surface/50 p-4">
      <p className="font-mono text-[10px] tracking-wider text-text-muted uppercase mb-1">{label}</p>
      <p className="font-mono text-lg font-bold text-text-primary">{value}</p>
      {sublabel && <p className="text-[10px] text-text-muted mt-0.5">{sublabel}</p>}
    </div>
  )
}

function QuickAction({
  href,
  title,
  description,
  icon,
}: {
  href: string
  title: string
  description: string
  icon: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded border border-border-default bg-surface/50 p-4 hover:border-critical/40 hover:bg-surface transition-colors"
    >
      <div className="flex-shrink-0 text-text-muted group-hover:text-critical transition-colors mt-0.5">
        {icon}
      </div>
      <div>
        <p className="font-mono text-sm font-bold text-text-primary group-hover:text-critical transition-colors">
          {title}
        </p>
        <p className="text-xs text-text-muted mt-0.5">{description}</p>
      </div>
    </Link>
  )
}
