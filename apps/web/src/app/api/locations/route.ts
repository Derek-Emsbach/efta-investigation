import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Location } from '@efta/shared'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 25
const DEFAULT_SORT = 'name'
const DEFAULT_ORDER = 'asc'

const ALLOWED_SORT_COLUMNS = new Set([
  'name',
  'location_type',
  'city',
  'state',
  'country',
  'created_at',
])

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = request.nextUrl

    const locationType = searchParams.get('location_type')
    const country = searchParams.get('country')
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? String(DEFAULT_PAGE), 10) || DEFAULT_PAGE)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))
    const sort = ALLOWED_SORT_COLUMNS.has(searchParams.get('sort') ?? '') ? searchParams.get('sort')! : DEFAULT_SORT
    const order = searchParams.get('order') === 'desc' ? 'desc' : DEFAULT_ORDER

    let query = supabase.from('locations').select('*, owner:entities!owner_entity_id(id, name)', { count: 'exact' })

    if (locationType) {
      query = query.eq('location_type', locationType)
    }

    if (country) {
      query = query.eq('country', country)
    }

    if (search) {
      // Search in name, address, and aliases
      query = query.or(`name.ilike.%${search}%,address.ilike.%${search}%,city.ilike.%${search}%`)
    }

    query = query.order(sort, { ascending: order === 'asc' })

    const rangeStart = (page - 1) * limit
    const rangeEnd = page * limit - 1
    query = query.range(rangeStart, rangeEnd)

    const { data, error, count } = await query

    if (error) {
      throw new Error(`Failed to fetch locations: ${error.message}`)
    }

    // Fetch sighting counts for these locations
    const locationIds = (data ?? []).map((l: Location & { owner: { id: string; name: string } | null }) => l.id)
    let sightingCounts: Record<string, number> = {}
    let entityCounts: Record<string, number> = {}

    if (locationIds.length > 0) {
      const { data: sightings } = await supabase
        .from('entity_sightings')
        .select('location_id, entity_id')
        .in('location_id', locationIds)

      if (sightings) {
        const byLocation = new Map<string, Set<string>>()
        const countByLocation = new Map<string, number>()

        for (const s of sightings) {
          const lid = s.location_id as string
          countByLocation.set(lid, (countByLocation.get(lid) ?? 0) + 1)
          if (!byLocation.has(lid)) byLocation.set(lid, new Set())
          byLocation.get(lid)!.add(s.entity_id as string)
        }

        sightingCounts = Object.fromEntries(countByLocation)
        entityCounts = Object.fromEntries(
          Array.from(byLocation.entries()).map(([lid, set]) => [lid, set.size])
        )
      }
    }

    const enriched = (data ?? []).map((loc: Location & { owner: { id: string; name: string } | null }) => ({
      ...loc,
      sighting_count: sightingCounts[loc.id] ?? 0,
      entity_count: entityCounts[loc.id] ?? 0,
    }))

    return NextResponse.json({
      data: enriched,
      count: count ?? 0,
      page,
      limit,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
