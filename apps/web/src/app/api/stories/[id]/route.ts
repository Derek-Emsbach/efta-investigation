import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

/** GET: Full story with entities, citations, and assigned images */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireAdmin()
  if (result instanceof NextResponse) return result
  const { supabase } = result
  const { id } = await params

  try {
    const [storyResult, entitiesResult, citationsResult, imagesResult] = await Promise.all([
      supabase.from('stories').select('*').eq('id', id).single(),
      supabase
        .from('story_entities')
        .select('*, entity:entity_id(id, name, slug, tier, category, entity_type, profile_image_url)')
        .eq('story_id', id)
        .order('mention_count', { ascending: false }),
      supabase
        .from('story_citations')
        .select('*, document:document_id(id, bates_number, title, document_type)')
        .eq('story_id', id)
        .order('citation_number', { ascending: true }),
      supabase
        .from('story_images')
        .select('*, image:image_id(id, r2_key, thumbnail_r2_key, caption, image_type, width, height, tags, document_id)')
        .eq('story_id', id)
        .order('sort_order', { ascending: true }),
    ])

    if (storyResult.error) {
      if (storyResult.error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Story not found' }, { status: 404 })
      }
      throw new Error(storyResult.error.message)
    }

    // Fetch case file if linked
    let caseFile = null
    if (storyResult.data.case_file_id) {
      const { data } = await supabase
        .from('case_files')
        .select('id, slug, case_id, title, status')
        .eq('id', storyResult.data.case_file_id)
        .single()
      caseFile = data
    }

    return NextResponse.json({
      story: storyResult.data,
      entities: entitiesResult.data ?? [],
      citations: citationsResult.data ?? [],
      images: imagesResult.data ?? [],
      caseFile,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** PATCH: Update story fields */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireAdmin()
  if (result instanceof NextResponse) return result
  const { supabase } = result
  const { id } = await params

  try {
    const body = await request.json()

    // Whitelist updateable fields
    const allowed = [
      'title', 'deck', 'section', 'body_markdown', 'byline',
      'reading_time_minutes', 'editorial_notes', 'editorial_status',
      'hero_image_url', 'hero_image_caption', 'is_featured',
      'case_file_id', 'metadata',
    ]

    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) {
        updates[key] = body[key]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // Auto-calculate reading time if body changed
    if (updates.body_markdown && typeof updates.body_markdown === 'string') {
      const wordCount = updates.body_markdown.split(/\s+/).length
      updates.reading_time_minutes = Math.round(wordCount / 200)
    }

    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('stories')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)

    return NextResponse.json({ story: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
