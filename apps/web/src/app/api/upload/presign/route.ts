import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPresignedUploadUrl } from '@/lib/r2/client'
import { randomUUID } from 'crypto'

interface FileRequest {
  filename: string
  size_bytes: number
  dataset_id?: string
  bates_number?: string
}

function extractBatesFromFilename(filename: string): string | null {
  const match = filename.match(/EFTA\d{8,}/i)
  return match ? match[0].toUpperCase() : null
}

/**
 * Snapshot a document's current state into document_versions before re-processing.
 * Returns the version snapshot ID and version number.
 */
async function createVersionSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  existingDoc: Record<string, unknown>,
  trigger: 'reupload' | 'reprocess',
) {
  const documentId = existingDoc.id as string

  // Find the current max version number
  const { data: versions } = await supabase
    .from('document_versions')
    .select('version_number')
    .eq('document_id', documentId)
    .order('version_number', { ascending: false })
    .limit(1)

  const maxVersion = versions && versions.length > 0 ? versions[0].version_number : 0
  const snapshotVersion = maxVersion + 1

  // Aggregate current redaction summary
  const { data: redactions } = await supabase
    .from('redactions')
    .select('page_number, category')
    .eq('document_id', documentId)

  const categories: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 }
  const redactedPages = new Set<number>()
  for (const r of redactions ?? []) {
    if (r.category && categories[r.category] !== undefined) {
      categories[r.category]++
    }
    if (r.page_number != null) redactedPages.add(r.page_number)
  }
  const redactionSummary = {
    total_pages_with_redactions: redactedPages.size,
    categories,
    total_redactions: (redactions ?? []).length,
  }

  // Collect entity IDs linked to this document
  const { data: entityDocs } = await supabase
    .from('entity_documents')
    .select('entity_id')
    .eq('document_id', documentId)

  const entityIds = [...new Set((entityDocs ?? []).map((ed) => ed.entity_id))]

  // Get most recent completed queue results
  const { data: queueItems } = await supabase
    .from('processing_queue')
    .select('results')
    .eq('document_id', documentId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)

  const processingResults = queueItems?.[0]?.results ?? {}

  // Create version snapshot
  const { data: snapshot, error: snapError } = await supabase
    .from('document_versions')
    .insert({
      document_id: documentId,
      version_number: snapshotVersion,
      trigger,
      file_url: existingDoc.file_url,
      file_size_bytes: existingDoc.file_size_bytes,
      page_count: existingDoc.page_count,
      extracted_text: existingDoc.extracted_text,
      document_type: existingDoc.document_type,
      original_date: existingDoc.original_date,
      classification: existingDoc.classification,
      severity: existingDoc.severity,
      processing_status: existingDoc.processing_status,
      forensic_metadata: existingDoc.forensic_metadata ?? {},
      flags: existingDoc.flags ?? [],
      review_notes: existingDoc.review_notes,
      reviewed_by: existingDoc.reviewed_by,
      reviewed_at: existingDoc.reviewed_at,
      redaction_summary: redactionSummary,
      entity_ids: entityIds,
      processing_results: processingResults,
    })
    .select('id, version_number')
    .single()

  if (snapError) {
    throw new Error(`Failed to create version snapshot: ${snapError.message}`)
  }

  return snapshot
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Verify auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const files: FileRequest[] = body.files

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    if (files.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 files per batch' }, { status: 400 })
    }

    const results = []

    for (const file of files) {
      if (!file.filename) {
        continue
      }

      // Determine bates number
      const bates = file.bates_number || extractBatesFromFilename(file.filename) || null
      const docId = randomUUID()
      const r2Key = bates
        ? `documents/${bates}.pdf`
        : `documents/${docId}.pdf`

      // Generate presigned URL (15 min expiry)
      const presignedUrl = await getPresignedUploadUrl(r2Key, 'application/pdf', 900)

      const fileUrl = `${process.env.R2_PUBLIC_URL}/${r2Key}`

      // Create document record
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .insert({
          id: docId,
          bates_number: bates,
          dataset_id: file.dataset_id || null,
          title: file.filename.replace(/\.pdf$/i, ''),
          file_url: fileUrl,
          file_size_bytes: file.size_bytes,
          processing_status: 'queued',
        })
        .select('id, bates_number')
        .single()

      if (docError) {
        // Bates number conflict — handle as re-upload
        if (docError.code === '23505' && bates) {
          try {
            const reuploadResult = await handleReupload(supabase, bates, fileUrl, file, presignedUrl, r2Key)
            results.push(reuploadResult)
          } catch (reuploadError) {
            results.push({
              filename: file.filename,
              error: reuploadError instanceof Error ? reuploadError.message : 'Re-upload failed',
              skipped: true,
            })
          }
          continue
        }
        throw new Error(`Failed to create document: ${docError.message}`)
      }

      // Create processing queue entry
      await supabase.from('processing_queue').insert({
        document_id: doc.id,
        status: 'queued',
        priority: 5,
      })

      results.push({
        id: doc.id,
        filename: file.filename,
        bates_number: doc.bates_number,
        r2_key: r2Key,
        presigned_url: presignedUrl,
      })
    }

    return NextResponse.json({ files: results })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * Handle re-upload of an existing document:
 * 1. Snapshot current state into document_versions
 * 2. Clear pipeline-generated data (entity_documents, redactions)
 * 3. Update document record for re-processing
 * 4. Create new processing_queue entry
 */
async function handleReupload(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bates: string,
  fileUrl: string,
  file: FileRequest,
  presignedUrl: string,
  r2Key: string,
) {
  // Fetch existing document
  const { data: existingDoc, error: fetchError } = await supabase
    .from('documents')
    .select('*')
    .eq('bates_number', bates)
    .single()

  if (fetchError || !existingDoc) {
    throw new Error(`Could not find existing document for ${bates}`)
  }

  // Check if already queued/processing — prevent double-queue
  const { data: activeQueue } = await supabase
    .from('processing_queue')
    .select('id')
    .eq('document_id', existingDoc.id)
    .in('status', ['queued', 'processing'])
    .limit(1)

  if (activeQueue && activeQueue.length > 0) {
    throw new Error(`${bates} is already in the processing queue`)
  }

  // Create version snapshot
  const snapshot = await createVersionSnapshot(supabase, existingDoc, 'reupload')
  const newVersion = snapshot.version_number + 1

  // Delete pipeline-generated data for clean re-run
  await supabase.from('entity_documents').delete().eq('document_id', existingDoc.id)
  await supabase.from('redactions').delete().eq('document_id', existingDoc.id)

  // Update document record — preserve review data, clear processing data
  await supabase
    .from('documents')
    .update({
      file_url: fileUrl,
      file_size_bytes: file.size_bytes,
      processing_status: 'queued',
      current_version: newVersion,
      // Clear fields that will be regenerated by the pipeline
      extracted_text: null,
      page_count: null,
      thumbnail_url: null,
      forensic_metadata: {},
      flags: [],
      // Preserve: classification, severity, review_notes, reviewed_by, reviewed_at, dataset_id
    })
    .eq('id', existingDoc.id)

  // Create processing queue entry with re-process flag
  await supabase.from('processing_queue').insert({
    document_id: existingDoc.id,
    status: 'queued',
    priority: 3, // Higher priority than new uploads
    is_reprocess: true,
    previous_version_id: snapshot.id,
  })

  return {
    id: existingDoc.id,
    filename: file.filename,
    bates_number: bates,
    r2_key: r2Key,
    presigned_url: presignedUrl,
    reupload: true,
    previous_version: snapshot.version_number,
    new_version: newVersion,
  }
}
