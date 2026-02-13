import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSignedDownloadUrl } from '@/lib/r2/client'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET — Fetch the full extracted text for a document from R2.
 *
 * The DB only stores a 2000-char preview. Full text lives in R2
 * at text/{bates_number}.txt, uploaded by the processing worker.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: doc, error } = await supabase
      .from('documents')
      .select('bates_number, extracted_text')
      .eq('id', id)
      .single()

    if (error || !doc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 },
      )
    }

    if (!doc.bates_number) {
      // No bates number → can't locate R2 file, return DB preview
      return new NextResponse(doc.extracted_text ?? '', {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'private, max-age=3600',
        },
      })
    }

    // Try to fetch full text from R2
    const r2Key = `text/${doc.bates_number}.txt`
    try {
      const signedUrl = await getSignedDownloadUrl(r2Key, 3600)
      const r2Response = await fetch(signedUrl)

      if (r2Response.ok) {
        const text = await r2Response.text()
        return new NextResponse(text, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'private, max-age=3600',
          },
        })
      }
    } catch {
      // R2 fetch failed — fall through to DB preview
    }

    // Fallback: return the 2000-char preview from DB
    return new NextResponse(doc.extracted_text ?? '', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'private, max-age=3600',
        'X-Source': 'db-preview',
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
