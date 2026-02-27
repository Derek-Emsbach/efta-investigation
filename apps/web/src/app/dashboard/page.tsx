import Link from 'next/link'
import MainContent from '@/components/layout/main-content'
import { StatCard } from '@/components/ui/stat-card'
import { TierBadge } from '@/components/ui/tier-badge'
import { SeverityMarker } from '@/components/ui/severity-marker'
import { PipelineStatus } from '@/components/dashboard/pipeline-status'
import { ActionItems } from '@/components/dashboard/action-items'
import { RedactionIntel } from '@/components/dashboard/redaction-intel'
import { TIER_CONFIG, SEVERITY_CONFIG } from '@efta/shared'
import type { Tier, Severity, Dataset, DatasetStatus, Entity, Document, Event } from '@efta/shared'
import { createClient } from '@/lib/supabase/server'

const TIERS: Tier[] = [1, 2, 3, 4, 5, 6]
const SEVERITY_LEVELS: Severity[] = ['extreme_critical', 'critical', 'high', 'routine']

const EVENT_TYPE_COLORS: Record<string, string> = {
  legal: '#3B82F6',
  evidence: '#F59E0B',
  communication: '#6B7280',
  institutional: '#DC2626',
  personal: '#8B5CF6',
  financial: '#10B981',
  legislative: '#06B6D4',
  travel: '#EC4899',
  sighting: '#14B8A6',
}

// ── Stat card icons (inline SVGs for server component) ──────────

function UsersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function FileTextIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  )
}

function NetworkIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="5" r="2.5" />
      <circle cx="5" cy="18" r="2.5" />
      <circle cx="19" cy="18" r="2.5" />
      <line x1="12" y1="7.5" x2="5" y2="15.5" />
      <line x1="12" y1="7.5" x2="19" y2="15.5" />
    </svg>
  )
}

function ScaleIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  )
}

// ── Helpers ──────────────────────────────────────────────────────

function getStatusColor(status: DatasetStatus): string {
  switch (status) {
    case 'completed': return 'bg-success'
    case 'in_progress': return 'bg-info'
    default: return 'bg-border-default'
  }
}

function getStatusLabel(status: DatasetStatus): string {
  switch (status) {
    case 'completed': return 'Completed'
    case 'in_progress': return 'In Progress'
    case 'not_started': return 'Not Started'
    default: return status
  }
}

function getStatusBadgeClasses(status: DatasetStatus): string {
  switch (status) {
    case 'completed': return 'bg-success/10 text-success'
    case 'in_progress': return 'bg-info/10 text-info'
    default: return 'bg-text-muted/10 text-text-muted'
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatYear(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').getFullYear().toString()
}

// ── Page ─────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    entitiesResult,
    documentsResult,
    eventsResult,
    criticalDocsResult,
    connectionsResult,
    evidenceResult,
    datasetsResult,
    recentEventsResult,
    criticalDocsListResult,
    keyEntitiesResult,
    needsReviewResult,
    highTierResult,
    strongEvidenceResult,
    eventDateRangeResult,
    datasetReviewedResult,
    ...tierAndSeverityResults
  ] = await Promise.all([
    supabase.from('entities').select('*', { count: 'exact', head: true }),
    supabase.from('documents').select('*', { count: 'exact', head: true }),
    supabase.from('events').select('*', { count: 'exact', head: true }),
    supabase.from('documents').select('*', { count: 'exact', head: true }).in('severity', ['extreme_critical', 'critical']),
    supabase.from('entity_connections').select('*', { count: 'exact', head: true }),
    supabase.from('evidence_items').select('*', { count: 'exact', head: true }),
    supabase.from('datasets').select('*').order('number', { ascending: true }),

    supabase.from('events').select('id, date, title, event_type, significance').order('date', { ascending: false, nullsFirst: false }).limit(6),
    supabase.from('documents').select('id, bates_number, title, document_type, severity, original_date').in('severity', ['extreme_critical', 'critical']).order('original_date', { ascending: false, nullsFirst: false }).limit(8),
    supabase.from('entities').select('id, name, entity_type, tier, category, status').in('tier', [1, 2]).order('tier', { ascending: true }).order('name', { ascending: true }).limit(10),

    // New queries for enhanced stat cards
    supabase.from('documents').select('*', { count: 'exact', head: true }).eq('processing_status', 'needs_review'),
    supabase.from('entities').select('*', { count: 'exact', head: true }).in('tier', [1, 2]),
    supabase.from('evidence_items').select('*', { count: 'exact', head: true }).eq('strength', 'strong'),
    supabase.from('events').select('date').order('date', { ascending: true }).limit(1),

    supabase.rpc('dataset_reviewed_counts'),

    ...TIERS.map((tier) =>
      supabase.from('entities').select('*', { count: 'exact', head: true }).eq('tier', tier)
    ),
    ...SEVERITY_LEVELS.map((severity) =>
      supabase.from('documents').select('*', { count: 'exact', head: true }).eq('severity', severity)
    ),
  ])

  const entityCount = entitiesResult.count ?? 0
  const documentCount = documentsResult.count ?? 0
  const eventCount = eventsResult.count ?? 0
  const criticalCount = criticalDocsResult.count ?? 0
  const connectionCount = connectionsResult.count ?? 0
  const evidenceCount = evidenceResult.count ?? 0
  const datasets = (datasetsResult.data as Dataset[] | null) ?? []
  const recentEvents = (recentEventsResult.data ?? []) as Pick<Event, 'id' | 'date' | 'title' | 'event_type' | 'significance'>[]
  const criticalDocs = (criticalDocsListResult.data ?? []) as Pick<Document, 'id' | 'bates_number' | 'title' | 'document_type' | 'severity' | 'original_date'>[]
  const keyEntities = (keyEntitiesResult.data ?? []) as Pick<Entity, 'id' | 'name' | 'entity_type' | 'tier' | 'category' | 'status'>[]

  const needsReviewCount = needsReviewResult.count ?? 0
  const highTierCount = highTierResult.count ?? 0
  const strongEvidenceCount = strongEvidenceResult.count ?? 0
  const earliestDate = (eventDateRangeResult.data?.[0] as { date: string } | undefined)?.date

  // Live reviewed counts per dataset
  const datasetReviewedCounts: Record<string, number> = {}
  if (datasetReviewedResult.data && Array.isArray(datasetReviewedResult.data)) {
    for (const row of datasetReviewedResult.data as { dataset_id: string; count: number }[]) {
      datasetReviewedCounts[row.dataset_id] = row.count
    }
  }

  const tierCounts: Record<Tier, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  for (let i = 0; i < TIERS.length; i++) {
    tierCounts[TIERS[i]] = tierAndSeverityResults[i].count ?? 0
  }

  const severityCounts: Record<Severity, number> = { extreme_critical: 0, critical: 0, high: 0, routine: 0 }
  for (let i = 0; i < SEVERITY_LEVELS.length; i++) {
    severityCounts[SEVERITY_LEVELS[i]] = tierAndSeverityResults[TIERS.length + i].count ?? 0
  }
  const maxSeverity = Math.max(...Object.values(severityCounts), 1)

  // Hero alert line
  const alertLine = needsReviewCount > 0
    ? `${needsReviewCount} document${needsReviewCount !== 1 ? 's' : ''} awaiting review${criticalCount > 0 ? ` — ${criticalCount} critical` : ''}`
    : 'All documents processed and reviewed'
  const alertColor = needsReviewCount > 0
    ? (criticalCount > 0 ? 'text-critical' : 'text-warning')
    : 'text-success'

  return (
    <MainContent>
      {/* ── H1: Investigation Briefing Hero ──────────────────────── */}
      <div className="relative mb-6 -mx-6 -mt-6 px-6 pt-8 pb-6 bg-gradient-to-r from-surface via-surface to-transparent border-b border-border-default">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-text-muted mb-1">
              Intelligence Briefing
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-text-primary">
              EFTA Investigation Dashboard
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Analyzing {documentCount.toLocaleString()} documents across {datasets.length} DOJ datasets
            </p>
            <p className={`text-sm font-medium mt-2 ${alertColor}`}>
              {alertLine}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dashboard/upload"
              className="px-3 py-1.5 text-xs font-medium bg-elevated border border-border-default rounded text-text-secondary hover:text-text-primary hover:border-text-muted transition-colors"
            >
              Upload
            </Link>
            <Link
              href="/dashboard/review"
              className="px-3 py-1.5 text-xs font-medium bg-elevated border border-border-default rounded text-text-secondary hover:text-text-primary hover:border-text-muted transition-colors"
            >
              Review Queue
            </Link>
            <Link
              href="/dashboard/assistant"
              className="px-3 py-1.5 text-xs font-medium bg-info/10 border border-info/30 rounded text-info hover:bg-info/20 transition-colors"
            >
              Ask Detective
            </Link>
          </div>
        </div>
      </div>

      <div className="space-y-5">
      {/* ── H2: Enhanced Stat Cards ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Entities"
          value={entityCount}
          accent="#3B82F6"
          icon={<UsersIcon />}
          context={`${highTierCount} high-priority`}
          href="/dashboard/entities"
        />
        <StatCard
          label="Documents"
          value={documentCount}
          accent="#F59E0B"
          icon={<FileTextIcon />}
          context={needsReviewCount > 0 ? `${needsReviewCount} pending review` : 'All reviewed'}
          href="/dashboard/documents"
        />
        <StatCard
          label="Events"
          value={eventCount}
          accent="#10B981"
          icon={<CalendarIcon />}
          context={earliestDate ? `Since ${formatYear(earliestDate)}` : undefined}
          href="/dashboard/timeline"
        />
        <StatCard
          label="Connections"
          value={connectionCount}
          accent="#8B5CF6"
          icon={<NetworkIcon />}
          href="/dashboard/network"
        />
        <StatCard
          label="Evidence Items"
          value={evidenceCount}
          accent="#06B6D4"
          icon={<ScaleIcon />}
          context={strongEvidenceCount > 0 ? `${strongEvidenceCount} strong` : undefined}
          href="/dashboard/search"
        />
        <StatCard
          label="Critical Findings"
          value={criticalCount}
          accent="#DC2626"
          icon={<AlertIcon />}
          pulse={criticalCount > 0}
          href="/dashboard/documents"
        />
      </div>

      {/* ── H3: Pipeline Status Bar ──────────────────────────────── */}
      <PipelineStatus />

      {/* ── Row: Alerts + Recent Timeline ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts & Action Items */}
        <section className="flex flex-col">
          <h3 className="font-display text-lg font-semibold text-text-primary mb-3">
            Action Items
          </h3>
          <ActionItems />
        </section>

        {/* Recent Timeline Activity */}
        <section className="flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg font-semibold text-text-primary">
              Recent Timeline
            </h3>
            <Link href="/dashboard/timeline" className="text-xs text-info hover:text-info/80 transition-colors">
              View all &rarr;
            </Link>
          </div>
          <div className="bg-surface border border-border-default rounded-lg divide-y divide-border-default flex-1">
            {recentEvents.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-sm">
                No timeline events yet.
              </div>
            ) : (
              recentEvents.map((event) => (
                <Link
                  key={event.id}
                  href="/dashboard/timeline"
                  className="flex items-start gap-3 px-4 py-3 hover:bg-elevated/30 transition-colors group"
                >
                  <div className="w-18 shrink-0 pt-0.5">
                    <span className="text-[11px] text-text-muted font-mono">
                      {formatDate(event.date)}
                    </span>
                  </div>
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: EVENT_TYPE_COLORS[event.event_type ?? ''] ?? '#6B7280' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-primary font-medium truncate group-hover:text-info transition-colors">
                      {event.title}
                    </p>
                    {event.event_type && (
                      <span className="text-[11px] text-text-muted capitalize">
                        {event.event_type}
                      </span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>

      {/* ── Row: Key Entities + Redaction Intel ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Key Entities */}
        <section className="flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg font-semibold text-text-primary">
              Key Entities
            </h3>
            <Link href="/dashboard/entities" className="text-xs text-info hover:text-info/80 transition-colors">
              View all &rarr;
            </Link>
          </div>
          <div className="bg-surface border border-border-default rounded-lg divide-y divide-border-default flex-1">
            {keyEntities.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-sm">
                No high-tier entities loaded yet.
              </div>
            ) : (
              keyEntities.map((entity) => (
                <Link
                  key={entity.id}
                  href={`/dashboard/entities/${entity.id}`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-elevated/30 transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="font-display text-sm font-semibold text-text-primary truncate group-hover:text-info transition-colors">
                      {entity.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-text-muted capitalize">{entity.entity_type}</span>
                      {entity.category && (
                        <>
                          <span className="text-text-muted">&middot;</span>
                          <span className="text-[11px] text-text-muted capitalize">{entity.category.replace(/_/g, ' ')}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <TierBadge tier={entity.tier as Tier} size="sm" />
                </Link>
              ))
            )}
          </div>
        </section>

        {/* Redaction Intelligence */}
        <RedactionIntel />
      </div>

      {/* ── Document Severity Distribution (full width) ──────────── */}
      <section>
        <h3 className="font-display text-lg font-semibold text-text-primary mb-3">
          Document Severity
        </h3>
        <div className="bg-surface border border-border-default rounded-lg p-5 space-y-4">
          {SEVERITY_LEVELS.map((severity) => {
            const count = severityCounts[severity]
            const pct = documentCount > 0 ? (count / documentCount) * 100 : 0
            const barWidth = maxSeverity > 0 ? (count / maxSeverity) * 100 : 0
            const config = SEVERITY_CONFIG[severity]

            return (
              <div key={severity}>
                <div className="flex items-center justify-between mb-1.5">
                  <SeverityMarker severity={severity} />
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-display font-bold text-text-primary">{count}</span>
                    <span className="text-xs text-text-muted w-10 text-right">{pct.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="bg-elevated rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${barWidth}%`, backgroundColor: config.color }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Critical Documents (horizontal scroll) ───────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg font-semibold text-text-primary">
            Critical Documents
          </h3>
          <Link href="/dashboard/documents" className="text-xs text-info hover:text-info/80 transition-colors">
            View all &rarr;
          </Link>
        </div>
        {criticalDocs.length === 0 ? (
          <div className="bg-surface border border-border-default rounded-lg p-8 text-center text-text-muted text-sm">
            No critical documents found.
          </div>
        ) : (
          <div className="relative">
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-border-default scrollbar-track-transparent">
              {criticalDocs.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/dashboard/documents/${doc.id}`}
                  className="flex-shrink-0 w-[280px] snap-start bg-surface border border-border-default rounded-lg p-4 hover:bg-elevated/30 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-1.5 self-stretch rounded-full shrink-0 ${
                        doc.severity === 'extreme_critical' ? 'animate-severity-pulse' : ''
                      }`}
                      style={{ backgroundColor: SEVERITY_CONFIG[doc.severity as Severity]?.color ?? '#6B7280' }}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-xs text-info">{doc.bates_number}</span>
                      <p className="text-sm text-text-primary mt-1 line-clamp-2 group-hover:text-info transition-colors">
                        {doc.title ?? 'Untitled document'}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {doc.document_type && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-elevated text-text-muted capitalize">
                            {doc.document_type.replace(/_/g, ' ')}
                          </span>
                        )}
                        {doc.original_date && (
                          <span className="text-[10px] text-text-muted">{formatDate(doc.original_date)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {/* Gradient fade on right edge */}
            {criticalDocs.length > 3 && (
              <div className="absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none" />
            )}
          </div>
        )}
      </section>

      {/* ── Entity Tier Distribution ─────────────────────────────── */}
      <section>
        <h3 className="font-display text-lg font-semibold text-text-primary mb-3">
          Entity Distribution by Tier
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TIERS.map((tier) => {
            const config = TIER_CONFIG[tier]
            const count = tierCounts[tier]
            const pct = entityCount > 0 ? (count / entityCount) * 100 : 0

            return (
              <Link
                key={tier}
                href={`/dashboard/entities?tier=${tier}`}
                className="bg-surface border border-border-default rounded-lg p-4 flex items-center justify-between hover:bg-elevated/30 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: config.color }} />
                  <div>
                    <TierBadge tier={tier} size="sm" />
                    <p className="text-xs text-text-muted mt-0.5">
                      {config.description.slice(0, 60)}{config.description.length > 60 ? '...' : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-display font-bold text-text-primary group-hover:text-info transition-colors">{count}</span>
                  <p className="text-xs text-text-muted">{pct.toFixed(0)}%</p>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ── Dataset Progress ─────────────────────────────────────── */}
      <section>
        <h3 className="font-display text-lg font-semibold text-text-primary mb-3">
          Dataset Progress
        </h3>
        {datasets.length === 0 ? (
          <div className="bg-surface border border-border-default rounded-lg p-8 text-center text-text-muted text-sm">
            No datasets loaded yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {datasets.map((dataset) => {
              const totalFiles = dataset.total_files ?? 0
              const reviewed = datasetReviewedCounts[dataset.id] ?? 0
              const progress = totalFiles > 0 ? (reviewed / totalFiles) * 100 : 0

              return (
                <div key={dataset.id} className="bg-surface border border-border-default rounded-lg p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-display font-semibold text-text-primary text-sm">
                        Dataset {dataset.number}{dataset.name ? `: ${dataset.name}` : ''}
                      </h4>
                      {dataset.description && (
                        <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{dataset.description}</p>
                      )}
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${getStatusBadgeClasses(dataset.status)}`}>
                      {getStatusLabel(dataset.status)}
                    </span>
                  </div>
                  <div className="mb-2">
                    <div className="bg-elevated rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${getStatusColor(dataset.status)}`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-text-muted">
                    <span>{reviewed.toLocaleString()} / {totalFiles.toLocaleString()} files reviewed</span>
                    <span>{progress.toFixed(1)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
      </div>
    </MainContent>
  )
}
