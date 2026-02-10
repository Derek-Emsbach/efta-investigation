import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Entity, Document, Event } from '@efta/shared'

const MAX_RESULTS_PER_TYPE = 20

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const query = request.nextUrl.searchParams.get('q')?.trim()

    if (!query) {
      return NextResponse.json({ entities: [], documents: [], events: [] })
    }

    // Search all three tables in parallel
    const [entitiesResult, documentsResult, eventsResult] = await Promise.all([
      // Entities: full-text search on search_vector (name, bio, aliases, category)
      supabase
        .from('entities')
        .select('id, name, entity_type, tier, category, status')
        .textSearch('search_vector', query)
        .limit(MAX_RESULTS_PER_TYPE),

      // Documents: full-text search on search_vector (bates, title, summary, text)
      supabase
        .from('documents')
        .select('id, bates_number, title, document_type, severity, original_date, summary')
        .textSearch('search_vector', query)
        .limit(MAX_RESULTS_PER_TYPE),

      // Events: no FTS column, use ilike on title + description
      supabase
        .from('events')
        .select('id, date, title, description, event_type, significance')
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .order('date', { ascending: true, nullsFirst: false })
        .limit(MAX_RESULTS_PER_TYPE),
    ])

    return NextResponse.json({
      entities: (entitiesResult.data ?? []) as Partial<Entity>[],
      documents: (documentsResult.data ?? []) as Partial<Document>[],
      events: (eventsResult.data ?? []) as Partial<Event>[],
      query,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
