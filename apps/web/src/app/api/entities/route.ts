import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Entity } from '@efta/shared'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 25
const DEFAULT_SORT = 'name'
const DEFAULT_ORDER = 'asc'

const ALLOWED_SORT_COLUMNS = new Set([
  'name',
  'tier',
  'entity_type',
  'category',
  'status',
  'created_at',
  'updated_at',
])

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = request.nextUrl

    // Parse query parameters with safe defaults
    const tier = searchParams.get('tier')
    const category = searchParams.get('category')
    const entityType = searchParams.get('entity_type')
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? String(DEFAULT_PAGE), 10) || DEFAULT_PAGE)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))
    const sort = ALLOWED_SORT_COLUMNS.has(searchParams.get('sort') ?? '') ? searchParams.get('sort')! : DEFAULT_SORT
    const order = searchParams.get('order') === 'desc' ? 'desc' : DEFAULT_ORDER

    // Build query with filters
    let query = supabase.from('entities').select('*', { count: 'exact' })

    if (tier) {
      const tierNum = parseInt(tier, 10)
      if (tierNum >= 1 && tierNum <= 6) {
        query = query.eq('tier', tierNum)
      }
    }

    if (category) {
      query = query.eq('category', category)
    }

    if (entityType) {
      query = query.eq('entity_type', entityType)
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
      throw new Error(`Failed to fetch entities: ${error.message}`)
    }

    return NextResponse.json({
      data: data as Entity[],
      count: count ?? 0,
      page,
      limit,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
