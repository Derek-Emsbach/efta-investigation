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
        // If bates number conflict, skip (already uploaded)
        if (docError.code === '23505') {
          results.push({
            filename: file.filename,
            error: `Document with bates number ${bates} already exists`,
            skipped: true,
          })
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
