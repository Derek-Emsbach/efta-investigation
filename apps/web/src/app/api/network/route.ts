import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const [entitiesResult, connectionsResult] = await Promise.all([
      supabase
        .from('entities')
        .select('id, name, slug, entity_type, tier, category, status, evidence_summary, profile_image_url'),
      supabase
        .from('entity_connections')
        .select('id, entity_a, entity_b, relationship_type, evidence_strength, description'),
    ])

    if (entitiesResult.error) {
      throw new Error(`Failed to fetch entities: ${entitiesResult.error.message}`)
    }
    if (connectionsResult.error) {
      throw new Error(`Failed to fetch connections: ${connectionsResult.error.message}`)
    }

    // Only include entities that appear in at least one connection
    const connectedIds = new Set<string>()
    for (const conn of connectionsResult.data) {
      connectedIds.add(conn.entity_a)
      connectedIds.add(conn.entity_b)
    }

    const nodes = entitiesResult.data.filter((e) => connectedIds.has(e.id))

    return NextResponse.json({
      nodes,
      edges: connectionsResult.data,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
