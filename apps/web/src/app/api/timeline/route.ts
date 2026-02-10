import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Event, EntityEvent, Entity } from '@efta/shared'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 50

interface EventEntityJoin extends EntityEvent {
  entity: Entity
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = request.nextUrl

    const eventType = searchParams.get('event_type')
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? String(DEFAULT_PAGE), 10) || DEFAULT_PAGE)
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))

    // Build events query
    let query = supabase.from('events').select('*', { count: 'exact' })

    if (eventType) {
      query = query.eq('event_type', eventType)
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    }

    // Sort by date ascending (chronological)
    query = query.order('date', { ascending: true, nullsFirst: false })

    const rangeStart = (page - 1) * limit
    const rangeEnd = page * limit - 1
    query = query.range(rangeStart, rangeEnd)

    const { data: events, error, count } = await query

    if (error) {
      throw new Error(`Failed to fetch events: ${error.message}`)
    }

    // Fetch linked entities for all events in one query
    const eventIds = (events ?? []).map((e) => e.id)
    let entitiesByEvent: Record<string, (EntityEvent & { entity: Entity })[]> = {}

    if (eventIds.length > 0) {
      const { data: entityEvents, error: eeError } = await supabase
        .from('entity_events')
        .select('*, entity:entities(*)')
        .in('event_id', eventIds)

      if (!eeError && entityEvents) {
        for (const ee of entityEvents as EventEntityJoin[]) {
          if (!entitiesByEvent[ee.event_id]) {
            entitiesByEvent[ee.event_id] = []
          }
          entitiesByEvent[ee.event_id].push(ee)
        }
      }
    }

    // Merge entities into events
    const eventsWithEntities = (events ?? []).map((event) => ({
      ...event,
      linked_entities: entitiesByEvent[event.id] ?? [],
    }))

    return NextResponse.json({
      data: eventsWithEntities,
      count: count ?? 0,
      page,
      limit,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
