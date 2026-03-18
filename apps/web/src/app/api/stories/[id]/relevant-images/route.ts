import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

/**
 * GET: Find corpus images relevant to a story's entities.
 * Two data paths:
 *   1. Direct: story_entities → image_entities → document_images
 *   2. Indirect: story_entities → entity_documents → document_images
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireAdmin()
  if (result instanceof NextResponse) return result
  const { supabase } = result
  const { id } = await params

  try {
    const { searchParams } = request.nextUrl
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '40', 10) || 40))
    const imageTypeFilter = searchParams.get('image_type') || null
    const entityFilter = searchParams.get('entity_id') || null

    // Step 1: Get story entity IDs
    let entityQuery = supabase
      .from('story_entities')
      .select('entity_id')
      .eq('story_id', id)

    if (entityFilter) {
      entityQuery = entityQuery.eq('entity_id', entityFilter)
    }

    const { data: storyEntities } = await entityQuery
    const entityIds = (storyEntities ?? []).map((se) => se.entity_id)

    if (entityIds.length === 0) {
      return NextResponse.json({ images: [], count: 0, page, limit })
    }

    // Step 2: Find images via both paths in parallel
    const [directResult, indirectResult, alreadyAssigned] = await Promise.all([
      // Direct: image_entities for these entities
      supabase
        .from('image_entities')
        .select('image_id, entity_id')
        .in('entity_id', entityIds),
      // Indirect: entity_documents → document_images
      supabase
        .from('entity_documents')
        .select('document_id')
        .in('entity_id', entityIds),
      // Already assigned to this story (to exclude)
      supabase
        .from('story_images')
        .select('image_id')
        .eq('story_id', id),
    ])

    const directImageIds = new Set((directResult.data ?? []).map((r) => r.image_id))
    const docIds = [...new Set((indirectResult.data ?? []).map((r) => r.document_id))]
    const excludeImageIds = new Set((alreadyAssigned.data ?? []).map((r) => r.image_id))

    // Step 3: Build the image query
    // Combine direct image IDs + images from entity documents
    let allImageIds = [...directImageIds]

    if (docIds.length > 0) {
      const { data: docImages } = await supabase
        .from('document_images')
        .select('id')
        .in('document_id', docIds)
        .in('image_type', ['photo', 'graphic', 'map', 'chart'])
        .not('r2_key', 'like', 'corpus:pending:%')
        .limit(500)

      for (const img of docImages ?? []) {
        allImageIds.push(img.id)
      }
    }

    // Deduplicate and exclude already-assigned
    const uniqueImageIds = [...new Set(allImageIds)].filter((imgId) => !excludeImageIds.has(imgId))

    if (uniqueImageIds.length === 0) {
      return NextResponse.json({ images: [], count: 0, page, limit })
    }

    // Step 4: Fetch actual image records with pagination
    let imageQuery = supabase
      .from('document_images')
      .select(
        'id, document_id, page_number, r2_key, thumbnail_r2_key, width, height, format, image_type, tags, caption, is_redacted, created_at',
        { count: 'exact' },
      )
      .in('id', uniqueImageIds.slice(0, 500)) // Safety cap
      .not('r2_key', 'like', 'corpus:pending:%')
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (imageTypeFilter) {
      imageQuery = imageQuery.eq('image_type', imageTypeFilter)
    }

    const { data: images, count, error } = await imageQuery

    if (error) throw new Error(error.message)

    // Step 5: Enrich with entity tag info and document Bates numbers
    const imageIds = (images ?? []).map((img) => img.id)
    const imageDocIds = [...new Set((images ?? []).map((img) => img.document_id))]

    const [entityTags, docDetails] = await Promise.all([
      imageIds.length > 0
        ? supabase
            .from('image_entities')
            .select('image_id, entity_id, entity:entity_id(name, slug, tier)')
            .in('image_id', imageIds)
        : { data: [] },
      imageDocIds.length > 0
        ? supabase
            .from('documents')
            .select('id, bates_number, title')
            .in('id', imageDocIds)
        : { data: [] },
    ])

    const entityTagMap: Record<string, Array<{ name: string; slug: string; tier: number }>> = {}
    for (const tag of entityTags.data ?? []) {
      if (!entityTagMap[tag.image_id]) entityTagMap[tag.image_id] = []
      const entity = tag.entity as unknown as { name: string; slug: string; tier: number } | null
      if (entity) entityTagMap[tag.image_id].push(entity)
    }

    const docMap: Record<string, { bates_number: string | null; title: string | null }> = {}
    for (const doc of docDetails.data ?? []) {
      docMap[doc.id] = { bates_number: doc.bates_number, title: doc.title }
    }

    const enriched = (images ?? []).map((img) => ({
      ...img,
      entity_tags: entityTagMap[img.id] ?? [],
      document: docMap[img.document_id] ?? null,
      is_direct_match: directImageIds.has(img.id),
    }))

    return NextResponse.json({
      images: enriched,
      count: count ?? 0,
      page,
      limit,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
