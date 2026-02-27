import Link from 'next/link'
import MainContent from '@/components/layout/main-content'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard } from '@/components/ui/stat-card'
import { createClient } from '@/lib/supabase/server'
import type { Dataset, DatasetStatus, DatasetPriority } from '@efta/shared'

// --- Status helpers ---

function statusLabel(s: DatasetStatus): string {
  switch (s) {
    case 'completed': return 'Completed'
    case 'in_progress': return 'In Progress'
    case 'not_started': return 'Not Started'
    default: return s
  }
}

function statusBadge(s: DatasetStatus): string {
  switch (s) {
    case 'completed': return 'bg-success/10 text-success'
    case 'in_progress': return 'bg-info/10 text-info'
    case 'not_started': return 'bg-text-muted/10 text-text-muted'
    default: return 'bg-text-muted/10 text-text-muted'
  }
}

function statusBarColor(s: DatasetStatus): string {
  switch (s) {
    case 'completed': return 'bg-success'
    case 'in_progress': return 'bg-info'
    case 'not_started': return 'bg-border-default'
    default: return 'bg-border-default'
  }
}

// --- Priority helpers ---

function priorityBadge(p: DatasetPriority): string {
  switch (p) {
    case 'critical': return 'bg-critical/10 text-critical'
    case 'high': return 'bg-warning/10 text-warning'
    case 'medium': return 'bg-info/10 text-info'
    case 'low': return 'bg-text-muted/10 text-text-muted'
    default: return 'bg-text-muted/10 text-text-muted'
  }
}

function priorityLabel(p: DatasetPriority): string {
  return p.charAt(0).toUpperCase() + p.slice(1)
}

// --- Formatting ---

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default async function DatasetsPage() {
  const supabase = await createClient()

  // Fetch datasets + live reviewed counts from documents table in parallel
  const [datasetsResult, reviewedResult] = await Promise.all([
    supabase.from('datasets').select('*').order('number', { ascending: true }),
    supabase.rpc('dataset_reviewed_counts'),
  ])

  const { data, error } = datasetsResult
  const datasets = (data ?? []) as Dataset[]

  // Build lookup: dataset_id → count of reviewed documents
  const reviewedCounts: Record<string, number> = {}
  if (reviewedResult.data && Array.isArray(reviewedResult.data)) {
    for (const row of reviewedResult.data as { dataset_id: string; count: number }[]) {
      reviewedCounts[row.dataset_id] = row.count
    }
  }

  if (error) {
    return (
      <MainContent>
        <PageHeader title="Datasets" subtitle="DOJ EFTA document release collections" />
        <div className="bg-critical/10 border border-critical/30 rounded-lg p-6 text-critical">
          Failed to load datasets: {error.message}
        </div>
      </MainContent>
    )
  }

  // Aggregate stats — use live reviewed counts
  const totalFiles = datasets.reduce((sum, d) => sum + (d.total_files ?? 0), 0)
  const totalPages = datasets.reduce((sum, d) => sum + (d.total_pages ?? 0), 0)
  const totalReviewed = datasets.reduce((sum, d) => sum + (reviewedCounts[d.id] ?? 0), 0)
  const totalSize = datasets.reduce((sum, d) => sum + (d.size_bytes ?? 0), 0)
  const overallProgress = totalFiles > 0 ? ((totalReviewed / totalFiles) * 100).toFixed(1) : '0.0'
  const completedCount = datasets.filter((d) => d.status === 'completed').length
  const inProgressCount = datasets.filter((d) => d.status === 'in_progress').length

  return (
    <MainContent>
      <PageHeader
        title="Datasets"
        subtitle={`${datasets.length} DOJ EFTA document release collections`}
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Files" value={totalFiles} accent="#3B82F6" />
        <StatCard label="Total Pages" value={totalPages} accent="#F59E0B" />
        <StatCard label="Overall Progress" value={`${overallProgress}%`} accent="#10B981" />
        <StatCard label="Total Size" value={formatBytes(totalSize)} accent="#8B5CF6" />
      </div>

      {/* Status summary bar */}
      <div className="flex items-center gap-6 mb-8 text-sm text-text-secondary">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-success" />
          {completedCount} Completed
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-info" />
          {inProgressCount} In Progress
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-border-default" />
          {datasets.length - completedCount - inProgressCount} Not Started
        </span>
      </div>

      {/* Dataset cards */}
      {datasets.length === 0 ? (
        <EmptyState
          icon={
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
            </svg>
          }
          label="Datasets"
          title="No datasets loaded yet"
          description="Import dataset metadata from DOJ EFTA document releases to get started."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {datasets.map((ds) => {
            const files = ds.total_files ?? 0
            const reviewed = reviewedCounts[ds.id] ?? 0
            const progress = files > 0 ? (reviewed / files) * 100 : 0

            return (
              <Link
                key={ds.id}
                href={`/dashboard/documents?dataset=${ds.id}`}
                className="block bg-surface border border-border-default rounded-lg p-6 hover:border-border-light transition-colors"
              >
                {/* Header: title + badges */}
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-lg font-bold text-text-primary">
                        DS{ds.number}
                      </span>
                      {ds.name && (
                        <span className="font-display text-lg font-semibold text-text-secondary truncate">
                          {ds.name}
                        </span>
                      )}
                    </div>
                    {ds.description && (
                      <p className="text-sm text-text-muted mt-1 line-clamp-2">
                        {ds.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${priorityBadge(ds.priority)}`}>
                      {priorityLabel(ds.priority)}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusBadge(ds.status)}`}>
                      {statusLabel(ds.status)}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="bg-elevated rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${statusBarColor(ds.status)}`}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-text-muted mt-1">
                    <span>
                      {reviewed.toLocaleString()} / {files.toLocaleString()} files reviewed
                    </span>
                    <span>{progress.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Metadata grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs border-t border-border-default pt-3">
                  {ds.total_pages !== null && (
                    <div>
                      <span className="text-text-muted">Pages:</span>{' '}
                      <span className="text-text-secondary font-medium">
                        {ds.total_pages.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {ds.size_bytes !== null && (
                    <div>
                      <span className="text-text-muted">Size:</span>{' '}
                      <span className="text-text-secondary font-medium">
                        {formatBytes(ds.size_bytes)}
                      </span>
                    </div>
                  )}
                  {ds.bates_range_start && ds.bates_range_end && (
                    <div className="col-span-2">
                      <span className="text-text-muted">Bates Range:</span>{' '}
                      <span className="font-mono text-text-secondary">
                        {ds.bates_range_start}
                      </span>
                      <span className="text-text-muted mx-1">&ndash;</span>
                      <span className="font-mono text-text-secondary">
                        {ds.bates_range_end}
                      </span>
                    </div>
                  )}
                  {ds.release_date && (
                    <div>
                      <span className="text-text-muted">Released:</span>{' '}
                      <span className="text-text-secondary font-medium">
                        {formatDate(ds.release_date)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {ds.notes && (
                  <div className="mt-3 pt-3 border-t border-border-default">
                    <p className="text-xs text-text-muted italic line-clamp-2">
                      {ds.notes}
                    </p>
                  </div>
                )}

                {/* View documents link */}
                {files > 0 && (
                  <div className="mt-3 pt-3 border-t border-border-default">
                    <span className="text-xs font-medium text-info hover:text-info/80 transition-colors">
                      View {files.toLocaleString()} documents &rarr;
                    </span>
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </MainContent>
  )
}
