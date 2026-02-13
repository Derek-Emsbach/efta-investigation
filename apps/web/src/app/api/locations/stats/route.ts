import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Fetch all locations and sightings in parallel
    const [locationsResult, sightingsResult] = await Promise.all([
      supabase.from('locations').select('id, name, location_type, city, country'),
      supabase.from('entity_sightings').select('location_id, entity_id'),
    ])

    const locations = locationsResult.data ?? []
    const sightings = sightingsResult.data ?? []

    // Aggregate by location type
    const byType: Record<string, number> = {}
    for (const loc of locations) {
      const t = (loc.location_type as string) ?? 'other'
      byType[t] = (byType[t] ?? 0) + 1
    }

    // Sighting counts per location
    const sightingsByLocation = new Map<string, number>()
    const entitiesByLocation = new Map<string, Set<string>>()

    for (const s of sightings) {
      const lid = s.location_id as string
      if (!lid) continue
      sightingsByLocation.set(lid, (sightingsByLocation.get(lid) ?? 0) + 1)
      if (!entitiesByLocation.has(lid)) entitiesByLocation.set(lid, new Set())
      entitiesByLocation.get(lid)!.add(s.entity_id as string)
    }

    // Top locations by sighting count
    const topLocations = locations
      .map((loc) => ({
        id: loc.id,
        name: loc.name,
        location_type: loc.location_type,
        city: loc.city,
        country: loc.country,
        sighting_count: sightingsByLocation.get(loc.id as string) ?? 0,
        entity_count: entitiesByLocation.get(loc.id as string)?.size ?? 0,
      }))
      .sort((a, b) => b.sighting_count - a.sighting_count)
      .slice(0, 6)

    // Aggregate by country
    const byCountry: Record<string, number> = {}
    for (const loc of locations) {
      const c = (loc.country as string) ?? 'Unknown'
      byCountry[c] = (byCountry[c] ?? 0) + 1
    }

    return NextResponse.json({
      totalLocations: locations.length,
      totalSightings: sightings.length,
      byType,
      byCountry,
      topLocations,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
