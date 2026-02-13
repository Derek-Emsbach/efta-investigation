import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = request.nextUrl

    // Parse query parameters with safe defaults
    const documentType = searchParams.get('document_type')
    const severity = searchParams.get('severity')
    const status = searchParams.get('status')
    const datasetId = searchParams.get('dataset_id')
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? String(DEFAULT_PAGE), 10) || DEFAULT_PAGE)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))
    const sort = ALLOWED_SORT_COLUMNS.has(searchParams.get('sort') ?? '') ? searchParams.get('sort')! : DEFAULT_SORT
    const order = searchParams.get('order') === 'asc' ? 'asc' : DEFAULT_ORDER

    // Build query — project only columns the table needs (avoids sending large JSONB fields)
    let query = supabase.from('documents').select(
      'id, bates_number, title, document_type, original_date, severity, page_count, processing_status, dataset_id, created_at, updated_at',
      { count: 'exact' }
    )

    if (documentType) {
      query = query.eq('document_type', documentType)
    }

    if (severity) {
      query = query.eq('severity', severity)
    }

    if (status) {
      query = query.eq('processing_status', status)
    }

    if (datasetId) {
      query = query.eq('dataset_id', datasetId)
    }

    if (search) {
      query = query.textSearch('search_vector', search)
    }

    // Apply sorting and pagination
    query = query.order(sort, { ascending: order === 'asc' })

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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
