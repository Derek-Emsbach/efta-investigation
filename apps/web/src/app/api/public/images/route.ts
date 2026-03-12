import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const DEFAULT_LIMIT = 40

export async function GET(request: NextRequest) {
  const rateLimited = checkRateLimit(request)
  if (rateLimited) return rateLimited

  try {
    const { searchParams } = request.nextUrl

    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))
    const imageType = searchParams.get('image_type')
    const tag = searchParams.get('tag')

    let query = supabase
      .from('document_images')
      .select(
        'id, document_id, page_number, image_index, r2_key, thumbnail_r2_key, width, height, format, image_type, tags, caption, is_redacted, file_size_bytes, created_at, documents:document_id(id, bates_number, title, dataset_id)',
        { count: 'exact' }
      )

    if (imageType) {
      query = query.eq('image_type', imageType)
    }

    if (tag) {
      query = query.contains('tags', [tag])
    }

    query = query.order('created_at', { ascending: false })

    const rangeStart = (page - 1) * limit
    const rangeEnd = page * limit - 1
    query = query.range(rangeStart, rangeEnd)

    const { data, error, count } = await query

    if (error) {
      throw new Error(`Failed to fetch images: ${error.message}`)
    }

    return NextResponse.json({
      data: data ?? [],
      count: count ?? 0,
      page,
      limit,
    }, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
