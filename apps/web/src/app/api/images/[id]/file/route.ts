import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSignedDownloadUrl } from '@/lib/r2/client'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: img, error } = await supabase
      .from('document_images')
      .select('r2_key, format')
      .eq('id', id)
      .single()

    if (error || !img) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    const signedUrl = await getSignedDownloadUrl(img.r2_key, 3600)
    const fileResponse = await fetch(signedUrl)

    if (!fileResponse.ok) {
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 })
    }

    const contentType = fileResponse.headers.get('content-type') ?? `image/${img.format ?? 'jpeg'}`

    return new NextResponse(fileResponse.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=86400',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
