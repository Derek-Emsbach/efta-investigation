import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSignedDownloadUrl } from '@/lib/r2/client'
import { checkRateLimit } from '@/lib/rate-limit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: RouteContext) {
  const rateLimited = checkRateLimit(request)
  if (rateLimited) return rateLimited

  try {
    const { id } = await params

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
          const ct = origResponse.headers.get('content-type') ?? `image/${img.format ?? 'jpeg'}`
          return new NextResponse(origResponse.body, {
            status: 200,
            headers: {
              'Content-Type': ct,
              'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
            },
          })
        }
      }
      return NextResponse.json({ error: 'Image file not found in storage' }, { status: 404 })
    }

    const contentType = fileResponse.headers.get('content-type') ?? `image/${img.format ?? 'jpeg'}`

    return new NextResponse(fileResponse.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
