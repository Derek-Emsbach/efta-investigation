import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'
import { getCorpusDb, datasetFromEftaNumber, numericEfta } from '@/lib/corpus-db'
import type { CorpusSearchHit, CorpusEnrichment, CorpusSearchResponse } from '@efta/shared'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

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
  const rateLimited = checkRateLimit(request, 'search')
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

    // Open corpus DB
    const db = getCorpusDb()
    if (!db) {
      return NextResponse.json(
        { error: 'Corpus database not available. Full corpus search requires local SQLite database.' },
        { status: 503 }
      )
    }

    // Build FTS5 query — same SQL pattern as MCP corpus_search tool
    // Fetch more than needed to support offset pagination
    const fetchLimit = offset + limit
    let sql = `
      SELECT p.efta_number, p.page_number,
             snippet(pages_fts, 2, '>>>', '<<<', '...', 40) AS snippet
      FROM pages_fts
      JOIN pages p ON p.rowid = pages_fts.rowid`
    const params: (string | number)[] = [q]

    if (dataset) {
      sql += `\n      JOIN documents d ON d.efta_number = p.efta_number`
    }

    sql += `\n      WHERE pages_fts MATCH ?`

    if (dataset) {
      sql += `\n        AND d.dataset = ?`
      params.push(dataset)
    }

    sql += `\n      LIMIT ?`
    params.push(fetchLimit)

    let rows: CorpusRow[]
    try {
      rows = db.prepare(sql).all(...params) as CorpusRow[]
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('fts5')) {
        return NextResponse.json(
          {
            error: `FTS5 query error: ${msg}. Try quoting phrases: "leon black" or using AND/OR operators.`,
          },
          { status: 400 }
        )
      }
      throw err
    }

    // Apply offset
    const slicedRows = rows.slice(offset)

    // Add dataset info to each hit
    const results: CorpusSearchHit[] = slicedRows.map((row) => ({
      efta_number: row.efta_number,
      page_number: row.page_number,
      snippet: row.snippet,
      dataset: datasetFromEftaNumber(numericEfta(row.efta_number)),
    }))

    // Enrich from Supabase — batch lookup unique EFTA numbers
    const uniqueEftas = [...new Set(results.map((r) => r.efta_number))]
    const enrichment: Record<string, CorpusEnrichment> = {}

    if (uniqueEftas.length > 0) {
      // Query documents in batches of 50 (Supabase IN filter)
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

      // Build doc ID → bates map for entity lookup
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

      // Get entity names for these documents
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
    }

    const response: CorpusSearchResponse = {
      results,
      enrichment,
      query: q,
      total: results.length,
      offset,
      limit,
    }

    // Cache
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
