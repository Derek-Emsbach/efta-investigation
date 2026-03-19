import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

/** GET: Fetch documents that need review, enriched with pipeline classify results.
 *
 * Query params (all optional):
 *  severity        — comma-separated: extreme_critical,critical,high,routine
 *  classification  — comma-separated: high,medium,low
 *  document_type   — comma-separated: fbi_302,email,court_filing,...
 *  dataset_id      — UUID
 *  entity_id       — UUID (filters to docs linked to this entity)
 *  date_from       — ISO date (original_date >=)
 *  date_to         — ISO date (original_date <=)
 *  min_pages       — integer
 *  max_pages       — integer
 *  page            — pagination page (default 1)
 *  limit           — items per page (default 100, max 500)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') ?? '100', 10)))
    const from = (page - 1) * limit
    const to = from + limit - 1

    // Entity filter: two-step lookup (entity_documents → document IDs)
    let entityDocIds: string[] | null = null
    const entityId = searchParams.get('entity_id')
    if (entityId) {
      const { data: entityDocs } = await supabase
        .from('entity_documents')
        .select('document_id')
        .eq('entity_id', entityId)
      entityDocIds = (entityDocs ?? []).map((ed) => ed.document_id)
      if (entityDocIds.length === 0) {
        return NextResponse.json({ documents: [], totalCount: 0, page, limit })
      }
    }

    // Build query
    const selectFields = 'id, bates_number, title, document_type, original_date, page_count, file_size_bytes, severity, classification, processing_status, forensic_metadata, extracted_text, flags, review_notes, dataset_id'

    let query = supabase
      .from('documents')
      .select(selectFields, { count: 'exact' })
      .in('processing_status', ['needs_review', 'extracted'])
      .order('created_at', { ascending: true })
      .range(from, to)

    // Apply filters
    const severity = searchParams.get('severity')
    if (severity) {
      query = query.in('severity', severity.split(','))
    }

    const classification = searchParams.get('classification')
    if (classification) {
      query = query.in('classification', classification.split(','))
    }

    const documentType = searchParams.get('document_type')
    if (documentType) {
      query = query.in('document_type', documentType.split(','))
    }

    const datasetId = searchParams.get('dataset_id')
    if (datasetId) {
      query = query.eq('dataset_id', datasetId)
    }

    if (entityDocIds) {
      query = query.in('id', entityDocIds)
    }

    const dateFrom = searchParams.get('date_from')
    if (dateFrom) {
      query = query.gte('original_date', dateFrom)
    }

    const dateTo = searchParams.get('date_to')
    if (dateTo) {
      query = query.lte('original_date', dateTo)
    }

    const minPages = searchParams.get('min_pages')
    if (minPages) {
      query = query.gte('page_count', parseInt(minPages, 10))
    }

    const maxPages = searchParams.get('max_pages')
    if (maxPages) {
      query = query.lte('page_count', parseInt(maxPages, 10))
    }

    const { data, error, count } = await query

    if (error) {
      throw new Error(`Failed to fetch review queue: ${error.message}`)
    }

    const docs = data ?? []
    const totalCount = count ?? 0

    // Fetch classify + auto-review results from the most recent completed queue entry per document
    const classifyMap: Record<string, Record<string, unknown>> = {}
    const autoReviewMap: Record<string, Record<string, unknown>> = {}
    if (docs.length > 0) {
      const docIds = docs.map((d) => d.id)
      const { data: queueItems } = await supabase
        .from('processing_queue')
        .select('document_id, results, is_reprocess')
        .in('document_id', docIds)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })

      // Keep only the most recent queue entry per document
      for (const item of queueItems ?? []) {
        if (!classifyMap[item.document_id]) {
          const results = (item.results ?? {}) as Record<string, unknown>
          const classify = (results.classify ?? {}) as Record<string, unknown>
          classifyMap[item.document_id] = {
            ...classify,
            is_reprocess: item.is_reprocess ?? false,
          }
          // Surface auto-review results if present
          const autoReview = results.auto_review as Record<string, unknown> | undefined
          if (autoReview && !autoReview.skipped) {
            autoReviewMap[item.document_id] = autoReview
          }
        }
      }
    }

    // Merge classify + auto-review data into each document
    const enriched = docs.map((doc) => ({
      ...doc,
      classify: classifyMap[doc.id] ?? null,
      auto_review: autoReviewMap[doc.id] ?? null,
    }))

    return NextResponse.json({ documents: enriched, totalCount, page, limit })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** PATCH: Approve, flag, or reject a document (admin only) */
export async function PATCH(request: Request) {
  try {
    const result = await requireAdmin()
    if (result instanceof NextResponse) return result
    const { user, supabase } = result

    const body = await request.json()
    const { document_id, action, fields } = body

    if (!document_id || !action) {
      return NextResponse.json({ error: 'document_id and action required' }, { status: 400 })
    }

    const updateFields: Record<string, unknown> = {}

    switch (action) {
      case 'approve':
        updateFields.processing_status = 'reviewed'
        updateFields.reviewed_by = user.email
        updateFields.reviewed_at = new Date().toISOString()
        break
      case 'flag':
        // Add flag to flags array
        if (fields?.flag) {
          const { data: existing } = await supabase
            .from('documents')
            .select('flags')
            .eq('id', document_id)
            .single()
          const currentFlags = (existing?.flags as string[]) ?? []
          if (!currentFlags.includes(fields.flag)) {
            updateFields.flags = [...currentFlags, fields.flag]
          }
        }
        break
      case 'reject':
        updateFields.processing_status = 'failed'
        break
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    // Merge editable fields
    if (fields) {
      if (fields.title !== undefined) updateFields.title = fields.title
      if (fields.document_type !== undefined) updateFields.document_type = fields.document_type
      if (fields.original_date !== undefined) updateFields.original_date = fields.original_date
      if (fields.classification !== undefined) updateFields.classification = fields.classification
      if (fields.severity !== undefined) updateFields.severity = fields.severity
      if (fields.review_notes !== undefined) updateFields.review_notes = fields.review_notes
    }

    const { error } = await supabase
      .from('documents')
      .update(updateFields)
      .eq('id', document_id)

    if (error) {
      throw new Error(`Failed to update document: ${error.message}`)
    }

    return NextResponse.json({ success: true, action, document_id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
