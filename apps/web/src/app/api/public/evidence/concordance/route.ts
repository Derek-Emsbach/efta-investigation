import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { corpusApiFetch, isCorpusApiConfigured } from '@/lib/corpus-api'

// In-memory cache
const cache = new Map<string, { data: unknown; expiry: number }>()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes — concordance data is static

function evictExpired() {
  const now = Date.now()
  for (const [key, val] of cache) {
    if (val.expiry < now) cache.delete(key)
  }
}

/**
 * GET /api/public/evidence/concordance
 *
 * Modes:
 *   ?efta_number=EFTA02731623        — lookup single document metadata
 *   ?q=Epstein&field=custodian        — search by field (custodian, author, original_filename, original_folder_path)
 *   ?q=Epstein&field=email_from       — search email metadata (email_from, email_to, email_cc, email_subject)
 */
export async function GET(request: NextRequest) {
  const rateLimited = await checkRateLimit(request, 'search')
  if (rateLimited) return rateLimited

  if (!isCorpusApiConfigured()) {
    return NextResponse.json(
      { error: 'Concordance search unavailable. Configure CORPUS_API_URL.' },
      { status: 503 },
    )
  }

  const { searchParams } = new URL(request.url)
  const eftaNumber = searchParams.get('efta_number')
  const q = searchParams.get('q')?.trim()
  const field = searchParams.get('field')
  const limit = searchParams.get('limit') ?? '25'

  // Check cache
  evictExpired()
  const cacheKey = JSON.stringify({ eftaNumber, q, field, limit })
  const cached = cache.get(cacheKey)
  if (cached) {
    return NextResponse.json(cached.data, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  }

  try {
    let data: unknown

    if (eftaNumber) {
      // Lookup mode
      data = await corpusApiFetch('/api/concordance/lookup', {
        efta_number: eftaNumber,
      })
    } else if (q && field) {
      // Search mode — route to emails or search based on field
      const emailFields = new Set(['email_from', 'email_to', 'email_cc', 'email_subject'])
      if (emailFields.has(field)) {
        data = await corpusApiFetch('/api/concordance/emails', { q, field, limit })
      } else {
        data = await corpusApiFetch('/api/concordance/search', { q, field, limit })
      }
    } else {
      return NextResponse.json(
        { error: 'Provide efta_number for lookup, or q + field for search' },
        { status: 400 },
      )
    }

    cache.set(cacheKey, { data, expiry: Date.now() + CACHE_TTL })

    return NextResponse.json(data, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
