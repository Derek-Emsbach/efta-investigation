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

export async function GET(request: NextRequest) {
  const rateLimited = checkRateLimit(request)
  if (rateLimited) return rateLimited

  try {
    const { searchParams } = request.nextUrl
    const eventType = searchParams.get('event_type')
    const search = searchParams.get('search')
    const entitySlug = searchParams.get('entity_slug')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))

    // Build a cache key from params
    const cacheKey = `${eventType}|${search}|${entitySlug}|${dateFrom}|${dateTo}|${page}|${limit}`

    if (cache && cache.key === cacheKey && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(cache.data, {
        headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600' },
      })
    }

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

    // Short-circuit if entity filter produced no matches
    if (constrainedEventIds !== null && constrainedEventIds.length === 0) {
      const emptyResult = { data: [], count: 0, page, limit }
      return NextResponse.json(emptyResult, {
        headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600' },
      })
    }

    // Build events query
    let query = supabase.from('events').select('*', { count: 'exact' })

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

    query = query.order('date', { ascending: true, nullsFirst: false })

    const rangeStart = (page - 1) * limit
    const rangeEnd = page * limit - 1
    query = query.range(rangeStart, rangeEnd)

    const { data: events, error, count } = await query

    if (error) {
      throw new Error(`Failed to fetch events: ${error.message}`)
    }

    // Fetch linked PUBLISHED entities for all events
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
          // Only include published entities in public API
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

    // Merge entities into events
    const eventsWithEntities = (events ?? []).map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      date: event.date,
      date_end: event.date_end,
      event_type: event.event_type,
      significance: event.significance,
      linked_entities: entitiesByEvent[event.id] ?? [],
    }))

    const result = {
      data: eventsWithEntities,
      count: count ?? 0,
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
