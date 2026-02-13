'use client'

import { useEffect, useState, useCallback } from 'react'
import MainContent from '@/components/layout/main-content'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'

interface DailyUsage {
  date: string
  input: number
  output: number
  cache: number
  requests: number
}

interface Metrics {
  tokenUsage: {
    total: number
    requests: number
    estimatedCost: number
    daily: DailyUsage[]
  }
  databaseCounts: {
    entities: number
    documents: number
    events: number
    connections: number
    evidence: number
    redactions: number
    processing_queue: number
  }
  storage: {
    totalBytes: number
    totalGB: number
  }
  recentLogs: {
    created_at: string
    endpoint: string
    total_tokens: number
    tool_iterations: number
    duration_ms: number
    error: string | null
  }[]
}

interface Notification {
  id: string
  alert_type: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  is_read: boolean
  dismissed: boolean
  action_url: string | null
  created_at: string
}

export default function AdminPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingThresholds, setCheckingThresholds] = useState(false)

  const fetchData = useCallback(async () => {
    const [metricsRes, notifRes] = await Promise.all([
      fetch('/api/admin/metrics'),
      fetch('/api/admin/notifications'),
    ])

    if (metricsRes.ok) {
      setMetrics(await metricsRes.json())
    }
    if (notifRes.ok) {
      const data = await notifRes.json()
      setNotifications(data.notifications ?? [])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function runChecks() {
    setCheckingThresholds(true)
    await fetch('/api/admin/notifications', { method: 'POST' })
    await fetchData()
    setCheckingThresholds(false)
  }

  async function dismissNotification(id: string) {
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, dismissed: true }),
    })
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  async function markRead(id: string) {
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_read: true }),
    })
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    )
  }

  if (loading) {
    return (
      <MainContent>
        <PageHeader title="Admin Dashboard" subtitle="Platform metrics, usage, and alerts" />
        <div className="flex items-center justify-center py-24 text-text-muted">
          Loading metrics...
        </div>
      </MainContent>
    )
  }

  const m = metrics!
  const maxDailyTokens = Math.max(
    ...m.tokenUsage.daily.map((d) => d.input + d.output + d.cache),
    1,
  )

  return (
    <MainContent>
      <PageHeader
        title="Admin Dashboard"
        subtitle="Platform metrics, usage, and alerts"
        actions={
          <button
            onClick={runChecks}
            disabled={checkingThresholds}
            className="rounded-md bg-info/10 px-4 py-2 text-sm font-medium text-info hover:bg-info/20 transition-colors disabled:opacity-50"
          >
            {checkingThresholds ? 'Checking...' : 'Run Threshold Checks'}
          </button>
        }
      />

      {/* ── Stat Cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 sm:gap-4">
        <StatCard
          label="API Tokens (30d)"
          value={m.tokenUsage.total > 1_000_000
            ? `${(m.tokenUsage.total / 1_000_000).toFixed(1)}M`
            : m.tokenUsage.total > 1_000
              ? `${(m.tokenUsage.total / 1_000).toFixed(0)}K`
              : m.tokenUsage.total}
          context="Total tokens consumed"
        />
        <StatCard
          label="API Requests (30d)"
          value={m.tokenUsage.requests}
          context="AI conversations"
        />
        <StatCard
          label="Est. Cost (30d)"
          value={`$${m.tokenUsage.estimatedCost.toFixed(2)}`}
          context="Blended rate ~$6/M"
          accent={m.tokenUsage.estimatedCost > 50 ? '#DC2626' : undefined}
        />
        <StatCard
          label="Total Documents"
          value={m.databaseCounts.documents}
          href="/documents"
        />
        <StatCard
          label="Total Entities"
          value={m.databaseCounts.entities}
          href="/entities"
        />
        <StatCard
          label="R2 Storage"
          value={m.storage.totalGB > 1
            ? `${m.storage.totalGB.toFixed(1)} GB`
            : `${(m.storage.totalBytes / 1024 / 1024).toFixed(0)} MB`}
          context="PDF files in R2"
        />
      </div>

      {/* ── Token Usage Chart ──────────────────────── */}
      <section className="mt-8">
        <h2 className="mb-4 font-display text-lg font-semibold text-text-primary">
          Token Usage — Last 30 Days
        </h2>
        <div className="rounded-lg border border-border-default bg-surface p-4 sm:p-5">
          {m.tokenUsage.daily.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">
              No API usage recorded yet. Send a message in the Detective to see data here.
            </p>
          ) : (
            <>
              <div className="flex items-end gap-1 overflow-x-auto" style={{ minHeight: 160 }}>
                {m.tokenUsage.daily.map((d) => {
                  const total = d.input + d.output + d.cache
                  const heightPct = (total / maxDailyTokens) * 100
                  const inputPct = total > 0 ? (d.input / total) * 100 : 0
                  const outputPct = total > 0 ? (d.output / total) * 100 : 0

                  return (
                    <div
                      key={d.date}
                      className="group relative flex flex-1 flex-col items-center"
                      style={{ minWidth: 14 }}
                    >
                      {/* Tooltip */}
                      <div className="pointer-events-none absolute -top-20 left-1/2 z-10 hidden -translate-x-1/2 rounded-md bg-elevated border border-border-default px-3 py-2 text-xs shadow-lg group-hover:block whitespace-nowrap">
                        <div className="font-medium text-text-primary">{d.date}</div>
                        <div className="text-blue-400">Input: {d.input.toLocaleString()}</div>
                        <div className="text-amber-400">Output: {d.output.toLocaleString()}</div>
                        <div className="text-green-400">Cache: {d.cache.toLocaleString()}</div>
                        <div className="text-text-muted mt-1">{d.requests} request{d.requests !== 1 ? 's' : ''}</div>
                      </div>

                      {/* Stacked bar */}
                      <div
                        className="flex w-full flex-col overflow-hidden rounded-t transition-all"
                        style={{ height: `${Math.max(heightPct, 2)}%` }}
                      >
                        <div
                          className="bg-blue-500/80"
                          style={{ flex: `${inputPct} 0 0` }}
                        />
                        <div
                          className="bg-amber-500/80"
                          style={{ flex: `${outputPct} 0 0` }}
                        />
                        <div
                          className="bg-green-500/60"
                          style={{ flex: `${100 - inputPct - outputPct} 0 0` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="mt-3 flex items-center gap-4 text-xs text-text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-sm bg-blue-500/80" /> Input
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-sm bg-amber-500/80" /> Output
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-sm bg-green-500/60" /> Cache
                </span>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Two Column: DB Tables + Notifications ── */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Database Table Sizes */}
        <section>
          <h2 className="mb-4 font-display text-lg font-semibold text-text-primary">
            Database Tables
          </h2>
          <div className="overflow-hidden rounded-lg border border-border-default bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-elevated/30">
                  <th className="px-4 py-2.5 text-left font-medium text-text-secondary">Table</th>
                  <th className="px-4 py-2.5 text-right font-medium text-text-secondary">Rows</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(m.databaseCounts).map(([table, count]) => (
                  <tr key={table} className="border-b border-border-default/50 last:border-0">
                    <td className="px-4 py-2 text-text-primary">{table}</td>
                    <td className="px-4 py-2 text-right font-mono text-text-secondary">
                      {count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Notifications */}
        <section>
          <h2 className="mb-4 font-display text-lg font-semibold text-text-primary">
            Notifications
          </h2>
          <div className="space-y-2">
            {notifications.length === 0 ? (
              <div className="rounded-lg border border-border-default bg-surface px-4 py-8 text-center text-sm text-text-muted">
                No active notifications. Click &ldquo;Run Threshold Checks&rdquo; to scan for issues.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-lg border bg-surface p-4 ${
                    n.severity === 'critical'
                      ? 'border-critical/40'
                      : n.severity === 'warning'
                        ? 'border-warning/40'
                        : 'border-border-default'
                  } ${!n.is_read ? 'ring-1 ring-info/20' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={n.severity} />
                        <span className="text-sm font-medium text-text-primary">
                          {n.title}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-text-secondary">{n.message}</p>
                      <p className="mt-1.5 text-xs text-text-muted">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {!n.is_read && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="rounded px-2 py-1 text-xs text-info hover:bg-info/10 transition-colors"
                        >
                          Read
                        </button>
                      )}
                      <button
                        onClick={() => dismissNotification(n.id)}
                        className="rounded px-2 py-1 text-xs text-text-muted hover:text-critical hover:bg-critical/10 transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* ── Recent Request Log ─────────────────────── */}
      <section className="mt-8 mb-8">
        <h2 className="mb-4 font-display text-lg font-semibold text-text-primary">
          Recent API Requests
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border-default bg-surface">
          {m.recentLogs.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-text-muted">
              No API requests logged yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-elevated/30">
                  <th className="px-4 py-2.5 text-left font-medium text-text-secondary">
                    Time
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-text-secondary">
                    Endpoint
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-text-secondary">
                    Tokens
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-text-secondary">
                    Iterations
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-text-secondary">
                    Duration
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-text-secondary">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {m.recentLogs.map((log, i) => (
                  <tr
                    key={i}
                    className="border-b border-border-default/50 last:border-0"
                  >
                    <td className="px-4 py-2 font-mono text-xs text-text-muted whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-2 text-text-primary whitespace-nowrap">
                      {log.endpoint}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-text-secondary">
                      {log.total_tokens?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-text-secondary">
                      {log.tool_iterations ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-text-secondary whitespace-nowrap">
                      {log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : '—'}
                    </td>
                    <td className="px-4 py-2">
                      {log.error ? (
                        <span className="text-xs text-critical">{log.error.slice(0, 40)}</span>
                      ) : (
                        <span className="text-xs text-green-400">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </MainContent>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    info: 'bg-info/10 text-info',
    warning: 'bg-warning/10 text-warning',
    critical: 'bg-critical/10 text-critical',
  }

  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        colors[severity] ?? colors.info
      }`}
    >
      {severity}
    </span>
  )
}
