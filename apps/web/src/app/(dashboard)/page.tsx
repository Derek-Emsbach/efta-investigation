import Link from 'next/link'
import MainContent from '@/components/layout/main-content'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { TierBadge } from '@/components/ui/tier-badge'
import { SeverityMarker } from '@/components/ui/severity-marker'
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

function getStatusColor(status: DatasetStatus): string {
  switch (status) {
    case 'completed':
      return 'bg-success'
    case 'in_progress':
      return 'bg-info'
    case 'not_started':
      return 'bg-border-default'
    default:
      return 'bg-border-default'
  }
}

function getStatusLabel(status: DatasetStatus): string {
  switch (status) {
    case 'completed':
      return 'Completed'
    case 'in_progress':
      return 'In Progress'
    case 'not_started':
      return 'Not Started'
    default:
      return status
  }
}

function getStatusBadgeClasses(status: DatasetStatus): string {
  switch (status) {
    case 'completed':
      return 'bg-success/10 text-success'
    case 'in_progress':
      return 'bg-info/10 text-info'
    case 'not_started':
      return 'bg-text-muted/10 text-text-muted'
    default:
      return 'bg-text-muted/10 text-text-muted'
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function DashboardPage() {
  const supabase = await createClient()

  // Run all queries in parallel for performance
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
    ...tierAndSeverityResults
  ] = await Promise.all([
    // Counts
    supabase.from('entities').select('*', { count: 'exact', head: true }),
    supabase.from('documents').select('*', { count: 'exact', head: true }),
    supabase.from('events').select('*', { count: 'exact', head: true }),
    supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .in('severity', ['extreme_critical', 'critical']),
    supabase.from('entity_connections').select('*', { count: 'exact', head: true }),
    supabase.from('evidence_items').select('*', { count: 'exact', head: true }),
    supabase.from('datasets').select('*').order('number', { ascending: true }),

    // Recent events (latest 6)
    supabase
      .from('events')
      .select('id, date, title, event_type, significance')
      .order('date', { ascending: false, nullsFirst: false })
      .limit(6),

    // Critical documents (latest 5)
    supabase
      .from('documents')
      .select('id, bates_number, title, document_type, severity, original_date')
      .in('severity', ['extreme_critical', 'critical'])
      .order('original_date', { ascending: false, nullsFirst: false })
      .limit(5),

    // Key entities (tier 1 and 2)
    supabase
      .from('entities')
      .select('id, name, entity_type, tier, category, status')
      .in('tier', [1, 2])
      .order('tier', { ascending: true })
      .order('name', { ascending: true })
      .limit(10),

    // Tier counts (6 queries)
    ...TIERS.map((tier) =>
      supabase.from('entities').select('*', { count: 'exact', head: true }).eq('tier', tier)
    ),

    // Severity counts (4 queries)
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

  const tierCounts: Record<Tier, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  for (let i = 0; i < TIERS.length; i++) {
    tierCounts[TIERS[i]] = tierAndSeverityResults[i].count ?? 0
  }

  const severityCounts: Record<Severity, number> = {
    extreme_critical: 0, critical: 0, high: 0, routine: 0
  }
  for (let i = 0; i < SEVERITY_LEVELS.length; i++) {
    severityCounts[SEVERITY_LEVELS[i]] = tierAndSeverityResults[TIERS.length + i].count ?? 0
  }
  const maxSeverity = Math.max(...Object.values(severityCounts), 1)

  return (
    <MainContent>
      <PageHeader
        title="EFTA Investigation Dashboard"
        subtitle="Systematic analysis of 3.5 million pages of DOJ Epstein Files disclosures"
      />

      {/* Primary stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-10">
        <StatCard label="Entities" value={entityCount} accent="#3B82F6" />
        <StatCard label="Documents" value={documentCount} accent="#F59E0B" />
        <StatCard label="Events" value={eventCount} accent="#10B981" />
        <StatCard label="Connections" value={connectionCount} accent="#8B5CF6" />
        <StatCard label="Evidence Items" value={evidenceCount} accent="#06B6D4" />
        <StatCard
          label="Critical Findings"
          value={criticalCount}
          accent="#DC2626"
        />
      </div>

      {/* Two-column layout: Recent Activity + Key Entities */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-10">

        {/* Recent Timeline Activity — 3 cols */}
        <section className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold text-text-primary">
              Recent Timeline Activity
            </h3>
            <Link href="/timeline" className="text-xs text-info hover:text-info/80 transition-colors">
              View all &rarr;
            </Link>
          </div>
          <div className="bg-surface border border-border-default rounded-lg divide-y divide-border-default">
            {recentEvents.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-sm">
                No timeline events yet.
              </div>
            ) : (
              recentEvents.map((event) => (
                <Link
                  key={event.id}
                  href="/timeline"
                  className="flex items-start gap-4 px-5 py-3.5 hover:bg-elevated/30 transition-colors group"
                >
                  {/* Date + type dot */}
                  <div className="w-20 shrink-0 pt-0.5">
                    <span className="text-xs text-text-muted font-mono">
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
                    <div className="flex items-center gap-2 mt-0.5">
                      {event.event_type && (
                        <span className="text-xs text-text-muted capitalize">
                          {event.event_type}
                        </span>
                      )}
                      {event.significance && (
                        <span className="text-xs text-text-muted italic truncate">
                          &mdash; {event.significance}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* Key Entities (Tier 1 + 2) — 2 cols */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold text-text-primary">
              Key Entities
            </h3>
            <Link href="/entities" className="text-xs text-info hover:text-info/80 transition-colors">
              View all &rarr;
            </Link>
          </div>
          <div className="bg-surface border border-border-default rounded-lg divide-y divide-border-default">
            {keyEntities.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-sm">
                No high-tier entities loaded yet.
              </div>
            ) : (
              keyEntities.map((entity) => (
                <Link
                  key={entity.id}
                  href={`/entities/${entity.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-elevated/30 transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="font-display text-sm font-semibold text-text-primary truncate group-hover:text-info transition-colors">
                      {entity.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-text-muted capitalize">
                        {entity.entity_type}
                      </span>
                      {entity.category && (
                        <>
                          <span className="text-text-muted">&middot;</span>
                          <span className="text-xs text-text-muted capitalize">
                            {entity.category.replace(/_/g, ' ')}
                          </span>
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
      </div>

      {/* Two-column: Severity Distribution + Critical Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">

        {/* Severity Distribution */}
        <section>
          <h3 className="font-display text-lg font-semibold text-text-primary mb-4">
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
                      <span className="text-sm font-display font-bold text-text-primary">
                        {count}
                      </span>
                      <span className="text-xs text-text-muted w-10 text-right">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="bg-elevated rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: config.color,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Critical Documents */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold text-text-primary">
              Critical Documents
            </h3>
            <Link href="/documents" className="text-xs text-info hover:text-info/80 transition-colors">
              View all &rarr;
            </Link>
          </div>
          <div className="bg-surface border border-border-default rounded-lg divide-y divide-border-default">
            {criticalDocs.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-sm">
                No critical documents found.
              </div>
            ) : (
              criticalDocs.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/documents/${doc.id}`}
                  className="flex items-start gap-4 px-5 py-3.5 hover:bg-elevated/30 transition-colors group"
                >
                  <div
                    className={`w-1.5 self-stretch rounded-full shrink-0 ${
                      doc.severity === 'extreme_critical' ? 'animate-severity-pulse' : ''
                    }`}
                    style={{ backgroundColor: SEVERITY_CONFIG[doc.severity as Severity]?.color ?? '#6B7280' }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs text-info">
                        {doc.bates_number}
                      </span>
                      {doc.document_type && (
                        <span className="text-xs text-text-muted capitalize">
                          {doc.document_type.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-primary truncate group-hover:text-info transition-colors">
                      {doc.title ?? 'Untitled document'}
                    </p>
                    {doc.original_date && (
                      <span className="text-xs text-text-muted">
                        {formatDate(doc.original_date)}
                      </span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Entity Tier Distribution */}
      <section className="mb-10">
        <h3 className="font-display text-lg font-semibold text-text-primary mb-4">
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
                href={`/entities?tier=${tier}`}
                className="bg-surface border border-border-default rounded-lg p-4 flex items-center justify-between hover:bg-elevated/30 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: config.color }}
                  />
                  <div>
                    <TierBadge tier={tier} size="sm" />
                    <p className="text-xs text-text-muted mt-0.5">
                      {config.description.slice(0, 60)}{config.description.length > 60 ? '...' : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-display font-bold text-text-primary group-hover:text-info transition-colors">
                    {count}
                  </span>
                  <p className="text-xs text-text-muted">
                    {pct.toFixed(0)}%
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Dataset Progress */}
      <section>
        <h3 className="font-display text-lg font-semibold text-text-primary mb-4">
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
              const reviewed = dataset.reviewed_count ?? 0
              const progress = totalFiles > 0 ? (reviewed / totalFiles) * 100 : 0

              return (
                <div
                  key={dataset.id}
                  className="bg-surface border border-border-default rounded-lg p-5"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-display font-semibold text-text-primary text-sm">
                        Dataset {dataset.number}
                        {dataset.name ? `: ${dataset.name}` : ''}
                      </h4>
                      {dataset.description && (
                        <p className="text-xs text-text-muted mt-0.5 line-clamp-1">
                          {dataset.description}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${getStatusBadgeClasses(dataset.status)}`}
                    >
                      {getStatusLabel(dataset.status)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-2">
                    <div className="bg-elevated rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${getStatusColor(dataset.status)}`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-text-muted">
                    <span>
                      {reviewed.toLocaleString()} / {totalFiles.toLocaleString()} files reviewed
                    </span>
                    <span>{progress.toFixed(1)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </MainContent>
  )
}
