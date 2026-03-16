import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const VALID_SECTIONS = ['follow-the-money', 'the-cover-up', 'the-operation', 'voices'] as const
type Section = (typeof VALID_SECTIONS)[number]

// Which entity categories are relevant to each section
const SECTION_ENTITY_CATEGORIES: Record<Section, string[]> = {
  'follow-the-money': ['financial'],
  'the-cover-up': ['law_enforcement'],
  'the-operation': ['staff', 'operational', 'inner_circle', 'abuser'],
  'voices': ['witness'],
}

// Which entity types to include (in addition to category filter)
const SECTION_ENTITY_TYPES: Record<Section, string[]> = {
  'follow-the-money': ['organization', 'trust'],
  'the-cover-up': [],
  'the-operation': [],
  'voices': [],
}

// Cache
let cache: Record<string, { data: unknown; ts: number }> = {}
const CACHE_TTL = 5 * 60 * 1000

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ section: string }> },
) {
  const rateLimited = await checkRateLimit(request)
  if (rateLimited) return rateLimited

  const { section } = await params
  if (!VALID_SECTIONS.includes(section as Section)) {
    return NextResponse.json({ error: 'Invalid section' }, { status: 400 })
  }
  const sec = section as Section

  // Check cache
  const cached = cache[sec]
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600' },
    })
  }

  try {
    const categories = SECTION_ENTITY_CATEGORIES[sec]
    const entityTypes = SECTION_ENTITY_TYPES[sec]

    // Fetch stories for this section
    const storiesQuery = supabase
      .from('stories')
      .select('id, slug, title, deck, section, byline, reading_time_minutes, is_featured, published_at, hero_image_url')
      .eq('is_published', true)
      .eq('section', sec)
      .order('published_at', { ascending: false })

    // Fetch entities matching section categories/types
    let entitiesQuery = supabase
      .from('entities')
      .select('id, name, slug, entity_type, tier, category, status, bio, profile_image_url')
      .eq('profile_published', true)

    // Build OR filter for categories and entity types
    const orFilters: string[] = []
    if (categories.length > 0) orFilters.push(`category.in.(${categories.join(',')})`)
    if (entityTypes.length > 0) orFilters.push(`entity_type.in.(${entityTypes.join(',')})`)
    if (orFilters.length > 0) {
      entitiesQuery = entitiesQuery.or(orFilters.join(','))
    }
    entitiesQuery = entitiesQuery.order('tier', { ascending: true }).order('name').limit(20)

    // Fetch connections by type (for follow-the-money)
    const connectionsQuery = supabase
      .from('entity_connections')
      .select('relationship_type')

    // Fetch case files (for cover-up + voices)
    const caseFilesQuery = supabase
      .from('case_files')
      .select('id, slug, case_id, title, status, summary, completion_percentage, is_published')
      .eq('is_published', true)
      .order('completion_percentage', { ascending: false })

    // Fetch public events (for cover-up timeline)
    const publicEventsQuery = supabase
      .from('public_events')
      .select('id, date, date_end, title, description, category, impact_level, source_urls')
      .in('category', ['doj_release', 'doj_action', 'congressional_action', 'court_action', 'criminal_action'])
      .order('date', { ascending: true })

    // Fetch locations (for operation)
    const locationsQuery = supabase
      .from('locations')
      .select('id, name, location_type, city, state, country, latitude, longitude')
      .not('latitude', 'is', null)
      .not('name', 'ilike', '%test%')

    // Fetch events by type (for operation)
    const eventsQuery = supabase
      .from('events')
      .select('event_type')

    // Fetch open questions count grouped by case file
    const openQuestionsQuery = supabase
      .from('open_questions')
      .select('id, question, priority, status, case_file_id')
      .eq('status', 'open')

    const [
      storiesResult,
      entitiesResult,
      connectionsResult,
      caseFilesResult,
      publicEventsResult,
      locationsResult,
      eventsResult,
      openQuestionsResult,
    ] = await Promise.all([
      storiesQuery,
      entitiesQuery,
      connectionsQuery,
      caseFilesQuery,
      publicEventsQuery,
      locationsQuery,
      eventsQuery,
      openQuestionsQuery,
    ])

    // Build connection type counts
    const connectionsByType: Record<string, number> = {}
    for (const c of connectionsResult.data ?? []) {
      connectionsByType[c.relationship_type] = (connectionsByType[c.relationship_type] ?? 0) + 1
    }

    // Build event type counts
    const eventsByType: Record<string, number> = {}
    for (const e of eventsResult.data ?? []) {
      eventsByType[e.event_type] = (eventsByType[e.event_type] ?? 0) + 1
    }

    // Build open questions per case file
    const questionsByCaseFile: Record<string, number> = {}
    for (const q of openQuestionsResult.data ?? []) {
      if (q.case_file_id) {
        questionsByCaseFile[q.case_file_id] = (questionsByCaseFile[q.case_file_id] ?? 0) + 1
      }
    }

    // Attach open question counts to case files
    const caseFilesWithQuestions = (caseFilesResult.data ?? []).map((cf) => ({
      ...cf,
      open_question_count: questionsByCaseFile[cf.id] ?? 0,
    }))

    const result = {
      stories: storiesResult.data ?? [],
      entities: entitiesResult.data ?? [],
      stats: {
        storyCount: storiesResult.data?.length ?? 0,
        entityCount: entitiesResult.data?.length ?? 0,
        totalConnections: connectionsResult.data?.length ?? 0,
        totalEvents: eventsResult.data?.length ?? 0,
      },
      connectionsByType,
      eventsByType,
      caseFiles: caseFilesWithQuestions,
      publicEvents: publicEventsResult.data ?? [],
      locations: locationsResult.data ?? [],
    }

    cache[sec] = { data: result, ts: Date.now() }

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
