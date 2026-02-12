import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/documents/[id]/reprocess
 *
 * Re-queue an existing document for processing without uploading a new PDF.
 * Creates a version snapshot, clears pipeline-generated data, and queues
 * the document for re-processing with the diff stage enabled.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch document
    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Verify file exists in R2
    if (!doc.file_url) {
      return NextResponse.json(
        { error: 'No PDF file in storage — upload the PDF first' },
        { status: 400 },
      )
    }

    // Check not already queued/processing
    const { data: activeQueue } = await supabase
      .from('processing_queue')
      .select('id')
      .eq('document_id', id)
      .in('status', ['queued', 'processing'])
      .limit(1)

    if (activeQueue && activeQueue.length > 0) {
      return NextResponse.json(
        { error: 'Document is already in the processing queue' },
        { status: 409 },
      )
    }

    // Find current max version number
    const { data: versions } = await supabase
      .from('document_versions')
      .select('version_number')
      .eq('document_id', id)
      .order('version_number', { ascending: false })
      .limit(1)

    const maxVersion = versions && versions.length > 0 ? versions[0].version_number : 0
    const snapshotVersion = maxVersion + 1
    const newVersion = snapshotVersion + 1

    // Aggregate current redaction summary
    const { data: redactions } = await supabase
      .from('redactions')
      .select('page_number, category')
      .eq('document_id', id)

    const categories: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 }
    const redactedPages = new Set<number>()
    for (const r of redactions ?? []) {
      if (r.category && categories[r.category] !== undefined) {
        categories[r.category]++
      }
      if (r.page_number != null) redactedPages.add(r.page_number)
    }

    // Collect entity IDs
    const { data: entityDocs } = await supabase
      .from('entity_documents')
      .select('entity_id')
      .eq('document_id', id)

    const entityIds = [...new Set((entityDocs ?? []).map((ed) => ed.entity_id))]

    // Get most recent queue results
    const { data: queueItems } = await supabase
      .from('processing_queue')
      .select('results')
      .eq('document_id', id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)

    // Create version snapshot
    const { data: snapshot, error: snapError } = await supabase
      .from('document_versions')
      .insert({
        document_id: id,
        version_number: snapshotVersion,
        trigger: 'reprocess',
        file_url: doc.file_url,
        file_size_bytes: doc.file_size_bytes,
        page_count: doc.page_count,
        extracted_text: doc.extracted_text,
        document_type: doc.document_type,
        original_date: doc.original_date,
        classification: doc.classification,
        severity: doc.severity,
        processing_status: doc.processing_status,
        forensic_metadata: doc.forensic_metadata ?? {},
        flags: doc.flags ?? [],
        review_notes: doc.review_notes,
        reviewed_by: doc.reviewed_by,
        reviewed_at: doc.reviewed_at,
        redaction_summary: {
          total_pages_with_redactions: redactedPages.size,
          categories,
          total_redactions: (redactions ?? []).length,
        },
        entity_ids: entityIds,
        processing_results: queueItems?.[0]?.results ?? {},
      })
      .select('id')
      .single()

    if (snapError) {
      return NextResponse.json(
        { error: `Failed to create version snapshot: ${snapError.message}` },
        { status: 500 },
      )
    }

    // Clear pipeline-generated data
    await supabase.from('entity_documents').delete().eq('document_id', id)
    await supabase.from('redactions').delete().eq('document_id', id)

    // Update document for re-processing
    await supabase
      .from('documents')
      .update({
        processing_status: 'queued',
        current_version: newVersion,
        extracted_text: null,
        page_count: null,
        thumbnail_url: null,
        forensic_metadata: {},
        flags: [],
      })
      .eq('id', id)

    // Create processing queue entry
    const { data: queueItem } = await supabase
      .from('processing_queue')
      .insert({
        document_id: id,
        status: 'queued',
        priority: 3,
        is_reprocess: true,
        previous_version_id: snapshot.id,
      })
      .select('id')
      .single()

    return NextResponse.json({
      message: 'Document queued for re-processing',
      version: newVersion,
      queue_item_id: queueItem?.id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
