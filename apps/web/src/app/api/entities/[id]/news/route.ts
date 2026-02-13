import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ id: string }> }

const CACHE_DAYS = 7
const MAX_ARTICLES = 10

interface RSSItem {
  title: string
  link: string
  pubDate: string
  source: string
  sourceUrl: string
}

/**
 * Parse Google News RSS feed into structured items.
 * Uses simple regex parsing since the RSS format is stable and predictable.
 */
function parseRSS(xml: string): RSSItem[] {
  const items: RSSItem[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]

    const title = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
      ?? block.match(/<title>(.*?)<\/title>/)?.[1]
      ?? ''
    const link = block.match(/<link>(.*?)<\/link>/)?.[1] ?? ''
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? ''
    const source = block.match(/<source[^>]*>(.*?)<\/source>/)?.[1] ?? ''
    const sourceUrl = block.match(/<source\s+url="(.*?)"/)?.[1] ?? ''

    if (title && link) {
      // Google News titles often end with " - Source Name" — strip it
      const cleanTitle = source && title.endsWith(` - ${source}`)
        ? title.slice(0, -(source.length + 3))
        : title

      items.push({
        title: cleanTitle,
        link,
        pubDate,
        source,
        sourceUrl,
      })
    }
  }

  return items.slice(0, MAX_ARTICLES)
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check for recent cached news articles
    const { data: cached } = await supabase
      .from('external_sources')
      .select('id, retrieved_at')
      .eq('entity_id', id)
      .eq('source_type', 'news_article')
      .order('retrieved_at', { ascending: false })
      .limit(1)

    if (cached && cached.length > 0) {
      const age = Date.now() - new Date(cached[0].retrieved_at).getTime()
      const maxAge = CACHE_DAYS * 24 * 60 * 60 * 1000
      if (age < maxAge) {
        return NextResponse.json({ cached: true, message: 'News articles are fresh' })
      }
    }

    // Fetch entity name + aliases
    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('name, aliases, category, is_public')
      .eq('id', id)
      .single()

    if (entityError || !entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }

    // Skip news for protected victims
    if (entity.category === 'victim' && !entity.is_public) {
      return NextResponse.json({ skipped: true, reason: 'victim_privacy' })
    }

    // Search Google News RSS
    const query = encodeURIComponent(`"${entity.name}" Epstein`)
    const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`

    const rssRes = await fetch(rssUrl, {
      headers: { 'User-Agent': 'EFTA-Investigation-Platform/1.0' },
      next: { revalidate: 3600 },
    })

    if (!rssRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch news feed' }, { status: 502 })
    }

    const xml = await rssRes.text()
    const articles = parseRSS(xml)

    if (articles.length === 0) {
      return NextResponse.json({ count: 0, message: 'No news articles found' })
    }

    // Delete old news for this entity before inserting fresh batch
    await supabase
      .from('external_sources')
      .delete()
      .eq('entity_id', id)
      .eq('source_type', 'news_article')

    // Insert new articles
    const now = new Date().toISOString()
    const rows = articles.map((article) => ({
      entity_id: id,
      source_type: 'news_article' as const,
      source_url: article.link,
      source_name: article.source || null,
      title: article.title,
      content: null,
      summary: null,
      published_date: article.pubDate ? new Date(article.pubDate).toISOString().split('T')[0] : null,
      thumbnail_url: null,
      retrieved_at: now,
      verification_status: 'unverified' as const,
      metadata: {
        source_url: article.sourceUrl,
        fetched_via: 'google_news_rss',
      },
    }))

    const { error: insertError } = await supabase
      .from('external_sources')
      .insert(rows)

    if (insertError) {
      throw new Error(`Failed to insert articles: ${insertError.message}`)
    }

    return NextResponse.json({
      count: articles.length,
      cached: false,
      articles: articles.map((a) => ({ title: a.title, source: a.source })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
