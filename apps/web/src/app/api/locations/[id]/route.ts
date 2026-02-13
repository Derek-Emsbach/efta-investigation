import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Fetch location, sightings with entities, and owner in parallel
    const [locationResult, sightingsResult] = await Promise.all([
      supabase
        .from('locations')
        .select('*, owner:entities!owner_entity_id(id, name, tier, category)')
        .eq('id', id)
        .single(),
      supabase
        .from('entity_sightings')
        .select('*, entity:entities!entity_id(id, name, tier, category), document:documents!document_id(id, bates_number, title), location:locations!location_id(id, name)')
        .eq('location_id', id)
        .order('date', { ascending: false }),
    ])

    if (locationResult.error || !locationResult.data) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    const sightings = sightingsResult.data ?? []

    // Compute unique entities seen here
    const entityMap = new Map<string, { id: string; name: string; tier: number | null; category: string | null; visit_count: number; last_seen: string }>()
    for (const s of sightings) {
      const entity = s.entity as { id: string; name: string; tier: number | null; category: string | null } | null
      if (!entity) continue
      const existing = entityMap.get(entity.id)
      if (existing) {
        existing.visit_count++
        if (s.date > existing.last_seen) existing.last_seen = s.date as string
      } else {
        entityMap.set(entity.id, {
          ...entity,
          visit_count: 1,
          last_seen: s.date as string,
        })
      }
    }

    // Compute date range
    const dates = sightings.map((s) => s.date as string).sort()
    const firstActivity = dates[0] ?? null
    const lastActivity = dates[dates.length - 1] ?? null

    // Compute co-presence events (same date, multiple entities)
    const byDate = new Map<string, typeof sightings>()
    for (const s of sightings) {
      const d = s.date as string
      if (!byDate.has(d)) byDate.set(d, [])
      byDate.get(d)!.push(s)
    }
    const coPresenceCount = Array.from(byDate.values()).filter((group) => {
      const uniqueEntities = new Set(group.map((s) => (s.entity as { id: string } | null)?.id).filter(Boolean))
      return uniqueEntities.size > 1
    }).length

    return NextResponse.json({
      location: locationResult.data,
      sightings,
      entities: Array.from(entityMap.values()).sort((a, b) => b.visit_count - a.visit_count),
      stats: {
        totalSightings: sightings.length,
        uniqueEntities: entityMap.size,
        firstActivity,
        lastActivity,
        coPresenceEvents: coPresenceCount,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
