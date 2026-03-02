import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Simple in-memory cache: key → { data, expiry }
const cache = new Map<string, { data: unknown; expiry: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCacheKey(params: Record<string, string | undefined>): string {
  return JSON.stringify(
    Object.entries(params)
      .filter(([, v]) => v != null)
      .sort(([a], [b]) => a.localeCompare(b))
  )
}

function evictExpired() {
  const now = Date.now()
  for (const [key, val] of cache) {
    if (val.expiry < now) cache.delete(key)
  }
}

export async function GET(request: NextRequest) {
  const rateLimited = checkRateLimit(request, 'search')
  if (rateLimited) return rateLimited

  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()
    const documentType = searchParams.get('type') || undefined
    const severity = searchParams.get('severity') || undefined
    const datasetId = searchParams.get('dataset') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    if (!q || q.length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters' },
        { status: 400 }
      )
    }

    // Check cache
    evictExpired()
    const cacheKey = getCacheKey({ q, documentType, severity, datasetId, limit: String(limit), offset: String(offset) })
    const cached = cache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached.data, {
        headers: {
          'X-Cache': 'HIT',
          'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=120',
        },
      })
    }

    // Build FTS query
    let query = supabase
      .from('documents')
      .select('id, bates_number, title, document_type, original_date, severity, page_count, summary, dataset_id, extracted_text')
      .textSearch('search_vector', q, { type: 'websearch' })

    if (documentType) {
      query = query.eq('document_type', documentType)
    }
    if (severity) {
      query = query.eq('severity', severity)
    }
    if (datasetId) {
      query = query.eq('dataset_id', datasetId)
    }

    query = query
      .order('severity', { ascending: true })
      .order('original_date', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    const { data: documents, error, count } = await query

    if (error) {
      throw new Error(`Search failed: ${error.message}`)
    }

    // Generate snippets with basic highlighting
    const results = (documents ?? []).map((doc) => {
      const excerpt = generateExcerpt(doc.extracted_text ?? doc.summary ?? '', q)
      return {
        id: doc.id,
        bates_number: doc.bates_number,
        title: doc.title,
        document_type: doc.document_type,
        original_date: doc.original_date,
        severity: doc.severity,
        page_count: doc.page_count,
        summary: doc.summary,
        dataset_id: doc.dataset_id,
        excerpt,
      }
    })

    const response = {
      results,
      query: q,
      total: results.length,
      offset,
      limit,
    }

    // Cache the response
    cache.set(cacheKey, { data: response, expiry: Date.now() + CACHE_TTL })

    return NextResponse.json(response, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=120',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function generateExcerpt(text: string, query: string): string {
  if (!text) return ''

  const lower = text.toLowerCase()
  const queryLower = query.toLowerCase()
  const words = queryLower.split(/\s+/)

  // Find first match position
  let bestPos = -1
  for (const word of words) {
    const pos = lower.indexOf(word)
    if (pos !== -1 && (bestPos === -1 || pos < bestPos)) {
      bestPos = pos
    }
  }

  // Extract window around match
  const windowSize = 200
  let start = bestPos === -1 ? 0 : Math.max(0, bestPos - 80)
  let end = start + windowSize

  // Snap to word boundaries
  if (start > 0) {
    const spaceIdx = text.indexOf(' ', start)
    if (spaceIdx !== -1 && spaceIdx < start + 20) start = spaceIdx + 1
  }
  if (end < text.length) {
    const spaceIdx = text.lastIndexOf(' ', end)
    if (spaceIdx > end - 20) end = spaceIdx
  }

  let excerpt = text.slice(start, end).trim()
  if (start > 0) excerpt = '...' + excerpt
  if (end < text.length) excerpt = excerpt + '...'

  return excerpt
}
