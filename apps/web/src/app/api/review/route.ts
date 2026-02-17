import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

/** GET: Fetch documents that need review, enriched with pipeline classify results */
export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('documents')
      .select('id, bates_number, title, document_type, original_date, page_count, file_size_bytes, severity, classification, processing_status, forensic_metadata, extracted_text, flags, review_notes, dataset_id')
      .in('processing_status', ['needs_review', 'extracted'])
      .order('created_at', { ascending: true })
      .limit(100)

    if (error) {
      throw new Error(`Failed to fetch review queue: ${error.message}`)
    }

    const docs = data ?? []

    // Fetch classify results from the most recent completed queue entry per document
    let classifyMap: Record<string, Record<string, unknown>> = {}
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
        }
      }
    }

    // Merge classify data into each document
    const enriched = docs.map((doc) => ({
      ...doc,
      classify: classifyMap[doc.id] ?? null,
    }))

    return NextResponse.json({ documents: enriched })
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
