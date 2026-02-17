import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decodeCursor, encodeCursor, buildCursorFilter } from '@/lib/pagination/cursor'
import type { Document } from '@efta/shared'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 25
const DEFAULT_SORT = 'created_at'
const DEFAULT_ORDER = 'desc'

const ALLOWED_SORT_COLUMNS = new Set([
  'bates_number',
  'document_type',
  'original_date',
  'severity',
  'page_count',
  'processing_status',
  'created_at',
  'updated_at',
])

const SELECT_COLUMNS =
  'id, bates_number, title, document_type, original_date, severity, page_count, processing_status, dataset_id, created_at, updated_at'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = request.nextUrl

    const cursor = searchParams.get('cursor')
    const direction = searchParams.get('direction') as 'next' | 'prev' | null

    // If cursor param present → cursor mode, else offset mode
    if (cursor !== null || direction !== null) {
      return handleCursorMode(supabase, searchParams)
    }
    return handleOffsetMode(supabase, searchParams)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── Shared filter builder ─────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(
  query: any,
  searchParams: URLSearchParams,
) {
  const documentType = searchParams.get('document_type')
  const severity = searchParams.get('severity')
  const status = searchParams.get('status')
  const datasetId = searchParams.get('dataset_id')
  const search = searchParams.get('search')

  if (documentType) query = query.eq('document_type', documentType)
  if (severity) query = query.eq('severity', severity)
  if (status) query = query.eq('processing_status', status)
  if (datasetId) query = query.eq('dataset_id', datasetId)
  if (search) query = query.textSearch('search_vector', search)

  return query
}

function parseSortParams(searchParams: URLSearchParams) {
  const sort = ALLOWED_SORT_COLUMNS.has(searchParams.get('sort') ?? '')
    ? searchParams.get('sort')!
    : DEFAULT_SORT
  const order = searchParams.get('order') === 'asc' ? 'asc' : DEFAULT_ORDER
  const ascending = order === 'asc'
  return { sort, order, ascending }
}

// ─── Offset mode (backward compat) ────────────────────

async function handleOffsetMode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  searchParams: URLSearchParams,
) {
  const page = Math.max(1, parseInt(searchParams.get('page') ?? String(DEFAULT_PAGE), 10) || DEFAULT_PAGE)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))
  const { sort, ascending } = parseSortParams(searchParams)

  let query = supabase.from('documents').select(SELECT_COLUMNS, { count: 'exact' })
  query = applyFilters(query, searchParams)
  query = query.order(sort, { ascending })

  const rangeStart = (page - 1) * limit
  const rangeEnd = page * limit - 1
  query = query.range(rangeStart, rangeEnd)

  const { data, error, count } = await query

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`)
  }

  return NextResponse.json({
    data: data as Document[],
    count: count ?? 0,
    page,
    limit,
  })
}

// ─── Cursor mode ──────────────────────────────────────

async function handleCursorMode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  searchParams: URLSearchParams,
) {
  const cursor = searchParams.get('cursor')
  const direction = (searchParams.get('direction') ?? 'next') as 'next' | 'prev'
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))
  const { sort, ascending } = parseSortParams(searchParams)

  // For "prev" direction we flip the sort, then reverse the results
  const isPrev = direction === 'prev'
  const effectiveAscending = isPrev ? !ascending : ascending

  // Build query — no { count: 'exact' } to avoid COUNT(*) on 1M+ rows
  let query = supabase.from('documents').select(SELECT_COLUMNS)
  query = applyFilters(query, searchParams)

  // Apply cursor filter if we have a cursor (first page has no cursor)
  if (cursor) {
    const { v, id } = decodeCursor(cursor)
    const filterStr = buildCursorFilter(sort, v, id, effectiveAscending)
    query = query.or(filterStr)
  }

  // Sort: primary by sort column, tiebreak by id
  query = query
    .order(sort, { ascending: effectiveAscending })
    .order('id', { ascending: effectiveAscending })
    .limit(limit + 1) // extra row to detect hasMore

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`)
  }

  let rows = (data ?? []) as Document[]
  const hasMore = rows.length > limit
  if (hasMore) rows = rows.slice(0, limit)

  // Reverse results for prev direction (we flipped sort to get them)
  if (isPrev) rows.reverse()

  // Get estimated total via RPC (pg_class.reltuples — instant, no table scan)
  const { data: estData } = await supabase.rpc('estimated_document_count')
  const estimatedTotal = typeof estData === 'number' ? estData : 0

  // Build cursors from first/last rows
  const firstRow = rows[0] as unknown as Record<string, unknown> | undefined
  const lastRow = rows[rows.length - 1] as unknown as Record<string, unknown> | undefined

  const nextCursor = hasMore && lastRow
    ? encodeCursor(lastRow[sort] as string | number | null, lastRow.id as string)
    : null

  // prevCursor: if we had a cursor coming in, the first row can serve as prev
  const prevCursor = cursor && firstRow
    ? encodeCursor(firstRow[sort] as string | number | null, firstRow.id as string)
    : null

  return NextResponse.json({
    data: rows,
    nextCursor,
    prevCursor,
    hasMore: isPrev ? true : hasMore, // if navigating back, there's always a "next"
    hasPrev: isPrev ? hasMore : !!cursor, // first page has no prev
    estimatedTotal,
  })
}
