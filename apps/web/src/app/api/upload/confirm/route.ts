import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { headObject } from '@/lib/r2/client'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { document_ids } = await request.json()

    if (!document_ids || !Array.isArray(document_ids) || document_ids.length === 0) {
      return NextResponse.json({ error: 'No document IDs provided' }, { status: 400 })
    }

    // Fetch document records to get R2 keys
    const { data: docs, error } = await supabase
      .from('documents')
      .select('id, file_url, processing_status')
      .in('id', document_ids)

    if (error) {
      throw new Error(`Failed to fetch documents: ${error.message}`)
    }

    let confirmed = 0
    const failures: string[] = []

    for (const doc of docs ?? []) {
      if (!doc.file_url) {
        failures.push(doc.id)
        continue
      }

      // Extract R2 key from file_url
      const publicUrl = (process.env.R2_PUBLIC_URL ?? '').trim()
      const key = doc.file_url.replace(/[\r\n]/g, '').replace(`${publicUrl}/`, '')

      const exists = await headObject(key)
      if (exists) {
        // File confirmed in R2 — create queue entry and mark document as queued.
        // Queue entries are created here (not in /presign) to prevent the worker
        // from picking up documents before the file finishes uploading.

        // Check if this is a reupload by looking for a version snapshot
        const { data: versionSnapshot } = await supabase
          .from('document_versions')
          .select('id')
          .eq('document_id', doc.id)
          .order('version_number', { ascending: false })
          .limit(1)
          .single()

        const isReprocess = !!versionSnapshot
        await supabase.from('processing_queue').insert({
          document_id: doc.id,
          status: 'queued',
          priority: isReprocess ? 3 : 5,
          ...(isReprocess && {
            is_reprocess: true,
            previous_version_id: versionSnapshot.id,
          }),
        })

        await supabase
          .from('documents')
          .update({ processing_status: 'queued' })
          .eq('id', doc.id)

        confirmed++
      } else {
        failures.push(doc.id)

        // Mark failed uploads — no queue entry exists to update
        await supabase
          .from('documents')
          .update({ processing_status: 'failed' })
          .eq('id', doc.id)
      }
    }

    return NextResponse.json({ confirmed, failed: failures.length, failures })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
