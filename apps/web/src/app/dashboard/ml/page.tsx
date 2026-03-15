'use client'

import { useCallback, useEffect, useState } from 'react'
import MainContent from '@/components/layout/main-content'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'

// ── Types ──────────────────────────────────────────────────

interface AnomalyData {
  id: string
  anomaly_type: string
  severity: string
  score: number
  title: string
  description: string
  review_status: string
  entity_ids: string[]
  document_ids: string[]
  evidence: Record<string, unknown>
  created_at: string
}

interface ConnectionData {
  id: string
  entity_a: string
  entity_b: string
  suggested_type: string
  confidence: number
  status: string
  evidence_summary: string
  entity_a_info: { name: string; tier: number; entity_type: string } | null
  entity_b_info: { name: string; tier: number; entity_type: string } | null
}

interface RunData {
  id: string
  model_name: string
  version: number
  status: string
  metrics: Record<string, unknown>
  created_at: string
}

type Tab = 'anomalies' | 'connections' | 'runs'

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-critical/15 text-critical border-critical/30',
  high: 'bg-warning/15 text-warning border-warning/30',
  medium: 'bg-info/15 text-info border-info/30',
  low: 'bg-text-muted/15 text-text-muted border-text-muted/30',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-warning/15 text-warning',
  confirmed: 'bg-success/15 text-success',
  dismissed: 'bg-text-muted/15 text-text-muted',
  merged: 'bg-info/15 text-info',
  rejected: 'bg-critical/15 text-critical',
}

// ── Component ──────────────────────────────────────────────

export default function MlDashboard() {
  const [tab, setTab] = useState<Tab>('anomalies')
  const [anomalies, setAnomalies] = useState<AnomalyData[]>([])
  const [connections, setConnections] = useState<ConnectionData[]>([])
  const [runs, setRuns] = useState<RunData[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    anomalyCount: 0,
    connectionCount: 0,
    runCount: 0,
    criticalCount: 0,
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [anomalyRes, connectionRes, runRes] = await Promise.all([
        fetch('/api/admin/ml/anomalies?status=all&limit=100'),
        fetch('/api/admin/ml/connections?status=all&limit=100'),
        fetch('/api/admin/ml/runs?limit=20'),
      ])

      const anomalyData = await anomalyRes.json()
      const connectionData = await connectionRes.json()
      const runData = await runRes.json()

      const a = anomalyData.data || []
      const c = connectionData.data || []
      const r = runData.data || []

      setAnomalies(a)
      setConnections(c)
      setRuns(r)
      setStats({
        anomalyCount: anomalyData.total || a.length,
        connectionCount: connectionData.total || c.length,
        runCount: r.length,
        criticalCount: a.filter((x: AnomalyData) => x.severity === 'critical' && x.review_status === 'pending').length,
      })
    } catch {
      // silently fail — stats will show 0
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAnomalyAction = async (id: string, review_status: string) => {
    await fetch('/api/admin/ml/anomalies', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, review_status }),
    })
    fetchData()
  }

  const handleConnectionAction = async (id: string, action: 'approve' | 'reject') => {
    if (action === 'approve') {
      await fetch('/api/admin/ml/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestion_id: id }),
      })
    } else {
      await fetch('/api/admin/ml/connections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'rejected' }),
      })
    }
    fetchData()
  }

  return (
    <MainContent>
      <PageHeader
        title="ML Pipeline"
        subtitle="Machine learning analysis: anomaly detection, connection suggestions, and model training"
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Anomalies Detected"
          value={loading ? '...' : stats.anomalyCount}
        />
        <StatCard
          label="Critical (Pending)"
          value={loading ? '...' : stats.criticalCount}
          accent={stats.criticalCount > 0 ? '#DC2626' : undefined}
          pulse={stats.criticalCount > 0}
        />
        <StatCard
          label="Connection Suggestions"
          value={loading ? '...' : stats.connectionCount}
        />
        <StatCard
          label="Model Runs"
          value={loading ? '...' : stats.runCount}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-border-default mb-6">
        <div className="flex gap-0 overflow-x-auto">
          {(['anomalies', 'connections', 'runs'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t
                  ? 'border-critical text-text-primary'
                  : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              {t === 'anomalies' && 'Anomalies'}
              {t === 'connections' && 'Connections'}
              {t === 'runs' && 'Model Runs'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-text-muted">
          Loading ML data...
        </div>
      ) : (
        <>
          {tab === 'anomalies' && (
            <AnomaliesTab
              anomalies={anomalies}
              onAction={handleAnomalyAction}
            />
          )}
          {tab === 'connections' && (
            <ConnectionsTab
              connections={connections}
              onAction={handleConnectionAction}
            />
          )}
          {tab === 'runs' && <RunsTab runs={runs} />}
        </>
      )}
    </MainContent>
  )
}

// ── Anomalies Tab ──────────────────────────────────────────

function AnomaliesTab({
  anomalies,
  onAction,
}: {
  anomalies: AnomalyData[]
  onAction: (id: string, status: string) => void
}) {
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all'
    ? anomalies
    : anomalies.filter(a => a.severity === filter)

  return (
    <div>
      {/* Severity filter */}
      <div className="flex gap-2 mb-4">
        {['all', 'critical', 'high', 'medium', 'low'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === s
                ? 'bg-elevated text-text-primary'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== 'all' && (
              <span className="ml-1 text-text-muted">
                ({anomalies.filter(a => a.severity === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-text-muted">
          No anomalies found. Run the ML pipeline to detect anomalies.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => (
            <div
              key={a.id}
              className="border border-border-default rounded-lg p-4 bg-surface hover:bg-elevated/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded border ${SEVERITY_COLORS[a.severity] || ''}`}>
                      {a.severity}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${STATUS_COLORS[a.review_status] || ''}`}>
                      {a.review_status}
                    </span>
                    <span className="text-xs text-text-muted">
                      Score: {a.score.toFixed(0)}
                    </span>
                  </div>
                  <h3 className="text-sm font-medium text-text-primary truncate">
                    {a.title}
                  </h3>
                  <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                    {a.description}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-text-muted">
                    <span>{a.anomaly_type.replace(/_/g, ' ')}</span>
                    {a.entity_ids.length > 0 && (
                      <span>{a.entity_ids.length} entities</span>
                    )}
                    {a.document_ids.length > 0 && (
                      <span>{a.document_ids.length} docs</span>
                    )}
                  </div>
                </div>

                {a.review_status === 'pending' && (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => onAction(a.id, 'confirmed')}
                      className="px-2.5 py-1.5 text-xs font-medium rounded bg-success/15 text-success hover:bg-success/25 transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => onAction(a.id, 'dismissed')}
                      className="px-2.5 py-1.5 text-xs font-medium rounded bg-elevated text-text-muted hover:text-text-primary transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Connections Tab ─────────────────────────────────────────

function ConnectionsTab({
  connections,
  onAction,
}: {
  connections: ConnectionData[]
  onAction: (id: string, action: 'approve' | 'reject') => void
}) {
  const pending = connections.filter(c => c.status === 'pending')
  const reviewed = connections.filter(c => c.status !== 'pending')

  return (
    <div>
      {connections.length === 0 ? (
        <div className="py-12 text-center text-text-muted">
          No connection suggestions. Run the ML pipeline to generate suggestions.
        </div>
      ) : (
        <>
          {/* Pending suggestions */}
          {pending.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-text-primary mb-3">
                Pending Review ({pending.length})
              </h3>
              <div className="space-y-3">
                {pending.map(c => (
                  <ConnectionCard key={c.id} connection={c} onAction={onAction} />
                ))}
              </div>
            </div>
          )}

          {/* Reviewed */}
          {reviewed.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-text-muted mb-3">
                Reviewed ({reviewed.length})
              </h3>
              <div className="space-y-2">
                {reviewed.map(c => (
                  <ConnectionCard key={c.id} connection={c} onAction={onAction} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ConnectionCard({
  connection: c,
  onAction,
}: {
  connection: ConnectionData
  onAction: (id: string, action: 'approve' | 'reject') => void
}) {
  return (
    <div className="border border-border-default rounded-lg p-4 bg-surface hover:bg-elevated/30 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-text-primary">
              {c.entity_a_info?.name || 'Unknown'}
            </span>
            <span className="text-xs text-text-muted px-2 py-0.5 bg-elevated rounded">
              {(c.suggested_type || 'connected_to').replace(/_/g, ' ')}
            </span>
            <span className="text-sm font-medium text-text-primary">
              {c.entity_b_info?.name || 'Unknown'}
            </span>
          </div>

          {/* Confidence bar */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-1.5 bg-elevated rounded-full overflow-hidden max-w-[200px]">
              <div
                className={`h-full rounded-full ${
                  c.confidence >= 80 ? 'bg-success' : c.confidence >= 50 ? 'bg-warning' : 'bg-text-muted'
                }`}
                style={{ width: `${c.confidence}%` }}
              />
            </div>
            <span className="text-xs text-text-muted">{c.confidence}%</span>
          </div>

          {c.evidence_summary && (
            <p className="text-xs text-text-secondary line-clamp-2">
              {c.evidence_summary}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2 text-[10px] text-text-muted">
            {c.entity_a_info && <span>T{c.entity_a_info.tier} {c.entity_a_info.entity_type}</span>}
            {c.entity_b_info && <span>T{c.entity_b_info.tier} {c.entity_b_info.entity_type}</span>}
            {c.status !== 'pending' && (
              <span className={`px-1.5 py-0.5 rounded ${STATUS_COLORS[c.status] || ''}`}>
                {c.status}
              </span>
            )}
          </div>
        </div>

        {c.status === 'pending' && (
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => onAction(c.id, 'approve')}
              className="px-2.5 py-1.5 text-xs font-medium rounded bg-success/15 text-success hover:bg-success/25 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => onAction(c.id, 'reject')}
              className="px-2.5 py-1.5 text-xs font-medium rounded bg-elevated text-text-muted hover:text-text-primary transition-colors"
            >
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Runs Tab ───────────────────────────────────────────────

function RunsTab({ runs }: { runs: RunData[] }) {
  return (
    <div>
      {runs.length === 0 ? (
        <div className="py-12 text-center text-text-muted">
          No model runs recorded. Train a model using the ML CLI to see results here.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-left text-xs text-text-muted uppercase tracking-wider">
                <th className="pb-2 pr-4">Model</th>
                <th className="pb-2 pr-4">Version</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Metrics</th>
                <th className="pb-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {runs.map(r => (
                <tr key={r.id} className="hover:bg-elevated/30">
                  <td className="py-2.5 pr-4 font-medium text-text-primary">
                    {r.model_name}
                  </td>
                  <td className="py-2.5 pr-4 text-text-secondary">v{r.version}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                      r.status === 'completed' ? 'bg-success/15 text-success'
                      : r.status === 'failed' ? 'bg-critical/15 text-critical'
                      : 'bg-warning/15 text-warning'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-text-muted">
                    {r.metrics ? (
                      <span>
                        {Object.entries(r.metrics).slice(0, 3).map(([k, v]) => (
                          <span key={k} className="mr-2">
                            {k}: {typeof v === 'number' ? v.toFixed(2) : String(v)}
                          </span>
                        ))}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-2.5 text-text-muted">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
