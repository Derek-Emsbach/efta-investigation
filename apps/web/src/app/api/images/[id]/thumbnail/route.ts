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
      .select('r2_key, thumbnail_r2_key, format')
      .eq('id', id)
      .single()

    if (error || !img) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Prefer thumbnail, fall back to original
    const r2Key = img.thumbnail_r2_key ?? img.r2_key
    const signedUrl = await getSignedDownloadUrl(r2Key, 3600)
    const fileResponse = await fetch(signedUrl)

    if (!fileResponse.ok) {
      // If thumbnail missing, try original
      if (img.thumbnail_r2_key && r2Key === img.thumbnail_r2_key) {
        const origUrl = await getSignedDownloadUrl(img.r2_key, 3600)
        const origResponse = await fetch(origUrl)
        if (origResponse.ok) {
          return new NextResponse(origResponse.body, {
            status: 200,
            headers: {
              'Content-Type': `image/${img.format ?? 'jpeg'}`,
              'Cache-Control': 'private, max-age=86400',
            },
          })
        }
      }
      return NextResponse.json({ error: 'Image file not found in storage' }, { status: 404 })
    }

    return new NextResponse(fileResponse.body, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'private, max-age=86400',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
