import { NextResponse } from 'next/server'
import { getSignedDownloadUrl } from '@/lib/r2/client'
import { checkRateLimit } from '@/lib/rate-limit'

const VALID_CATEGORIES = new Set(['heroes', 'inline', 'entities'])

type RouteContext = { params: Promise<{ path: string[] }> }

export async function GET(request: Request, { params }: RouteContext) {
  const rateLimited = await checkRateLimit(request)
  if (rateLimited) return rateLimited

  try {
    const { path } = await params

    // Expect exactly 2 segments: category/filename
    if (path.length !== 2) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    const [category, filename] = path

    // Validate category
    if (!VALID_CATEGORIES.has(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }

    // Validate filename (alphanumeric, hyphens, underscores, dots — no traversal)
    if (!/^[\w][\w.-]*$/.test(filename) || filename.includes('..')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }

    const r2Key = `publication/${category}/${filename}`
    const signedUrl = await getSignedDownloadUrl(r2Key, 3600)
    const fileResponse = await fetch(signedUrl)

    if (!fileResponse.ok) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const contentType = fileResponse.headers.get('content-type') ?? 'image/jpeg'

    return new NextResponse(fileResponse.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Aggressive caching — these are static, immutable publication images
        'Cache-Control': 'public, max-age=604800, s-maxage=2592000, stale-while-revalidate=604800',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
