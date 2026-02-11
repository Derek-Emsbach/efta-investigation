import Link from 'next/link'
import { notFound } from 'next/navigation'
import MainContent from '@/components/layout/main-content'
import Breadcrumbs from '@/components/ui/breadcrumbs'
import { TierBadge } from '@/components/ui/tier-badge'
import { StatCard } from '@/components/ui/stat-card'
import EntityProfileTabs from '@/components/entity/profile-tabs'
import { createClient } from '@/lib/supabase/server'
import type {
  Entity,
  EntityDocument,
  EntityEvent,
  EntityConnection,
  EvidenceItem,
  Document,
  Event,
  Tier,
} from '@efta/shared'

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null

  const colorMap: Record<string, string> = {
    convicted: 'bg-critical/10 text-critical',
    not_investigated: 'bg-warning/10 text-warning',
    settled: 'bg-info/10 text-info',
    identified: 'bg-text-secondary/10 text-text-secondary',
    deceased: 'bg-text-muted/10 text-text-muted',
    active: 'bg-success/10 text-success',
    unknown: 'bg-text-muted/10 text-text-muted',
  }

  return (
    <span
      className={`inline-flex text-xs font-medium px-2 py-0.5 rounded ${colorMap[status] ?? 'bg-text-muted/10 text-text-muted'}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}


export default async function EntityProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch entity and all related data in parallel
  const [entityResult, documentsResult, eventsResult, connectionsAsAResult, connectionsAsBResult, evidenceResult] =
    await Promise.all([
      supabase.from('entities').select('*').eq('id', id).single(),
      supabase.from('entity_documents').select('*, document:documents(*)').eq('entity_id', id),
      supabase.from('entity_events').select('*, event:events(*)').eq('entity_id', id),
      supabase.from('entity_connections').select('*, connected_entity:entities!entity_b(*)').eq('entity_a', id),
      supabase.from('entity_connections').select('*, connected_entity:entities!entity_a(*)').eq('entity_b', id),
      supabase.from('evidence_items').select('*').eq('entity_id', id),
    ])

  if (entityResult.error || !entityResult.data) {
    notFound()
  }

  const entity = entityResult.data as Entity

  // Merge and prepare related data
  const documents = (documentsResult.data ?? []) as (EntityDocument & { document: Document })[]
  const evidenceItems = (evidenceResult.data ?? []) as EvidenceItem[]

  const events = ((eventsResult.data ?? []) as (EntityEvent & { event: Event })[]).sort((a, b) => {
    const dateA = a.event?.date ?? ''
    const dateB = b.event?.date ?? ''
    return dateA.localeCompare(dateB)
  })

  const connections = [
    ...((connectionsAsAResult.data ?? []) as (EntityConnection & { connected_entity: Entity })[]),
    ...((connectionsAsBResult.data ?? []) as (EntityConnection & { connected_entity: Entity })[]),
  ]

  const docCount = documents.length
  const eventCount = events.length
  const connectionCount = connections.length
  const evidenceCount = evidenceItems.length

  return (
    <MainContent>
      <Breadcrumbs current={entity.name} />

      {/* Main layout: 2-col on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content area (2 cols) */}
        <div className="lg:col-span-2 space-y-8">
          {/* Hero section */}
          <div className="flex items-start gap-5">
            {/* Avatar with initials */}
            <div className="w-16 h-16 rounded-full bg-elevated border border-border-default flex items-center justify-center shrink-0">
              <span className="font-display text-xl font-bold text-text-secondary">
                {getInitials(entity.name)}
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-display text-3xl font-bold text-text-primary">
                  {entity.name}
                </h1>
                {entity.tier && <TierBadge tier={entity.tier as Tier} size="md" />}
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                {entity.category && (
                  <span className="text-sm text-text-secondary capitalize">
                    {entity.category.replace(/_/g, ' ')}
                  </span>
                )}
                <StatusBadge status={entity.status} />
              </div>
              {entity.tier_justification && (
                <p className="text-sm text-text-muted italic mt-2">
                  {entity.tier_justification}
                </p>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Documents" value={docCount} accent="#F59E0B" />
            <StatCard label="Evidence Items" value={evidenceCount} accent="#DC2626" />
            <StatCard label="Timeline Events" value={eventCount} accent="#10B981" />
            <StatCard label="Connections" value={connectionCount} accent="#3B82F6" />
          </div>

          {/* Background / Bio */}
          {entity.bio && (
            <section>
              <h3 className="font-display text-lg font-semibold text-text-primary mb-3">
                Background
              </h3>
              <div className="bg-surface border border-border-default rounded-lg p-6">
                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                  {entity.bio}
                </p>
              </div>
            </section>
          )}

          {/* Tabbed detail section */}
          <section>
            <EntityProfileTabs
              documents={documents}
              events={events}
              connections={connections}
              evidence={evidenceItems}
              entityId={id}
            />
          </section>
        </div>

        {/* Sidebar (1 col) */}
        <div className="space-y-6">
          {/* Quick Facts */}
          <div className="bg-surface border border-border-default rounded-lg p-5">
            <h3 className="font-display text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">
              Quick Facts
            </h3>
            <dl className="space-y-4">
              {entity.entity_type && (
                <div>
                  <dt className="text-xs text-text-muted uppercase tracking-wider">Type</dt>
                  <dd className="text-sm text-text-primary mt-0.5 capitalize">
                    {entity.entity_type}
                  </dd>
                </div>
              )}

              {entity.status && (
                <div>
                  <dt className="text-xs text-text-muted uppercase tracking-wider">Status</dt>
                  <dd className="text-sm text-text-primary mt-0.5 capitalize">
                    {entity.status.replace(/_/g, ' ')}
                  </dd>
                </div>
              )}

              {entity.datasets_appeared && entity.datasets_appeared.length > 0 && (
                <div>
                  <dt className="text-xs text-text-muted uppercase tracking-wider">
                    Datasets Appeared In
                  </dt>
                  <dd className="flex flex-wrap gap-1.5 mt-1">
                    {entity.datasets_appeared.map((ds) => (
                      <span
                        key={ds}
                        className="inline-flex text-xs font-mono font-medium px-2 py-0.5 rounded bg-elevated text-text-secondary border border-border-light"
                      >
                        DS{ds}
                      </span>
                    ))}
                  </dd>
                </div>
              )}

              {entity.aliases && entity.aliases.length > 0 && (
                <div>
                  <dt className="text-xs text-text-muted uppercase tracking-wider">Aliases</dt>
                  <dd className="space-y-1 mt-1">
                    {entity.aliases.map((alias) => (
                      <div key={alias} className="text-sm text-text-secondary">
                        {alias}
                      </div>
                    ))}
                  </dd>
                </div>
              )}

              {entity.tier && (
                <div>
                  <dt className="text-xs text-text-muted uppercase tracking-wider">
                    Tier Classification
                  </dt>
                  <dd className="mt-1">
                    <TierBadge tier={entity.tier as Tier} size="md" />
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </MainContent>
  )
}
