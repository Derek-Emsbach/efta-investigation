import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSignedDownloadUrl } from '@/lib/r2/client'
import { headObject } from '@/lib/r2/client'

type RouteContext = { params: Promise<{ id: string }> }

/** Resolve document record → R2 key, returning an error response if invalid. */
async function resolveR2Key(id: string) {
  const supabase = await createClient()

  const { data: doc, error } = await supabase
    .from('documents')
    .select('file_url, bates_number')
    .eq('id', id)
    .single()

  if (error || !doc) {
    return { error: NextResponse.json({ error: 'Document not found' }, { status: 404 }) }
  }

  if (!doc.file_url) {
    return {
      error: NextResponse.json(
        { error: 'No file available for this document' },
        { status: 404 },
      ),
    }
  }

  const publicUrl = (process.env.R2_PUBLIC_URL ?? '').trim()
  const cleanFileUrl = doc.file_url.replace(/[\r\n]/g, '')
  const r2Key = cleanFileUrl.replace(`${publicUrl}/`, '')

  return { r2Key, doc }
}

function r2ErrorResponse(status: number, r2Key: string) {
  console.error(`[document-file] R2 returned ${status} for key="${r2Key}"`)
  if (status === 404 || status === 403) {
    return NextResponse.json(
      {
        error: 'File not found in storage',
        detail: `The document record references a file that does not exist in R2 (key: ${r2Key}). The PDF may not have been uploaded yet.`,
      },
      { status: 404 },
    )
  }
  return NextResponse.json(
    { error: 'Failed to retrieve file from storage', r2Status: status },
    { status: 502 },
  )
}

/**
 * HEAD — lightweight check used by the document viewer to verify
 * the file exists before embedding the PDF.
 */
export async function HEAD(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const resolved = await resolveR2Key(id)
    if ('error' in resolved) return resolved.error

    const exists = await headObject(resolved.r2Key)
    if (!exists) {
      return new NextResponse(null, { status: 404 })
    }
    return new NextResponse(null, {
      status: 200,
      headers: { 'Content-Type': 'application/pdf' },
    })
  } catch {
    return new NextResponse(null, { status: 500 })
  }
}

/**
 * GET — proxy the file from R2 with a signed URL, streaming it to the client.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const resolved = await resolveR2Key(id)
    if ('error' in resolved) return resolved.error

    const { r2Key, doc } = resolved

    // Generate a signed download URL (R2 endpoint requires authentication)
    let fileResponse: Response
    try {
      const signedUrl = await getSignedDownloadUrl(r2Key, 3600)
      fileResponse = await fetch(signedUrl)
    } catch (fetchError) {
      const msg = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error'
      console.error(`[document-file] R2 fetch failed for key="${r2Key}": ${msg}`)
      return NextResponse.json(
        { error: 'Failed to connect to file storage', detail: msg },
        { status: 502 },
      )
    }

    if (!fileResponse.ok) {
      return r2ErrorResponse(fileResponse.status, r2Key)
    }

    const contentType = fileResponse.headers.get('content-type') ?? 'application/pdf'
    const body = fileResponse.body

    if (!body) {
      return NextResponse.json({ error: 'Empty response from storage' }, { status: 502 })
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${doc.bates_number ?? id}.pdf"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
