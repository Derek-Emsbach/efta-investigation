import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import type {
  Entity,
  EntityDocument,
  EntityEvent,
  EntityConnection,
  EvidenceItem,
  Document,
  DocumentImage,
  VideoLink,
  Event,
  Story,
  StoryEntity,
  CaseFile,
  CaseFileEntity,
  Tier,
} from '@efta/shared'
import { TIER_CONFIG } from '@efta/shared'
import { EntityHero } from '@/components/publication/entity/entity-hero'
import { DossierCard } from '@/components/publication/entity/dossier-card'
import { FinancialSummaryCard } from '@/components/publication/entity/financial-summary-card'
import { EvidenceSection } from '@/components/publication/entity/evidence-section'
import { ConnectionsGrid } from '@/components/publication/entity/connections-grid'
import { DocumentsTable } from '@/components/publication/entity/documents-table'
import { EntityTimeline } from '@/components/publication/entity/entity-timeline'
import { StoriesSection } from '@/components/publication/entity/stories-section'
import { CaseFilesSection } from '@/components/publication/entity/case-files-section'
import { PersonJsonLd } from '@/components/publication/json-ld'
import { ProfileTabsWrapper } from './profile-tabs-wrapper'
import { PrintButton } from '@/components/ui/print-button'
import { CyclopsPromo } from '@/components/publication/promo/cyclops-promo'
import { SourceAdSlot } from '@/components/publication/promo/source-ad-slot'
import { CommentSection } from '@/components/publication/comments/comment-section'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const { data: entity } = await supabase
    .from('entities')
    .select('name, tier, bio')
    .eq('slug', slug)
    .eq('profile_published', true)
    .single()

  if (!entity) {
    return { title: 'Entity Not Found — The Epstein Crimes' }
  }

  const tierLabel = entity.tier
    ? TIER_CONFIG[entity.tier as Tier]?.label ?? ''
    : ''

  const description = entity.bio
    ? entity.bio.slice(0, 160)
    : `${entity.name} dossier — Tier ${entity.tier} (${tierLabel}). EFTA Investigation entity profile.`

  return {
    title: `${entity.name} — The Epstein Crimes`,
    description,
    openGraph: {
      title: `${entity.name} — The Epstein Crimes`,
      description,
      type: 'profile',
      siteName: 'The Epstein Crimes',
      images: [`/api/og?title=${encodeURIComponent(entity.name)}&subtitle=${encodeURIComponent(`Tier ${entity.tier} — ${tierLabel}`)}&type=entity`],
    },
    twitter: {
      card: 'summary',
      title: `${entity.name} — The Epstein Crimes`,
      description,
    },
  }
}

export default async function EntityProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // Fetch entity by slug — must be published
  const { data: entity, error: entityError } = await supabase
    .from('entities')
    .select('*')
    .eq('slug', slug)
    .eq('profile_published', true)
    .single()

  if (entityError || !entity) {
    notFound()
  }

  const entityId = entity.id

  // Fetch all relations in parallel
  const [
    documentsResult,
    eventsResult,
    connectionsAsAResult,
    connectionsAsBResult,
    evidenceResult,
    storiesResult,
    caseFilesResult,
    photosResult,
  ] = await Promise.all([
    supabase
      .from('entity_documents')
      .select('*, document:documents(id, bates_number, title, document_type, original_date, severity, page_count, summary)')
      .eq('entity_id', entityId),

    supabase
      .from('entity_events')
      .select('*, event:events(id, date, date_end, title, description, event_type, significance)')
      .eq('entity_id', entityId),

    supabase
      .from('entity_connections')
      .select('*, connected_entity:entities!entity_b(id, name, slug, tier, entity_type, category, profile_published)')
      .eq('entity_a', entityId),

    supabase
      .from('entity_connections')
      .select('*, connected_entity:entities!entity_a(id, name, slug, tier, entity_type, category, profile_published)')
      .eq('entity_b', entityId),

    supabase
      .from('evidence_items')
      .select('*')
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false }),

    supabase
      .from('story_entities')
      .select('*, story:stories(id, slug, title, deck, section, byline, published_at, is_published)')
      .eq('entity_id', entityId),

    supabase
      .from('case_file_entities')
      .select('*, case_file:case_files(id, slug, case_id, title, status, summary, completion_percentage, is_published)')
      .eq('entity_id', entityId),

    // Photos: images tagged with this entity via image_entities junction
    supabase
      .from('image_entities')
      .select('*, image:document_images(id, document_id, page_number, image_index, r2_key, thumbnail_r2_key, width, height, format, image_type, tags, caption, is_redacted, metadata, created_at, file_size_bytes)')
      .eq('entity_id', entityId),
  ])

  // Merge connections
  const connections = [
    ...(connectionsAsAResult.data ?? []),
    ...(connectionsAsBResult.data ?? []),
  ] as (EntityConnection & { connected_entity: Entity })[]

  // Sort events by date
  const events = ((eventsResult.data ?? []) as (EntityEvent & { event: Event })[]).sort(
    (a, b) => {
      const dateA = a.event?.date ?? ''
      const dateB = b.event?.date ?? ''
      return dateA.localeCompare(dateB)
    }
  )

  const documents = (documentsResult.data ?? []) as (EntityDocument & { document: Document })[]
  const evidence = (evidenceResult.data ?? []) as EvidenceItem[]

  // Filter to published stories/case files
  const stories = ((storiesResult.data ?? []) as (StoryEntity & { story: Story })[]).filter(
    (se) => se.story?.is_published === true
  )
  const caseFiles = ((caseFilesResult.data ?? []) as (CaseFileEntity & { case_file: CaseFile })[]).filter(
    (cfe) => cfe.case_file?.is_published === true
  )

  // Extract photos from image_entities join
  const photos = (photosResult.data ?? [])
    .map((ie: Record<string, unknown>) => ie.image)
    .filter(Boolean) as DocumentImage[]

  const typedEntity = entity as Entity
  const hasFinancialData =
    typedEntity.financial_summary &&
    Object.keys(typedEntity.financial_summary).length > 0

  return (
    <>
    <PersonJsonLd
      name={typedEntity.name}
      description={typedEntity.bio ?? undefined}
      slug={slug}
    />
    <div className="mx-auto max-w-7xl px-6 py-12">
      {/* Breadcrumb + print */}
      <div className="mb-8 flex items-center justify-between">
        <nav className="font-mono text-xs text-text-muted">
          <a href="/" className="hover:text-text-secondary transition-colors">
            Home
          </a>
          <span className="mx-2">/</span>
          <a href="/entities" className="hover:text-text-secondary transition-colors">
            Entities
          </a>
          <span className="mx-2">/</span>
          <span className="text-text-secondary">{typedEntity.name}</span>
        </nav>
        <PrintButton />
      </div>

      {/* 2-column layout: main + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-10">
        {/* Main column */}
        <div className="space-y-10">
          <EntityHero
            entity={typedEntity}
            docCount={documents.length}
            connectionCount={connections.length}
            eventCount={events.length}
            evidenceCount={evidence.length}
          />

          {/* Financial summary (if present) */}
          {hasFinancialData && (
            <FinancialSummaryCard financialSummary={typedEntity.financial_summary} />
          )}

          {/* Tabbed sections */}
          <ProfileTabsWrapper
            evidence={evidence}
            connections={connections}
            documents={documents}
            events={events}
            stories={stories}
            caseFiles={caseFiles}
            photos={photos}
            videos={(typedEntity.video_links ?? []) as VideoLink[]}
          />

          {/* Comments */}
          <CommentSection
            contentType="entity"
            contentId={typedEntity.id}
            currentPath={`/entities/${slug}`}
          />
        </div>

        {/* Sidebar */}
        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <DossierCard entity={typedEntity} />
          <SourceAdSlot variant="sidebar" seed={`entity-${slug}`} />
          <CyclopsPromo variant="sidebar" />
        </aside>
      </div>
    </div>
    </>
  )
}
