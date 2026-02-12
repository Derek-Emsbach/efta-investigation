'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import MainContent from '@/components/layout/main-content'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'
import { TierBadge } from '@/components/ui/tier-badge'
import type { Tier } from '@efta/shared'

// ── Types ──────────────────────────────────────────────────

interface ForensicsData {
  pipeline: { standard: number; alternate: number; unknown: number }
  pipelineDetails: { pipeline: string; count: number; avgPages: number }[]
  timeline: {
    id: string
    bates: string | null
    creationDate: string
    pipeline: string
  }[]
  anomalies: {
    id: string
    bates_number: string | null
    title: string | null
    type: string
    details: string
  }[]
  redactions: {
    categoryBreakdown: { A: number; B: number; C: number; D: number }
    suspectCount: number
    legitimateCount: number
    total: number
    levelDistribution: Record<string, number>
  }
  suspectRedactions: {
    id: string
    documentId: string
    bates: string | null
    category: string
    redFlags: string[]
    assessment: string | null
    notes: string | null
  }[]
  entityPatterns: {
    entityName: string
    tier: number
    suspectCount: number
    totalRedactions: number
    documentCount: number
  }[]
  stats: {
    documentsAnalyzed: number
    totalDocuments: number
    anomalyCount: number
    suspectRedactionCount: number
  }
}

// ── Constants ──────────────────────────────────────────────

const CATEGORY_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; text: string; description: string }
> = {
  A: {
    label: 'Category A',
    color: '#10B981',
    bg: 'bg-success/10',
    text: 'text-success',
    description: 'Victim Protection',
  },
  B: {
    label: 'Category B',
    color: '#3B82F6',
    bg: 'bg-info/10',
    text: 'text-info',
    description: 'Legal Privilege',
  },
  C: {
    label: 'Category C',
    color: '#F59E0B',
    bg: 'bg-warning/10',
    text: 'text-warning',
    description: 'Institutional Protection',
  },
  D: {
    label: 'Category D',
    color: '#DC2626',
    bg: 'bg-critical/10',
    text: 'text-critical',
    description: 'Perpetrator Protection',
  },
}

const PIPELINE_COLORS: Record<string, string> = {
  standard: '#3B82F6',
  alternate: '#F59E0B',
  unknown: '#DC2626',
}

const ASSESSMENT_LABELS: Record<string, { label: string; color: string }> = {
  likely_violation: { label: 'Likely Violation', color: 'text-critical' },
  suspect: { label: 'Suspect', color: 'text-warning' },
  unclear: { label: 'Unclear', color: 'text-text-muted' },
  needs_research: { label: 'Needs Research', color: 'text-info' },
  review_failure: { label: 'Review Failure', color: 'text-critical' },
}

const ANOMALY_PAGE_SIZE = 25
const SUSPECT_PAGE_SIZE = 25

// ── Donut Chart (SVG) ─────────────────────────────────────

function DonutChart({
  segments,
  size = 140,
  strokeWidth = 18,
}: {
  segments: { value: number; color: string; label: string }[]
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (total === 0) return null

  let cumulativeOffset = 0

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-border-default"
      />
      {segments.map((seg) => {
        if (seg.value === 0) return null
        const pct = seg.value / total
        const dashLength = circumference * pct
        const dashGap = circumference - dashLength
        const offset = circumference * cumulativeOffset
        cumulativeOffset += pct

        return (
          <circle
            key={seg.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dashLength} ${dashGap}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )
      })}
      {/* Center text */}
      <text
        x={size / 2}
        y={size / 2 - 6}
        textAnchor="middle"
        className="fill-text-primary font-display text-xl font-bold"
        fontSize="20"
      >
        {total.toLocaleString()}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 12}
        textAnchor="middle"
        className="fill-text-muted text-xs"
        fontSize="10"
      >
        TOTAL
      </text>
    </svg>
  )
}

// ── Bar Chart (CSS) ───────────────────────────────────────

function PipelineBar({
  data,
  total,
}: {
  data: { pipeline: string; count: number }[]
  total: number
}) {
  if (total === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex h-8 w-full overflow-hidden rounded-md">
        {data.map((d) => {
          const pct = (d.count / total) * 100
          if (pct === 0) return null
          return (
            <div
              key={d.pipeline}
              className="flex items-center justify-center text-xs font-medium text-white transition-all"
              style={{
                width: `${pct}%`,
                backgroundColor: PIPELINE_COLORS[d.pipeline] ?? '#6B7280',
                minWidth: pct > 0 ? '24px' : 0,
              }}
              title={`${d.pipeline}: ${d.count} (${pct.toFixed(1)}%)`}
            >
              {pct > 8 ? `${pct.toFixed(0)}%` : ''}
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-4">
        {data.map((d) => (
          <div key={d.pipeline} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{
                backgroundColor: PIPELINE_COLORS[d.pipeline] ?? '#6B7280',
              }}
            />
            <span className="text-text-secondary capitalize">
              {d.pipeline}
            </span>
            <span className="font-mono text-text-primary">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────

export default function ForensicsPage() {
  const [data, setData] = useState<ForensicsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [anomalyPage, setAnomalyPage] = useState(1)
  const [suspectPage, setSuspectPage] = useState(1)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/forensics')
      if (!res.ok) throw new Error('Failed to fetch forensics data')
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <MainContent>
        <PageHeader
          title="Forensic Analysis"
          subtitle="DOJ processing pipeline audit & redaction intelligence"
        />
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-32 bg-surface border border-border-default rounded-lg animate-pulse"
            />
          ))}
        </div>
      </MainContent>
    )
  }

  if (error) {
    return (
      <MainContent>
        <PageHeader
          title="Forensic Analysis"
          subtitle="DOJ processing pipeline audit & redaction intelligence"
        />
        <div className="bg-critical/10 border border-critical/30 rounded-lg p-4 text-sm text-critical">
          {error}
        </div>
      </MainContent>
    )
  }

  if (!data || data.stats.documentsAnalyzed === 0) {
    return (
      <MainContent>
        <PageHeader
          title="Forensic Analysis"
          subtitle="DOJ processing pipeline audit & redaction intelligence"
        />
        <EmptyState
          icon={
            <svg
              className="h-12 w-12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
              />
            </svg>
          }
          label="NO DATA"
          title="No forensic analysis data available"
          description="Process documents through the pipeline to generate forensic metadata and redaction analysis."
          action={{ label: 'Upload documents', href: '/upload' }}
        />
      </MainContent>
    )
  }

  const {
    pipeline,
    pipelineDetails,
    timeline,
    anomalies,
    redactions,
    suspectRedactions,
    entityPatterns,
    stats,
  } = data

  const pipelineTotal = pipeline.standard + pipeline.alternate + pipeline.unknown
  const anomalySlice = anomalies.slice(
    (anomalyPage - 1) * ANOMALY_PAGE_SIZE,
    anomalyPage * ANOMALY_PAGE_SIZE
  )
  const suspectSlice = suspectRedactions.slice(
    (suspectPage - 1) * SUSPECT_PAGE_SIZE,
    suspectPage * SUSPECT_PAGE_SIZE
  )

  return (
    <MainContent>
      <PageHeader
        title="Forensic Analysis"
        subtitle="DOJ processing pipeline audit & redaction intelligence"
      />

      {/* ── Stats Row ──────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Documents Analyzed"
          value={stats.documentsAnalyzed}
          accent="#3B82F6"
        />
        <StatCard
          label="Pipeline Anomalies"
          value={stats.anomalyCount}
          accent={stats.anomalyCount > 0 ? '#DC2626' : '#10B981'}
        />
        <StatCard
          label="Suspect Redactions"
          value={stats.suspectRedactionCount}
          accent={stats.suspectRedactionCount > 0 ? '#F59E0B' : '#10B981'}
        />
        <StatCard
          label="Total Redactions"
          value={redactions.total}
          accent="#6B7280"
        />
      </div>

      {/* ── Pipeline Distribution ──────────────────────── */}
      <section className="bg-surface border border-border-default rounded-lg p-5 mb-6">
        <h2 className="font-display text-sm font-semibold text-text-primary mb-1">
          Processing Pipeline Distribution
        </h2>
        <p className="text-xs text-text-muted mb-4">
          DOJ documents pass through two known pipelines — deviations may indicate anomalies
        </p>

        <PipelineBar
          data={[
            { pipeline: 'standard', count: pipeline.standard },
            { pipeline: 'alternate', count: pipeline.alternate },
            { pipeline: 'unknown', count: pipeline.unknown },
          ]}
          total={pipelineTotal}
        />

        {pipelineDetails.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted uppercase tracking-wider border-b border-border-default">
                  <th className="text-left py-2 font-medium">Pipeline</th>
                  <th className="text-right py-2 font-medium">Documents</th>
                  <th className="text-right py-2 font-medium">Avg Pages</th>
                  <th className="text-right py-2 font-medium">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {pipelineDetails.map((d) => (
                  <tr key={d.pipeline} className="text-text-secondary">
                    <td className="py-2 capitalize flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-sm"
                        style={{
                          backgroundColor:
                            PIPELINE_COLORS[d.pipeline] ?? '#6B7280',
                        }}
                      />
                      {d.pipeline}
                    </td>
                    <td className="py-2 text-right font-mono text-text-primary">
                      {d.count}
                    </td>
                    <td className="py-2 text-right font-mono">
                      {d.avgPages}
                    </td>
                    <td className="py-2 text-right font-mono">
                      {pipelineTotal > 0
                        ? ((d.count / pipelineTotal) * 100).toFixed(1)
                        : '0'}
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Two-Column: Redactions + Timeline ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Redaction Overview */}
        <section className="bg-surface border border-border-default rounded-lg p-5">
          <h2 className="font-display text-sm font-semibold text-text-primary mb-1">
            Redaction Intelligence
          </h2>
          <p className="text-xs text-text-muted mb-4">
            Category breakdown across all analyzed documents
          </p>

          <div className="flex items-center gap-6">
            <DonutChart
              segments={[
                {
                  value: redactions.categoryBreakdown.A,
                  color: CATEGORY_CONFIG.A.color,
                  label: 'A',
                },
                {
                  value: redactions.categoryBreakdown.B,
                  color: CATEGORY_CONFIG.B.color,
                  label: 'B',
                },
                {
                  value: redactions.categoryBreakdown.C,
                  color: CATEGORY_CONFIG.C.color,
                  label: 'C',
                },
                {
                  value: redactions.categoryBreakdown.D,
                  color: CATEGORY_CONFIG.D.color,
                  label: 'D',
                },
              ]}
            />

            <div className="flex-1 space-y-2">
              {(['A', 'B', 'C', 'D'] as const).map((cat) => {
                const cfg = CATEGORY_CONFIG[cat]
                const count =
                  redactions.categoryBreakdown[cat]
                const pct =
                  redactions.total > 0
                    ? ((count / redactions.total) * 100).toFixed(1)
                    : '0'
                return (
                  <div key={cat} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.text}`}
                      >
                        {cat}
                      </span>
                      <span className="text-xs text-text-secondary">
                        {cfg.description}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-text-primary">
                        {count}
                      </span>
                      <span className="text-[10px] text-text-muted w-10 text-right">
                        {pct}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Suspect vs Legitimate bar */}
          {redactions.total > 0 && (
            <div className="mt-5 pt-4 border-t border-border-default">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-text-muted">Suspect vs Legitimate</span>
                <span className="text-text-muted">
                  {redactions.suspectCount} suspect /{' '}
                  {redactions.legitimateCount} legitimate
                </span>
              </div>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-elevated">
                <div
                  className="bg-warning transition-all"
                  style={{
                    width: `${(redactions.suspectCount / redactions.total) * 100}%`,
                  }}
                />
                <div
                  className="bg-success transition-all"
                  style={{
                    width: `${(redactions.legitimateCount / redactions.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Assessment distribution */}
          {Object.keys(redactions.levelDistribution).length > 0 && (
            <div className="mt-4 pt-4 border-t border-border-default">
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-2">
                Assessment Distribution
              </p>
              <div className="space-y-1">
                {Object.entries(redactions.levelDistribution)
                  .sort(([, a], [, b]) => b - a)
                  .map(([key, count]) => {
                    const style = ASSESSMENT_LABELS[key]
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className={style?.color ?? 'text-text-secondary'}>
                          {style?.label ?? key}
                        </span>
                        <span className="font-mono text-text-primary">
                          {count}
                        </span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </section>

        {/* Creation Timeline */}
        <section className="bg-surface border border-border-default rounded-lg p-5">
          <h2 className="font-display text-sm font-semibold text-text-primary mb-1">
            Document Creation Dates
          </h2>
          <p className="text-xs text-text-muted mb-4">
            Documents with retained CreationDate metadata — pattern may reveal processing phases
          </p>

          {timeline.length === 0 ? (
            <p className="text-xs text-text-muted py-8 text-center">
              No documents with creation date metadata
            </p>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {timeline.slice(0, 50).map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between py-1.5 border-b border-border-default last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="inline-block h-2 w-2 rounded-sm shrink-0"
                      style={{
                        backgroundColor:
                          PIPELINE_COLORS[doc.pipeline] ?? '#6B7280',
                      }}
                    />
                    <Link
                      href={`/documents/${doc.id}`}
                      className="text-xs text-text-primary hover:text-info transition-colors truncate"
                    >
                      {doc.bates ?? doc.id.slice(0, 8)}
                    </Link>
                  </div>
                  <span className="text-[10px] font-mono text-text-muted shrink-0 ml-2">
                    {new Date(doc.creationDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              ))}
              {timeline.length > 50 && (
                <p className="text-[10px] text-text-muted text-center pt-2">
                  Showing 50 of {timeline.length} documents
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ── Anomalies ─────────────────────────────────── */}
      <section className="bg-surface border border-border-default rounded-lg mb-6">
        <div className="px-5 py-4 border-b border-border-default">
          <h2 className="font-display text-sm font-semibold text-text-primary">
            Pipeline Anomalies
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Documents deviating from expected Standard or Alternate processing patterns
          </p>
        </div>

        {anomalies.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-text-muted">
            No anomalies detected — all documents match expected pipeline patterns
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                <div className="grid grid-cols-[1fr_160px_1fr] gap-4 px-5 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider bg-elevated">
                  <div>Document</div>
                  <div>Anomaly Type</div>
                  <div>Details</div>
                </div>
                <div className="divide-y divide-border-default">
                  {anomalySlice.map((a, i) => (
                    <div
                      key={`${a.id}-${i}`}
                      className="grid grid-cols-[1fr_160px_1fr] gap-4 px-5 py-3"
                    >
                      <Link
                        href={`/documents/${a.id}`}
                        className="text-sm text-text-primary hover:text-info transition-colors truncate"
                      >
                        {a.bates_number ?? a.title ?? a.id.slice(0, 8)}
                      </Link>
                      <span className="text-xs text-warning font-medium">
                        {a.type}
                      </span>
                      <span className="text-xs text-text-secondary">
                        {a.details}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-5 pb-3">
              <Pagination
                page={anomalyPage}
                totalPages={Math.ceil(
                  anomalies.length / ANOMALY_PAGE_SIZE
                )}
                onPageChange={setAnomalyPage}
                totalCount={anomalies.length}
                pageSize={ANOMALY_PAGE_SIZE}
                noun="anomalies"
              />
            </div>
          </>
        )}
      </section>

      {/* ── Suspect Redactions ─────────────────────────── */}
      <section className="bg-surface border border-border-default rounded-lg mb-6">
        <div className="px-5 py-4 border-b border-border-default">
          <h2 className="font-display text-sm font-semibold text-text-primary">
            Suspect Redactions
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Redactions flagged as potentially illegitimate — Categories C and D warrant highest scrutiny
          </p>
        </div>

        {suspectRedactions.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-text-muted">
            No suspect redactions identified
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                <div className="grid grid-cols-[1fr_80px_100px_1fr] gap-4 px-5 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider bg-elevated">
                  <div>Document</div>
                  <div>Category</div>
                  <div>Assessment</div>
                  <div>Red Flags</div>
                </div>
                <div className="divide-y divide-border-default">
                  {suspectSlice.map((r) => {
                    const catCfg = CATEGORY_CONFIG[r.category]
                    const assessCfg = r.assessment
                      ? ASSESSMENT_LABELS[r.assessment]
                      : null
                    return (
                      <div
                        key={r.id}
                        className="grid grid-cols-[1fr_80px_100px_1fr] gap-4 px-5 py-3"
                      >
                        <Link
                          href={`/documents/${r.documentId}`}
                          className="text-sm text-text-primary hover:text-info transition-colors truncate"
                        >
                          {r.bates ?? r.documentId.slice(0, 8)}
                        </Link>
                        <span
                          className={`text-xs font-medium px-1.5 py-0.5 rounded w-fit ${catCfg?.bg ?? ''} ${catCfg?.text ?? 'text-text-secondary'}`}
                        >
                          {r.category}
                        </span>
                        <span
                          className={`text-xs ${assessCfg?.color ?? 'text-text-muted'}`}
                        >
                          {assessCfg?.label ?? r.assessment ?? '—'}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {r.redFlags.map((flag, i) => (
                            <span
                              key={i}
                              className="text-[10px] bg-elevated rounded px-1.5 py-0.5 text-text-secondary"
                            >
                              {flag}
                            </span>
                          ))}
                          {r.redFlags.length === 0 && (
                            <span className="text-[10px] text-text-muted">
                              —
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="px-5 pb-3">
              <Pagination
                page={suspectPage}
                totalPages={Math.ceil(
                  suspectRedactions.length / SUSPECT_PAGE_SIZE
                )}
                onPageChange={setSuspectPage}
                totalCount={suspectRedactions.length}
                pageSize={SUSPECT_PAGE_SIZE}
                noun="suspect redactions"
              />
            </div>
          </>
        )}
      </section>

      {/* ── Entity-Redaction Patterns ──────────────────── */}
      {entityPatterns.length > 0 && (
        <section className="bg-surface border border-border-default rounded-lg mb-6">
          <div className="px-5 py-4 border-b border-border-default">
            <h2 className="font-display text-sm font-semibold text-text-primary">
              Entity-Redaction Patterns
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Entities appearing in documents with the most suspect redactions
            </p>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="grid grid-cols-[1fr_80px_100px_100px_100px] gap-4 px-5 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider bg-elevated">
                <div>Entity</div>
                <div>Tier</div>
                <div className="text-right">Suspect</div>
                <div className="text-right">Total</div>
                <div className="text-right">Documents</div>
              </div>
              <div className="divide-y divide-border-default">
                {entityPatterns.map((e) => (
                  <div
                    key={e.entityName}
                    className="grid grid-cols-[1fr_80px_100px_100px_100px] gap-4 px-5 py-3"
                  >
                    <span className="text-sm text-text-primary truncate">
                      {e.entityName}
                    </span>
                    <TierBadge tier={e.tier as Tier} />
                    <span
                      className={`text-xs font-mono text-right ${e.suspectCount > 0 ? 'text-warning' : 'text-text-muted'}`}
                    >
                      {e.suspectCount}
                    </span>
                    <span className="text-xs font-mono text-right text-text-secondary">
                      {e.totalRedactions}
                    </span>
                    <span className="text-xs font-mono text-right text-text-secondary">
                      {e.documentCount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </MainContent>
  )
}
