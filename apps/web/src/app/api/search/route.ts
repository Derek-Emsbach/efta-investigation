import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Entity, Document, Event } from '@efta/shared'

const MAX_RESULTS_PER_TYPE = 20

/** Deduplicate rows by id, preserving order (first occurrence wins) */
function dedup<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>()
  return rows.filter((row) => {
    if (seen.has(row.id)) return false
    seen.add(row.id)
    return true
  })
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const query = request.nextUrl.searchParams.get('q')?.trim()

    if (!query) {
      return NextResponse.json({ entities: [], documents: [], events: [] })
    }

    const docSelect = 'id, bates_number, title, document_type, severity, original_date, summary'
    const entitySelect = 'id, name, entity_type, tier, category, status'

    // Run FTS + ilike queries in parallel, then merge results.
    // FTS handles stemmed/semantic matches ("prosecution" → "prosecutorial"),
    // ilike handles substrings ("efta00" → "EFTA02730265").
    const [
      entitiesFtsResult,
      entitiesIlikeResult,
      docsFtsResult,
      docsIlikeResult,
      eventsResult,
    ] = await Promise.all([
      // Entities: FTS
      supabase
        .from('entities')
        .select(entitySelect)
        .textSearch('search_vector', query)
        .limit(MAX_RESULTS_PER_TYPE),

      // Entities: substring match on name + aliases
      supabase
        .from('entities')
        .select(entitySelect)
        .or(`name.ilike.%${query}%`)
        .limit(MAX_RESULTS_PER_TYPE),

      // Documents: FTS
      supabase
        .from('documents')
        .select(docSelect)
        .textSearch('search_vector', query)
        .limit(MAX_RESULTS_PER_TYPE),

      // Documents: substring match on bates_number + title
      supabase
        .from('documents')
        .select(docSelect)
        .or(`bates_number.ilike.%${query}%,title.ilike.%${query}%`)
        .limit(MAX_RESULTS_PER_TYPE),

      // Events: ilike (no FTS column)
      supabase
        .from('events')
        .select('id, date, title, description, event_type, significance')
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .order('date', { ascending: true, nullsFirst: false })
        .limit(MAX_RESULTS_PER_TYPE),
    ])

    // Merge and deduplicate (FTS results first, then ilike additions)
    const entities = dedup([
      ...(entitiesFtsResult.data ?? []),
      ...(entitiesIlikeResult.data ?? []),
    ]).slice(0, MAX_RESULTS_PER_TYPE)

    const documents = dedup([
      ...(docsFtsResult.data ?? []),
      ...(docsIlikeResult.data ?? []),
    ]).slice(0, MAX_RESULTS_PER_TYPE)

    return NextResponse.json({
      entities: entities as Partial<Entity>[],
      documents: documents as Partial<Document>[],
      events: (eventsResult.data ?? []) as Partial<Event>[],
      query,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
