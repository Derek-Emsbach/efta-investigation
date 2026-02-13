import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface WikiSummary {
  title: string
  extract: string
  description?: string
  thumbnail?: { source: string; width: number; height: number }
  content_urls?: { desktop?: { page?: string } }
}

const CACHE_DAYS = 7

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check for cached Wikipedia source
  const { data: cached } = await supabase
    .from('external_sources')
    .select('*')
    .eq('entity_id', id)
    .eq('source_type', 'wikipedia')
    .order('retrieved_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (cached) {
    const retrievedAt = new Date(cached.retrieved_at)
    const age = Date.now() - retrievedAt.getTime()
    const maxAge = CACHE_DAYS * 24 * 60 * 60 * 1000

    if (age < maxAge) {
      return NextResponse.json({
        source: cached,
        fromCache: true,
      })
    }
  }

  // Fetch entity to get name + aliases
  const { data: entity, error: entityError } = await supabase
    .from('entities')
    .select('name, aliases')
    .eq('id', id)
    .single()

  if (entityError || !entity) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
  }

  // Try fetching Wikipedia — entity name first, then each alias
  const namesToTry = [entity.name, ...(entity.aliases ?? [])]
  let wikiData: WikiSummary | null = null
  let matchedName: string | null = null

  for (const name of namesToTry) {
    const encoded = encodeURIComponent(name.replace(/\s+/g, '_'))
    try {
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
        {
          headers: { 'User-Agent': 'EFTA-Investigation-Platform/1.0' },
          next: { revalidate: 3600 },
        },
      )

      if (res.ok) {
        const data = await res.json()
        // Skip disambiguation pages
        if (data.type === 'standard' && data.extract) {
          wikiData = data as WikiSummary
          matchedName = name
          break
        }
      }
    } catch {
      // Try next name
    }
  }

  if (!wikiData) {
    return NextResponse.json({ source: null, notFound: true })
  }

  // Upsert into external_sources cache
  const sourceData = {
    entity_id: id,
    source_type: 'wikipedia' as const,
    source_url: wikiData.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(matchedName!.replace(/\s+/g, '_'))}`,
    source_name: 'Wikipedia',
    title: wikiData.title,
    content: null,
    summary: wikiData.extract,
    thumbnail_url: wikiData.thumbnail?.source ?? null,
    published_date: null,
    retrieved_at: new Date().toISOString(),
    verification_status: 'unverified' as const,
    metadata: {
      matched_name: matchedName,
      description: wikiData.description,
    },
  }

  if (cached) {
    // Update existing record
    await supabase
      .from('external_sources')
      .update(sourceData)
      .eq('id', cached.id)

    return NextResponse.json({
      source: { ...cached, ...sourceData },
      fromCache: false,
    })
  }

  // Insert new record
  const { data: inserted } = await supabase
    .from('external_sources')
    .insert(sourceData)
    .select()
    .single()

  return NextResponse.json({
    source: inserted ?? sourceData,
    fromCache: false,
  })
}
