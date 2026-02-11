import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSignedDownloadUrl } from '@/lib/r2/client'

/**
 * Proxy route for document files stored in Cloudflare R2.
 * - Checks auth via Supabase session
 * - Fetches the file_url from the documents table
 * - Generates a signed R2 download URL (R2 requires auth)
 * - Streams the file to the client
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Fetch document record to get file_url
    const { data: doc, error } = await supabase
      .from('documents')
      .select('file_url, bates_number')
      .eq('id', id)
      .single()

    if (error || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (!doc.file_url) {
      return NextResponse.json(
        { error: 'No file available for this document' },
        { status: 404 },
      )
    }

    // Extract R2 key from the stored file_url
    const publicUrl = process.env.R2_PUBLIC_URL ?? ''
    const r2Key = doc.file_url.replace(`${publicUrl}/`, '')

    // Generate a signed download URL (R2 endpoint requires authentication)
    const signedUrl = await getSignedDownloadUrl(r2Key, 3600)
    const fileResponse = await fetch(signedUrl)

    if (!fileResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to retrieve file from storage' },
        { status: 502 },
      )
    }

    const contentType = fileResponse.headers.get('content-type') ?? 'application/pdf'
    const body = fileResponse.body

    if (!body) {
      return NextResponse.json({ error: 'Empty response from storage' }, { status: 502 })
    }

    // Stream the file to the client
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
