import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(request: NextRequest) {
  const rateLimited = checkRateLimit(request)
  if (rateLimited) return rateLimited

  try {
    const [entitiesResult, connectionsResult] = await Promise.all([
      supabase
        .from('entities')
        .select('id, name, slug, entity_type, tier, category, status')
        .eq('profile_published', true),
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

    // Build set of published entity IDs
    const publishedIds = new Set(entitiesResult.data.map((e) => e.id))

    // Only include connections where both endpoints are published
    const edges = connectionsResult.data.filter(
      (c) => publishedIds.has(c.entity_a) && publishedIds.has(c.entity_b),
    )

    // Only include entities that appear in at least one valid connection
    const connectedIds = new Set<string>()
    for (const edge of edges) {
      connectedIds.add(edge.entity_a)
      connectedIds.add(edge.entity_b)
    }

    const nodes = entitiesResult.data.filter((e) => connectedIds.has(e.id))

    return NextResponse.json({ nodes, edges })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
