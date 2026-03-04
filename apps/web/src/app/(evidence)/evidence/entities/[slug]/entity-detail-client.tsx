'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { TierBadge } from '@/components/ui/tier-badge'
import type { Tier } from '@efta/shared'

// -------------------------------------------------------------------
// Types (matching public API response shapes)
// -------------------------------------------------------------------

interface EntityData {
  id: string
  name: string
  slug: string
  entity_type: string
  tier: number | null
  category: string | null
  bio: string | null
  status: string | null
  aliases: string[] | null
  financial_exposure: string | null
  key_roles: string[] | null
  first_appearance: string | null
  last_known_activity: string | null
  profile_image_url: string | null
}

interface ConnectionRecord {
  id: string
  relationship_type: string
  evidence_strength: string | null
  description: string | null
  connected_entity: {
    id: string
    name: string
    slug: string | null
    tier: number | null
    entity_type: string
    category: string | null
    profile_published: boolean
  }
}

interface DocumentRecord {
  id: string
  role: string | null
  document: {
    id: string
    bates_number: string | null
    title: string | null
    document_type: string | null
    original_date: string | null
    severity: string | null
    page_count: number | null
    summary: string | null
  }
}

interface EventRecord {
  id: string
  role: string | null
  event: {
    id: string
    date: string | null
    date_end: string | null
    title: string
    description: string | null
    event_type: string | null
    significance: string | null
  }
}

interface StoryRecord {
  story: {
    id: string
    slug: string
    title: string
    deck: string | null
    section: string | null
    published_at: string | null
    is_published: boolean
  }
}

interface CaseFileRecord {
  case_file: {
    id: string
    slug: string
    case_id: string
    title: string
    status: string | null
    summary: string | null
    is_published: boolean
  }
}

interface ApiResponse {
  entity: EntityData
  documents: DocumentRecord[]
  events: EventRecord[]
  connections: ConnectionRecord[]
  stories: StoryRecord[]
  caseFiles: CaseFileRecord[]
}

type Tab = 'connections' | 'documents' | 'timeline' | 'stories'

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatLabel(str: string): string {
  return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  legal: '#3B82F6',
  evidence: '#DC2626',
  communication: '#F59E0B',
  institutional: '#6B7280',
  personal: '#A855F7',
  financial: '#10B981',
  legislative: '#14B8A6',
  travel: '#F97316',
  sighting: '#EC4899',
}

const STRENGTH_COLORS: Record<string, string> = {
  documented: '#34d399',
  alleged: '#f59e0b',
  circumstantial: '#6b7280',
}

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------

export function EntityDetailClient({ slug }: { slug: string }) {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('connections')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/public/entities/${slug}`)
        if (!res.ok) {
          setError(res.status === 404 ? 'Entity not found' : 'Failed to load entity')
          return
        }
        setData(await res.json())
      } catch {
        setError('Failed to load entity')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="space-y-4">
          <div className="h-8 w-64 bg-surface rounded animate-pulse" />
          <div className="h-4 w-96 bg-surface rounded animate-pulse" />
          <div className="mt-8 h-64 bg-surface rounded-lg animate-pulse" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-16 text-center">
        <p className="text-text-muted font-mono text-sm">{error ?? 'Entity not found'}</p>
        <Link href="/evidence/entities" className="text-critical text-sm mt-4 inline-block hover:underline">
          Back to Entity Directory
        </Link>
      </div>
    )
  }

  const { entity, connections, documents, events, stories, caseFiles } = data

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'connections', label: 'Connections', count: connections.length },
    { key: 'documents', label: 'Documents', count: documents.length },
    { key: 'timeline', label: 'Timeline', count: events.length },
    { key: 'stories', label: 'Stories & Cases', count: stories.length + caseFiles.length },
  ]

  return (
    <div className="min-h-[calc(100vh-120px)]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-text-muted font-mono mb-6">
          <Link href="/evidence/entities" className="hover:text-text-secondary transition-colors">
            Entities
          </Link>
          <span>/</span>
          <span className="text-text-secondary">{entity.name}</span>
        </div>

        {/* Entity header */}
        <div className="bg-surface border border-border-default rounded-lg p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              {entity.profile_image_url ? (
                <div className="w-16 h-16 border border-border-default overflow-hidden shrink-0 relative rounded-sm">
                  <Image
                    src={entity.profile_image_url}
                    alt={entity.name}
                    fill
                    sizes="64px"
                    className="object-cover"
                    unoptimized={!entity.profile_image_url.includes('wikimedia.org')}
                  />
                </div>
              ) : (
                <div className="w-16 h-16 bg-elevated border border-border-default flex items-center justify-center shrink-0 rounded-sm">
                  <span className="font-mono text-lg text-text-muted">
                    {entity.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('')}
                  </span>
                </div>
              )}
              <div>
                <h1 className="font-display text-2xl font-bold text-text-primary">
                  {entity.name}
                </h1>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
                  {formatLabel(entity.entity_type)}
                </span>
                {entity.tier && <TierBadge tier={entity.tier as Tier} size="md" />}
                {entity.category && (
                  <span className="text-xs font-mono text-text-muted">
                    {formatLabel(entity.category)}
                  </span>
                )}
                {entity.status && (
                  <span className={`text-xs font-mono ${
                    entity.status === 'confirmed' ? 'text-neon-green' :
                    entity.status === 'under_investigation' ? 'text-neon-blue' :
                    'text-text-muted'
                  }`}>
                    {formatLabel(entity.status)}
                  </span>
                )}
              </div>
              </div>
            </div>

            {/* Link to publication profile */}
            <Link
              href={`/entities/${entity.slug}`}
              className="shrink-0 text-xs font-mono text-text-muted hover:text-critical transition-colors border border-border-default rounded px-3 py-1.5"
            >
              View Dossier →
            </Link>
          </div>

          {/* Bio */}
          {entity.bio && (
            <p className="text-sm text-text-secondary mt-4 leading-relaxed">{entity.bio}</p>
          )}

          {/* Metadata grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t border-border-default">
            {entity.financial_exposure && (
              <div>
                <span className="text-xs font-mono text-text-muted block">Financial Exposure</span>
                <span className="text-sm text-neon-green font-mono">{entity.financial_exposure}</span>
              </div>
            )}
            {entity.first_appearance && (
              <div>
                <span className="text-xs font-mono text-text-muted block">First Appearance</span>
                <span className="text-sm text-text-secondary">{entity.first_appearance}</span>
              </div>
            )}
            {entity.last_known_activity && (
              <div>
                <span className="text-xs font-mono text-text-muted block">Last Activity</span>
                <span className="text-sm text-text-secondary">{entity.last_known_activity}</span>
              </div>
            )}
            {entity.aliases && entity.aliases.length > 0 && (
              <div>
                <span className="text-xs font-mono text-text-muted block">Aliases</span>
                <span className="text-sm text-text-secondary">{entity.aliases.join(', ')}</span>
              </div>
            )}
            {entity.key_roles && entity.key_roles.length > 0 && (
              <div className="col-span-2">
                <span className="text-xs font-mono text-text-muted block">Key Roles</span>
                <span className="text-sm text-text-secondary">{entity.key_roles.join(' · ')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border-default mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-mono transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? 'border-critical text-critical'
                  : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs opacity-60">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'connections' && (
          <ConnectionsTab connections={connections} />
        )}
        {activeTab === 'documents' && (
          <DocumentsTab documents={documents} />
        )}
        {activeTab === 'timeline' && (
          <TimelineTab events={events} />
        )}
        {activeTab === 'stories' && (
          <StoriesTab stories={stories} caseFiles={caseFiles} />
        )}
      </div>
    </div>
  )
}

// -------------------------------------------------------------------
// Tab components
// -------------------------------------------------------------------

function ConnectionsTab({ connections }: { connections: ConnectionRecord[] }) {
  if (connections.length === 0) {
    return <EmptyTab message="No documented connections" />
  }

  return (
    <div className="border border-border-default rounded-lg overflow-hidden">
      <div className="grid grid-cols-[1fr_140px_120px_1fr] gap-4 px-4 py-2.5 bg-elevated/50 border-b border-border-default text-xs font-mono text-text-muted uppercase tracking-wider">
        <span>Entity</span>
        <span>Relationship</span>
        <span>Strength</span>
        <span>Description</span>
      </div>
      <div className="divide-y divide-border-default">
        {connections.map((conn) => {
          const ce = conn.connected_entity
          const strengthColor = STRENGTH_COLORS[conn.evidence_strength ?? ''] ?? '#6b7280'

          return (
            <div key={conn.id} className="grid grid-cols-[1fr_140px_120px_1fr] gap-4 px-4 py-3 items-center">
              <div className="min-w-0">
                {ce.profile_published && ce.slug ? (
                  <Link
                    href={`/evidence/entities/${ce.slug}`}
                    className="text-sm font-medium text-text-primary hover:text-critical transition-colors truncate block"
                  >
                    {ce.name}
                  </Link>
                ) : (
                  <span className="text-sm text-text-secondary truncate block">{ce.name}</span>
                )}
                {ce.tier && (
                  <span className="mt-0.5 inline-block">
                    <TierBadge tier={ce.tier as Tier} size="sm" />
                  </span>
                )}
              </div>
              <span className="text-xs font-mono text-text-secondary">
                {formatLabel(conn.relationship_type)}
              </span>
              <span
                className="text-xs font-mono"
                style={{ color: strengthColor }}
              >
                {conn.evidence_strength ? formatLabel(conn.evidence_strength) : '—'}
              </span>
              <span className="text-xs text-text-muted truncate">
                {conn.description ?? '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DocumentsTab({ documents }: { documents: DocumentRecord[] }) {
  if (documents.length === 0) {
    return <EmptyTab message="No linked documents" />
  }

  return (
    <div className="border border-border-default rounded-lg overflow-hidden">
      <div className="grid grid-cols-[140px_1fr_100px_100px_80px] gap-4 px-4 py-2.5 bg-elevated/50 border-b border-border-default text-xs font-mono text-text-muted uppercase tracking-wider">
        <span>Bates #</span>
        <span>Title</span>
        <span>Type</span>
        <span>Date</span>
        <span>Pages</span>
      </div>
      <div className="divide-y divide-border-default">
        {documents.map((doc) => {
          const d = doc.document
          return (
            <div key={doc.id} className="grid grid-cols-[140px_1fr_100px_100px_80px] gap-4 px-4 py-3 items-center">
              <span className="text-xs font-mono text-neon-cyan truncate">
                {d.bates_number ?? '—'}
              </span>
              <span className="text-sm text-text-primary truncate">
                {d.title ?? 'Untitled document'}
              </span>
              <span className="text-xs font-mono text-text-muted">
                {d.document_type ? formatLabel(d.document_type) : '—'}
              </span>
              <span className="text-xs font-mono text-text-muted">
                {d.original_date ? formatDate(d.original_date) : '—'}
              </span>
              <span className="text-xs font-mono text-text-muted text-right">
                {d.page_count ?? '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TimelineTab({ events }: { events: EventRecord[] }) {
  if (events.length === 0) {
    return <EmptyTab message="No timeline events" />
  }

  return (
    <div className="relative ml-4 border-l-2 border-border-default space-y-0">
      {events.map((er) => {
        const ev = er.event
        const typeColor = EVENT_TYPE_COLORS[ev.event_type ?? ''] ?? '#6B7280'

        return (
          <div key={er.id} className="relative pl-8 pb-6 last:pb-0">
            <span
              className="absolute left-[-5px] top-2 w-2 h-2 rounded-full"
              style={{ backgroundColor: typeColor }}
            />
            <div className="bg-surface border border-border-default rounded-lg p-4">
              <div className="flex items-start gap-3">
                <h4 className="text-sm font-medium text-text-primary flex-1">{ev.title}</h4>
                {ev.event_type && (
                  <span
                    className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded shrink-0"
                    style={{ color: typeColor, backgroundColor: `${typeColor}15` }}
                  >
                    {formatLabel(ev.event_type)}
                  </span>
                )}
              </div>
              {ev.date && (
                <p className="text-xs font-mono text-text-muted mt-1">
                  {formatDate(ev.date)}
                  {ev.date_end && ev.date_end !== ev.date && (
                    <> — {formatDate(ev.date_end)}</>
                  )}
                </p>
              )}
              {ev.description && (
                <p className="text-sm text-text-secondary mt-2 leading-relaxed">{ev.description}</p>
              )}
              {er.role && (
                <p className="text-xs font-mono text-text-muted mt-2">Role: {er.role}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StoriesTab({ stories, caseFiles }: { stories: StoryRecord[]; caseFiles: CaseFileRecord[] }) {
  if (stories.length === 0 && caseFiles.length === 0) {
    return <EmptyTab message="No linked stories or case files" />
  }

  return (
    <div className="space-y-4">
      {stories.length > 0 && (
        <div>
          <h3 className="text-xs font-mono text-text-muted uppercase tracking-wider mb-3">Stories</h3>
          <div className="space-y-2">
            {stories.map((sr) => (
              <Link
                key={sr.story.id}
                href={`/stories/${sr.story.slug}`}
                className="block bg-surface border border-border-default rounded-lg p-4 hover:border-critical/30 transition-colors group"
              >
                <p className="text-sm font-medium text-text-primary group-hover:text-critical transition-colors">
                  {sr.story.title}
                </p>
                {sr.story.deck && (
                  <p className="text-xs text-text-muted mt-1 line-clamp-2">{sr.story.deck}</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  {sr.story.section && (
                    <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
                      {sr.story.section.replace(/-/g, ' ')}
                    </span>
                  )}
                  {sr.story.published_at && (
                    <span className="text-[10px] font-mono text-text-muted">
                      {formatDate(sr.story.published_at.split('T')[0])}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {caseFiles.length > 0 && (
        <div>
          <h3 className="text-xs font-mono text-text-muted uppercase tracking-wider mb-3">Case Files</h3>
          <div className="space-y-2">
            {caseFiles.map((cfr) => (
              <Link
                key={cfr.case_file.id}
                href={`/case-files/${cfr.case_file.slug}`}
                className="block bg-surface border border-border-default rounded-lg p-4 hover:border-critical/30 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-neon-cyan">{cfr.case_file.case_id}</span>
                  <span className="text-text-muted">·</span>
                  <p className="text-sm font-medium text-text-primary group-hover:text-critical transition-colors">
                    {cfr.case_file.title}
                  </p>
                </div>
                {cfr.case_file.summary && (
                  <p className="text-xs text-text-muted mt-1 line-clamp-2">{cfr.case_file.summary}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <p className="text-sm text-text-muted font-mono">{message}</p>
    </div>
  )
}
