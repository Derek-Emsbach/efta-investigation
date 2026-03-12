import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'
import type {
  Entity,
  EntityDocument,
  EntityEvent,
  EntityConnection,
  EvidenceItem,
  Document,
  Event,
  Story,
  StoryEntity,
  CaseFile,
  CaseFileEntity,
} from '@efta/shared'

// Use service role to bypass RLS (public endpoint reads only published entities)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rateLimited = checkRateLimit(request)
  if (rateLimited) return rateLimited

  try {
    const { slug } = await params

    // 1. Fetch entity by slug — must be profile_published
    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('*')
      .eq('slug', slug)
      .eq('profile_published', true)
      .single()

    if (entityError || !entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }

    const entityId = entity.id

    // 2. Fetch all relations in parallel
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
      // Documents linked to this entity
      supabase
        .from('entity_documents')
        .select('*, document:documents(id, bates_number, title, document_type, original_date, severity, page_count, summary)')
        .eq('entity_id', entityId),

      // Events linked to this entity
      supabase
        .from('entity_events')
        .select('*, event:events(id, date, date_end, title, description, event_type, significance)')
        .eq('entity_id', entityId),

      // Connections where this entity is entity_a
      supabase
        .from('entity_connections')
        .select('*, connected_entity:entities!entity_b(id, name, slug, tier, entity_type, category, profile_published)')
        .eq('entity_a', entityId),

      // Connections where this entity is entity_b
      supabase
        .from('entity_connections')
        .select('*, connected_entity:entities!entity_a(id, name, slug, tier, entity_type, category, profile_published)')
        .eq('entity_b', entityId),

      // Evidence items
      supabase
        .from('evidence_items')
        .select('*')
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false }),

      // Stories mentioning this entity (published only)
      supabase
        .from('story_entities')
        .select('*, story:stories(id, slug, title, deck, section, byline, published_at, is_published)')
        .eq('entity_id', entityId),

      // Case files involving this entity (published only)
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

    // Merge connections from both directions
    const connections = [
      ...(connectionsAsAResult.data ?? []),
      ...(connectionsAsBResult.data ?? []),
    ]

    // Sort events by date
    const events = (eventsResult.data ?? []).sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const eventA = a.event as Record<string, unknown> | null
      const eventB = b.event as Record<string, unknown> | null
      const dateA = (eventA?.date as string) ?? ''
      const dateB = (eventB?.date as string) ?? ''
      return dateA.localeCompare(dateB)
    })

    // Filter stories/case files to only published
    const stories = (storiesResult.data ?? []).filter((se: Record<string, unknown>) => {
      const story = se.story as Record<string, unknown> | null
      return story?.is_published === true
    })

    const caseFiles = (caseFilesResult.data ?? []).filter((cfe: Record<string, unknown>) => {
      const cf = cfe.case_file as Record<string, unknown> | null
      return cf?.is_published === true
    })

    // Extract photos from image_entities join
    const photos = (photosResult.data ?? [])
      .map((ie: Record<string, unknown>) => ie.image)
      .filter(Boolean)

    return NextResponse.json({
      entity: entity as Entity,
      documents: documentsResult.data ?? [],
      events,
      connections,
      evidence: evidenceResult.data ?? [],
      stories,
      caseFiles,
      photos,
    }, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
