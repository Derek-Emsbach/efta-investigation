import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const DEFAULT_LIMIT = 50

// Simple in-memory cache (5-minute TTL)
let cache: { data: unknown; timestamp: number; key: string } | null = null
const CACHE_TTL = 5 * 60 * 1000

// Map public_events.category → unified event_type for color-coding
const CATEGORY_TO_EVENT_TYPE: Record<string, string> = {
  legislative: 'legislative',
  congressional_action: 'legislative',
  doj_release: 'institutional',
  doj_action: 'institutional',
  resignation: 'institutional',
  criminal_action: 'legal',
  court_action: 'legal',
  victim_advocacy: 'personal',
  media_break: 'media',
  community_resource: 'community',
  international: 'international',
  other: 'other',
}

// Reverse map: event_type filter → which categories to include from public_events
function eventTypeToCategories(eventType: string): string[] {
  return Object.entries(CATEGORY_TO_EVENT_TYPE)
    .filter(([, mapped]) => mapped === eventType)
    .map(([cat]) => cat)
}

// Unified response shape
interface UnifiedEvent {
  id: string
  title: string
  description: string | null
  date: string | null
  date_end: string | null
  event_type: string
  significance: string | null
  source: 'investigation' | 'public'
  source_urls?: string[]
  linked_entities: { name: string; slug: string | null; tier: number | null; role: string | null }[]
}

export async function GET(request: NextRequest) {
  const rateLimited = await checkRateLimit(request)
  if (rateLimited) return rateLimited

  try {
    const { searchParams } = request.nextUrl
    const eventType = searchParams.get('event_type')
    const search = searchParams.get('search')
    const entitySlug = searchParams.get('entity_slug')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const source = searchParams.get('source') // 'investigation' | 'public' | null (both)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))

    // Build a cache key from params
    const cacheKey = `${eventType}|${search}|${entitySlug}|${dateFrom}|${dateTo}|${source}|${page}|${limit}`

    if (cache && cache.key === cacheKey && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(cache.data, {
        headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600' },
      })
    }

    const allEvents: UnifiedEvent[] = []

    // ---------------------------------------------------------------
    // 1. Investigation events (from `events` table)
    // ---------------------------------------------------------------
    if (source !== 'public') {
      // If filtering by entity slug, resolve to entity ID first
      let constrainedEventIds: string[] | null = null

      if (entitySlug) {
        const { data: entity } = await supabase
          .from('entities')
          .select('id')
          .eq('slug', entitySlug)
          .eq('profile_published', true)
          .single()

        if (entity) {
          const { data: entityEvents } = await supabase
            .from('entity_events')
            .select('event_id')
            .eq('entity_id', entity.id)
          constrainedEventIds = (entityEvents ?? []).map((ee) => ee.event_id)
        } else {
          constrainedEventIds = []
        }
      }

      // Skip investigation events if entity filter produced no matches
      const skipInvestigation = constrainedEventIds !== null && constrainedEventIds.length === 0

      if (!skipInvestigation) {
        let query = supabase.from('events').select('*')

        if (constrainedEventIds !== null) {
          query = query.in('id', constrainedEventIds)
        }

        if (eventType) {
          query = query.eq('event_type', eventType)
        }

        if (search) {
          query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
        }

        if (dateFrom) {
          query = query.gte('date', dateFrom)
        }

        if (dateTo) {
          query = query.lte('date', dateTo)
        }

        const { data: events, error } = await query

        if (error) {
          throw new Error(`Failed to fetch events: ${error.message}`)
        }

        // Fetch linked PUBLISHED entities for investigation events
        const eventIds = (events ?? []).map((e) => e.id)
        const entitiesByEvent: Record<string, { name: string; slug: string | null; tier: number | null; role: string | null }[]> = {}

        if (eventIds.length > 0) {
          const { data: entityEvents } = await supabase
            .from('entity_events')
            .select('event_id, role, entity:entities(name, slug, tier, profile_published)')
            .in('event_id', eventIds)

          if (entityEvents) {
            for (const ee of entityEvents as unknown as Array<{
              event_id: string
              role: string | null
              entity: { name: string; slug: string | null; tier: number | null; profile_published: boolean } | null
            }>) {
              if (!ee.entity?.profile_published) continue
              if (!entitiesByEvent[ee.event_id]) entitiesByEvent[ee.event_id] = []
              entitiesByEvent[ee.event_id].push({
                name: ee.entity.name,
                slug: ee.entity.slug,
                tier: ee.entity.tier,
                role: ee.role,
              })
            }
          }
        }

        // Normalize into unified shape
        for (const event of events ?? []) {
          allEvents.push({
            id: event.id,
            title: event.title,
            description: event.description,
            date: event.date,
            date_end: event.date_end,
            event_type: event.event_type ?? 'other',
            significance: event.significance,
            source: 'investigation',
            linked_entities: entitiesByEvent[event.id] ?? [],
          })
        }
      }
    }

    // ---------------------------------------------------------------
    // 2. Public events (from `public_events` table)
    // ---------------------------------------------------------------
    if (source !== 'investigation') {
      let pubQuery = supabase.from('public_events').select('*')

      // Filter by event_type → map to matching categories
      if (eventType) {
        const matchingCategories = eventTypeToCategories(eventType)
        if (matchingCategories.length === 0) {
          // This event_type has no matching public_events categories — skip
        } else {
          pubQuery = pubQuery.in('category', matchingCategories)
        }
      }

      if (search) {
        pubQuery = pubQuery.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
      }

      if (dateFrom) {
        pubQuery = pubQuery.gte('date', dateFrom)
      }

      if (dateTo) {
        pubQuery = pubQuery.lte('date', dateTo)
      }

      // If entity_slug filter, match by entity name from published entities
      if (entitySlug) {
        const { data: entity } = await supabase
          .from('entities')
          .select('name')
          .eq('slug', entitySlug)
          .eq('profile_published', true)
          .single()

        if (entity) {
          pubQuery = pubQuery.contains('entity_names', [entity.name])
        } else {
          // Entity not found — skip public events for this filter
          pubQuery = pubQuery.eq('id', '00000000-0000-0000-0000-000000000000')
        }
      }

      const shouldSkipEventType = eventType && eventTypeToCategories(eventType).length === 0
      if (!shouldSkipEventType) {
        const { data: pubEvents, error: pubError } = await pubQuery

        if (pubError) {
          throw new Error(`Failed to fetch public events: ${pubError.message}`)
        }

        // Build entity name → published entity lookup (one query)
        const allEntityNames = new Set<string>()
        for (const pe of pubEvents ?? []) {
          for (const name of pe.entity_names ?? []) {
            allEntityNames.add(name)
          }
        }

        const entityLookup: Record<string, { slug: string | null; tier: number | null }> = {}
        if (allEntityNames.size > 0) {
          const { data: publishedEntities } = await supabase
            .from('entities')
            .select('name, slug, tier')
            .eq('profile_published', true)
            .in('name', Array.from(allEntityNames))

          for (const ent of publishedEntities ?? []) {
            entityLookup[ent.name] = { slug: ent.slug, tier: ent.tier }
          }
        }

        // Normalize into unified shape
        for (const pe of pubEvents ?? []) {
          const linkedEntities = (pe.entity_names ?? []).map((name: string) => {
            const resolved = entityLookup[name]
            return {
              name,
              slug: resolved?.slug ?? null,
              tier: resolved?.tier ?? null,
              role: null,
            }
          })

          allEvents.push({
            id: pe.id,
            title: pe.title,
            description: pe.description,
            date: pe.date,
            date_end: pe.date_end ?? null,
            event_type: CATEGORY_TO_EVENT_TYPE[pe.category] ?? 'other',
            significance: pe.impact_level ?? null,
            source: 'public',
            source_urls: pe.source_urls ?? undefined,
            linked_entities: linkedEntities,
          })
        }
      }
    }

    // ---------------------------------------------------------------
    // 3. Sort by date ascending, then paginate in memory
    // ---------------------------------------------------------------
    allEvents.sort((a, b) => {
      if (!a.date && !b.date) return 0
      if (!a.date) return 1
      if (!b.date) return -1
      return a.date.localeCompare(b.date)
    })

    const totalCount = allEvents.length
    const rangeStart = (page - 1) * limit
    const paginatedEvents = allEvents.slice(rangeStart, rangeStart + limit)

    const result = {
      data: paginatedEvents,
      count: totalCount,
      page,
      limit,
    }

    // Update cache
    cache = { data: result, timestamp: Date.now(), key: cacheKey }

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
