import MainContent from '@/components/layout/main-content'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { TierBadge } from '@/components/ui/tier-badge'
import { TIER_CONFIG } from '@efta/shared'
import type { Tier, Dataset, DatasetStatus } from '@efta/shared'
import { createClient } from '@/lib/supabase/server'

const TIERS: Tier[] = [1, 2, 3, 4, 5, 6]

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

export default async function DashboardPage() {
  const supabase = await createClient()

  // Run all queries in parallel for performance
  const [
    entitiesResult,
    documentsResult,
    eventsResult,
    criticalDocsResult,
    datasetsResult,
    ...tierResults
  ] = await Promise.all([
    supabase.from('entities').select('*', { count: 'exact', head: true }),
    supabase.from('documents').select('*', { count: 'exact', head: true }),
    supabase.from('events').select('*', { count: 'exact', head: true }),
    supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .in('severity', ['extreme_critical', 'critical']),
    supabase.from('datasets').select('*').order('number', { ascending: true }),
    ...TIERS.map((tier) =>
      supabase.from('entities').select('*', { count: 'exact', head: true }).eq('tier', tier)
    ),
  ])

  const entityCount = entitiesResult.count ?? 0
  const documentCount = documentsResult.count ?? 0
  const eventCount = eventsResult.count ?? 0
  const criticalCount = criticalDocsResult.count ?? 0
  const datasets = (datasetsResult.data as Dataset[] | null) ?? []

  const tierCounts: Record<Tier, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  for (let i = 0; i < TIERS.length; i++) {
    tierCounts[TIERS[i]] = tierResults[i].count ?? 0
  }

  return (
    <MainContent>
      <PageHeader
        title="EFTA Investigation Dashboard"
        subtitle="Systematic analysis of 3.5 million pages of DOJ Epstein Files disclosures"
      />

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard label="Total Entities" value={entityCount} accent="#3B82F6" />
        <StatCard label="Total Documents" value={documentCount} accent="#F59E0B" />
        <StatCard label="Total Events" value={eventCount} accent="#10B981" />
        <StatCard
          label="Extreme / Critical Findings"
          value={criticalCount}
          accent="#DC2626"
        />
      </div>

      {/* Entity Tier Distribution */}
      <section className="mb-10">
        <h3 className="font-display text-lg font-semibold text-text-primary mb-4">
          Entity Distribution by Tier
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TIERS.map((tier) => (
            <div
              key={tier}
              className="bg-surface border border-border-default rounded-lg p-4 flex items-center justify-between"
            >
              <TierBadge tier={tier} size="md" />
              <span className="text-2xl font-display font-bold text-text-primary">
                {tierCounts[tier].toLocaleString()}
              </span>
            </div>
          ))}
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
