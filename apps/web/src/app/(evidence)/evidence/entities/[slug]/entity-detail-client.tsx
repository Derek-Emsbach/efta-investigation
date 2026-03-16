'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { TierBadge } from '@/components/ui/tier-badge'
import { EntityPlaceholder } from '@/components/ui/entity-placeholder'
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
  video_links: { url: string; title: string; source?: string; date?: string }[] | null
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

interface PhotoRecord {
  id: string
  document_id: string
  page_number: number
  image_index: number
  r2_key: string
  thumbnail_r2_key: string | null
  width: number | null
  height: number | null
  format: string | null
  image_type: string
  tags: string[]
  caption: string | null
  is_redacted: boolean
  metadata: Record<string, unknown>
  created_at: string
  file_size_bytes: number | null
}

interface ApiResponse {
  entity: EntityData
  documents: DocumentRecord[]
  events: EventRecord[]
  connections: ConnectionRecord[]
  stories: StoryRecord[]
  caseFiles: CaseFileRecord[]
  photos: PhotoRecord[]
}

type Tab = 'connections' | 'documents' | 'timeline' | 'stories' | 'photos' | 'videos'

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

  const { entity, connections, documents, events, stories, caseFiles, photos } = data
  const videos = entity.video_links ?? []

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'connections', label: 'Connections', count: connections.length },
    { key: 'documents', label: 'Documents', count: documents.length },
    { key: 'timeline', label: 'Timeline', count: events.length },
    { key: 'stories', label: 'Stories & Cases', count: stories.length + caseFiles.length },
    ...(photos.length > 0 ? [{ key: 'photos' as Tab, label: 'Photos', count: photos.length }] : []),
    ...(videos.length > 0 ? [{ key: 'videos' as Tab, label: 'Videos', count: videos.length }] : []),
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
                    unoptimized
                  />
                </div>
              ) : (
                <EntityPlaceholder
                  name={entity.name}
                  entityType={entity.entity_type}
                  size={64}
                  className="border border-border-default rounded-sm"
                />
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
        <div className="flex items-center gap-1 border-b border-border-default mb-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap shrink-0 px-3 sm:px-4 py-2.5 text-sm font-mono transition-colors border-b-2 -mb-px ${
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
        {activeTab === 'photos' && (
          <PhotosTab photos={photos} />
        )}
        {activeTab === 'videos' && (
          <VideosTab videos={videos} />
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
      <div className="grid grid-cols-[1fr_120px] sm:grid-cols-[1fr_140px_120px_1fr] gap-4 px-4 py-2.5 bg-elevated/50 border-b border-border-default text-xs font-mono text-text-muted uppercase tracking-wider">
        <span>Entity</span>
        <span>Relationship</span>
        <span className="hidden sm:block">Strength</span>
        <span className="hidden sm:block">Description</span>
      </div>
      <div className="divide-y divide-border-default">
        {connections.map((conn) => {
          const ce = conn.connected_entity
          const strengthColor = STRENGTH_COLORS[conn.evidence_strength ?? ''] ?? '#6b7280'

          return (
            <div key={conn.id} className="grid grid-cols-[1fr_120px] sm:grid-cols-[1fr_140px_120px_1fr] gap-4 px-4 py-3 items-center">
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
                className="hidden sm:block text-xs font-mono"
                style={{ color: strengthColor }}
              >
                {conn.evidence_strength ? formatLabel(conn.evidence_strength) : '—'}
              </span>
              <span className="hidden sm:block text-xs text-text-muted truncate">
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
      <div className="grid grid-cols-[100px_1fr] sm:grid-cols-[140px_1fr_100px_100px_80px] gap-4 px-4 py-2.5 bg-elevated/50 border-b border-border-default text-xs font-mono text-text-muted uppercase tracking-wider">
        <span>Bates #</span>
        <span>Title</span>
        <span className="hidden sm:block">Type</span>
        <span className="hidden sm:block">Date</span>
        <span className="hidden sm:block">Pages</span>
      </div>
      <div className="divide-y divide-border-default">
        {documents.map((doc) => {
          const d = doc.document
          return (
            <div key={doc.id} className="grid grid-cols-[100px_1fr] sm:grid-cols-[140px_1fr_100px_100px_80px] gap-4 px-4 py-3 items-center">
              {d.bates_number ? (
                <Link href={`/evidence/documents/${d.bates_number}`} className="text-xs font-mono text-neon-cyan truncate hover:underline">
                  {d.bates_number}
                </Link>
              ) : (
                <span className="text-xs font-mono text-neon-cyan truncate">—</span>
              )}
              <span className="text-sm text-text-primary truncate">
                {d.title ?? 'Untitled document'}
              </span>
              <span className="hidden sm:block text-xs font-mono text-text-muted">
                {d.document_type ? formatLabel(d.document_type) : '—'}
              </span>
              <span className="hidden sm:block text-xs font-mono text-text-muted">
                {d.original_date ? formatDate(d.original_date) : '—'}
              </span>
              <span className="hidden sm:block text-xs font-mono text-text-muted text-right">
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

function PhotosTab({ photos }: { photos: PhotoRecord[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  if (photos.length === 0) {
    return <EmptyTab message="No photos tagged for this entity" />
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {photos.map((img, idx) => (
          <button
            key={img.id}
            onClick={() => setLightboxIndex(idx)}
            className="group relative flex flex-col rounded border border-border-default bg-surface overflow-hidden hover:border-critical/30 transition-all duration-200 text-left"
          >
            <div className="relative aspect-square bg-background overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/public/images/${img.id}/thumbnail`}
                alt={img.caption ?? `Page ${img.page_number + 1}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-text-primary"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="11" y1="8" x2="11" y2="14" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </div>
              {img.is_redacted && (
                <span className="absolute top-1.5 right-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-critical/90 text-white uppercase tracking-wider">
                  Redacted
                </span>
              )}
              {img.image_type && img.image_type !== 'embedded' && img.image_type !== 'unknown' && (
                <span className="absolute top-1.5 left-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface/80 text-text-secondary capitalize backdrop-blur-sm">
                  {img.image_type}
                </span>
              )}
            </div>
            <div className="px-2 py-1.5 border-t border-border-default">
              {img.caption ? (
                <p className="text-[11px] text-text-secondary line-clamp-1">{img.caption}</p>
              ) : (
                <p className="text-[10px] font-mono text-text-muted">
                  p.{img.page_number + 1}
                  {img.width && img.height && (
                    <span className="ml-1.5 opacity-60">
                      {img.width}&times;{img.height}
                    </span>
                  )}
                </p>
              )}
            </div>
            {img.tags.length > 0 && (
              <div className="px-2 pb-1.5 flex flex-wrap gap-1">
                {img.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-[9px] font-medium px-1 py-0.5 rounded bg-neon-cyan/10 text-neon-cyan"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  )
}

function PhotoLightbox({ photos, initialIndex, onClose }: { photos: PhotoRecord[]; initialIndex: number; onClose: () => void }) {
  const [index, setIndex] = useState(initialIndex)
  const [loaded, setLoaded] = useState(false)

  const img = photos[index]
  const hasPrev = index > 0
  const hasNext = index < photos.length - 1

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && hasNext) { setLoaded(false); setIndex((i) => i + 1) }
      if (e.key === 'ArrowLeft' && hasPrev) { setLoaded(false); setIndex((i) => i - 1) }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, hasNext, hasPrev])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  if (!img) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-background/95 backdrop-blur-sm" onClick={onClose} />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-11 h-11 sm:w-10 sm:h-10 rounded-full bg-elevated/80 border border-border-default flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
        aria-label="Close"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 font-mono text-xs text-text-muted bg-elevated/80 border border-border-default px-3 py-1.5 rounded-full">
        {index + 1} / {photos.length}
      </div>
      {hasPrev && (
        <button
          onClick={() => { setLoaded(false); setIndex((i) => i - 1) }}
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 sm:w-10 sm:h-10 rounded-full bg-elevated/80 border border-border-default flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
          aria-label="Previous"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
      )}
      {hasNext && (
        <button
          onClick={() => { setLoaded(false); setIndex((i) => i + 1) }}
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 sm:w-10 sm:h-10 rounded-full bg-elevated/80 border border-border-default flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
          aria-label="Next"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 6 15 12 9 18" /></svg>
        </button>
      )}
      <div className="relative max-w-[85vw] max-h-[85vh] flex items-center justify-center">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={img.id}
          src={`/api/public/images/${img.id}/file`}
          alt={img.caption ?? `Evidence image from page ${img.page_number + 1}`}
          className={`max-w-full max-h-[85vh] object-contain rounded transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
        />
      </div>
    </div>
  )
}

function VideosTab({ videos }: { videos: { url: string; title: string; source?: string; date?: string }[] }) {
  if (videos.length === 0) {
    return <EmptyTab message="No videos linked" />
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {videos.map((video, idx) => {
        const ytMatch = video.url.match(
          /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
        )
        const ytId = ytMatch?.[1]

        return (
          <div
            key={`${video.url}-${idx}`}
            className="rounded border border-border-default bg-surface overflow-hidden"
          >
            {ytId ? (
              <div className="relative aspect-video">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${ytId}`}
                  title={video.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                  loading="lazy"
                />
              </div>
            ) : (
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center aspect-video bg-elevated hover:bg-elevated/80 transition-colors"
              >
                <div className="text-center">
                  <svg className="w-10 h-10 text-text-muted mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span className="text-xs text-text-muted font-mono">Open External Video</span>
                </div>
              </a>
            )}
            <div className="px-3 py-2 border-t border-border-default">
              <p className="text-sm text-text-primary font-medium line-clamp-2">{video.title}</p>
              <div className="flex items-center gap-2 mt-1">
                {video.source && (
                  <span className="text-[10px] font-mono text-text-muted">{video.source}</span>
                )}
                {video.date && (
                  <span className="text-[10px] font-mono text-text-muted">{formatDate(video.date)}</span>
                )}
              </div>
            </div>
          </div>
        )
      })}
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
