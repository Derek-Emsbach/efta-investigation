import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

/** GET: List all stories with optional status filter */
export async function GET(request: NextRequest) {
  const result = await requireAdmin()
  if (result instanceof NextResponse) return result
  const { supabase } = result

  try {
    const { searchParams } = request.nextUrl
    const status = searchParams.get('status') || undefined

    let query = supabase
      .from('stories')
      .select(`
        id, slug, title, deck, section, byline, reading_time_minutes,
        is_published, is_featured, published_at, updated_at, created_at,
        hero_image_url, hero_image_caption, editorial_status, editorial_notes,
        case_file_id, body_markdown
      `)
      .order('updated_at', { ascending: false })

    if (status) {
      query = query.eq('editorial_status', status)
    }

    const { data: stories, error } = await query

    if (error) throw new Error(`Failed to fetch stories: ${error.message}`)

    // Fetch entity and citation counts for each story
    const storyIds = (stories ?? []).map((s) => s.id)

    const [entityResult, citationResult] = await Promise.all([
      supabase
        .from('story_entities')
        .select('story_id, entity_id')
        .in('story_id', storyIds.length > 0 ? storyIds : ['__none__']),
      supabase
        .from('story_citations')
        .select('story_id, citation_number')
        .in('story_id', storyIds.length > 0 ? storyIds : ['__none__']),
    ])

    const entityCounts: Record<string, number> = {}
    for (const row of entityResult.data ?? []) {
      entityCounts[row.story_id] = (entityCounts[row.story_id] ?? 0) + 1
    }

    const citationCounts: Record<string, number> = {}
    for (const row of citationResult.data ?? []) {
      citationCounts[row.story_id] = (citationCounts[row.story_id] ?? 0) + 1
    }

    const enriched = (stories ?? []).map((s) => ({
      ...s,
      entity_count: entityCounts[s.id] ?? 0,
      citation_count: citationCounts[s.id] ?? 0,
      word_count: s.body_markdown ? s.body_markdown.split(/\s+/).length : 0,
    }))

    return NextResponse.json({ stories: enriched })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
