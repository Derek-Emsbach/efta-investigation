import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'
import { getCorpusDb, datasetFromEftaNumber, numericEfta } from '@/lib/corpus-db'
import type { CorpusSearchHit, CorpusEnrichment, CorpusSearchResponse } from '@efta/shared'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// MCP server URL for remote corpus queries (Railway deployment)
const CORPUS_API_URL = process.env.CORPUS_API_URL // e.g. https://efta-mcp.up.railway.app
const CORPUS_API_KEY = process.env.CORPUS_API_KEY

// In-memory cache
const cache = new Map<string, { data: CorpusSearchResponse; expiry: number }>()
const CACHE_TTL = 5 * 60 * 1000

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

interface CorpusRow {
  efta_number: string
  page_number: number
  snippet: string
}

export async function GET(request: NextRequest) {
  const rateLimited = await checkRateLimit(request, 'search')
  if (rateLimited) return rateLimited

  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()
    const datasetParam = searchParams.get('dataset') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    if (!q || q.length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters' },
        { status: 400 }
      )
    }

    const dataset = datasetParam ? parseInt(datasetParam, 10) : undefined
    if (dataset !== undefined && (dataset < 1 || dataset > 12)) {
      return NextResponse.json(
        { error: 'Dataset must be between 1 and 12' },
        { status: 400 }
      )
    }

    // Check cache
    evictExpired()
    const cacheKey = getCacheKey({
      q,
      dataset: dataset?.toString(),
      limit: String(limit),
      offset: String(offset),
    })
    const cached = cache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached.data, {
        headers: {
          'X-Cache': 'HIT',
          'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=120',
        },
      })
    }

    // Try local SQLite first, then fall back to remote MCP server
    let results: CorpusSearchHit[]

    const db = getCorpusDb()
    if (db) {
      results = searchLocal(db, q, dataset, limit, offset)
    } else if (CORPUS_API_URL) {
      results = await searchRemote(q, dataset, limit, offset)
    } else {
      return NextResponse.json(
        { error: 'Corpus search unavailable. Configure CORPUS_API_URL for remote search.' },
        { status: 503 }
      )
    }

    // Enrich from Supabase
    const enrichment = await enrichResults(results)

    const response: CorpusSearchResponse = {
      results,
      enrichment,
      query: q,
      total: results.length,
      offset,
      limit,
    }

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

// ── Local SQLite search ──────────────────────────────────────────────────

function searchLocal(
  db: import('better-sqlite3').Database,
  q: string,
  dataset: number | undefined,
  limit: number,
  offset: number,
): CorpusSearchHit[] {
  const fetchLimit = offset + limit
  let sql = `
    SELECT p.efta_number, p.page_number,
           snippet(pages_fts, 2, '>>>', '<<<', '...', 40) AS snippet
    FROM pages_fts
    JOIN pages p ON p.rowid = pages_fts.rowid`
  const params: (string | number)[] = [q]

  if (dataset) {
    sql += `\n    JOIN documents d ON d.efta_number = p.efta_number`
  }

  sql += `\n    WHERE pages_fts MATCH ?`

  if (dataset) {
    sql += `\n      AND d.dataset = ?`
    params.push(dataset)
  }

  sql += `\n    LIMIT ?`
  params.push(fetchLimit)

  const rows = db.prepare(sql).all(...params) as CorpusRow[]
  return rows.slice(offset).map((row) => ({
    efta_number: row.efta_number,
    page_number: row.page_number,
    snippet: row.snippet,
    dataset: datasetFromEftaNumber(numericEfta(row.efta_number)),
  }))
}

// ── Remote MCP server search ─────────────────────────────────────────────

async function searchRemote(
  q: string,
  dataset: number | undefined,
  limit: number,
  offset: number,
): Promise<CorpusSearchHit[]> {
  const url = new URL('/api/corpus/search', CORPUS_API_URL!)
  url.searchParams.set('q', q)
  if (dataset) url.searchParams.set('dataset', String(dataset))
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('offset', String(offset))

  const headers: Record<string, string> = {}
  if (CORPUS_API_KEY) {
    headers['X-Api-Key'] = CORPUS_API_KEY
  }

  const res = await fetch(url.toString(), {
    headers,
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? `Corpus API returned ${res.status}`)
  }

  const data = await res.json()
  return data.results as CorpusSearchHit[]
}

// ── Supabase enrichment ──────────────────────────────────────────────────

async function enrichResults(
  results: CorpusSearchHit[],
): Promise<Record<string, CorpusEnrichment>> {
  const uniqueEftas = [...new Set(results.map((r) => r.efta_number))]
  const enrichment: Record<string, CorpusEnrichment> = {}

  if (uniqueEftas.length === 0) return enrichment

  const batchSize = 50
  const allDocs: Array<{
    id: string
    bates_number: string
    title: string | null
    document_type: string | null
    severity: string | null
    original_date: string | null
    page_count: number | null
  }> = []

  for (let i = 0; i < uniqueEftas.length; i += batchSize) {
    const batch = uniqueEftas.slice(i, i + batchSize)
    const { data: docs } = await supabase
      .from('documents')
      .select('id, bates_number, title, document_type, severity, original_date, page_count')
      .in('bates_number', batch)
    if (docs) allDocs.push(...docs)
  }

  const docIdToBates = new Map<string, string>()
  for (const doc of allDocs) {
    docIdToBates.set(doc.id, doc.bates_number)
    enrichment[doc.bates_number] = {
      title: doc.title,
      document_type: doc.document_type,
      severity: doc.severity,
      original_date: doc.original_date,
      page_count: doc.page_count,
      entities: [],
    }
  }

  if (allDocs.length > 0) {
    const docIds = allDocs.map((d) => d.id)
    for (let i = 0; i < docIds.length; i += batchSize) {
      const batch = docIds.slice(i, i + batchSize)
      const { data: links } = await supabase
        .from('entity_documents')
        .select('document_id, entity_id, entities(name)')
        .in('document_id', batch)

      if (links) {
        for (const link of links) {
          const bates = docIdToBates.get(link.document_id)
          const entityData = link.entities as unknown as { name: string } | null
          if (bates && enrichment[bates] && entityData?.name) {
            enrichment[bates].entities.push(entityData.name)
          }
        }
      }
    }
  }

  return enrichment
}
