import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 40

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = request.nextUrl

    const page = Math.max(1, parseInt(searchParams.get('page') ?? String(DEFAULT_PAGE), 10) || DEFAULT_PAGE)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))
    const documentId = searchParams.get('document_id')
    const entityId = searchParams.get('entity_id')
    const imageType = searchParams.get('image_type')
    const tag = searchParams.get('tag')

    // If filtering by entity, first get their document IDs
    let entityDocIds: string[] | null = null
    if (entityId) {
      const { data: edLinks } = await supabase
        .from('entity_documents')
        .select('document_id')
        .eq('entity_id', entityId)
      entityDocIds = (edLinks ?? []).map((r) => r.document_id)
      if (entityDocIds.length === 0) {
        return NextResponse.json({ data: [], count: 0, page, limit })
      }
    }

    let query = supabase
      .from('document_images')
      .select(
        'id, document_id, page_number, image_index, r2_key, thumbnail_r2_key, width, height, format, image_type, tags, caption, is_redacted, file_size_bytes, created_at, documents:document_id(id, bates_number, title, dataset_id)',
        { count: 'exact' }
      )

    if (documentId) {
      query = query.eq('document_id', documentId)
    }

    if (entityDocIds) {
      query = query.in('document_id', entityDocIds)
    }

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
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
