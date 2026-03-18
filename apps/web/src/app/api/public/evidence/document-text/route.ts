import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { corpusApiFetch, isCorpusApiConfigured } from '@/lib/corpus-api'

/**
 * GET /api/public/evidence/document-text
 *
 * Retrieve OCR-extracted text from the corpus by EFTA number.
 *
 * Params:
 *   efta_number  — required
 *   page         — specific page (0-indexed)
 *   start_page   — range start (inclusive)
 *   end_page     — range end (inclusive)
 *
 * Without page params, returns document metadata + first page preview.
 */
export async function GET(request: NextRequest) {
  const rateLimited = await checkRateLimit(request, 'search')
  if (rateLimited) return rateLimited

  if (!isCorpusApiConfigured()) {
    return NextResponse.json(
      { error: 'Document text unavailable. Configure CORPUS_API_URL.' },
      { status: 503 },
    )
  }

  const { searchParams } = new URL(request.url)
  const eftaNumber = searchParams.get('efta_number')

  if (!eftaNumber) {
    return NextResponse.json({ error: 'efta_number is required' }, { status: 400 })
  }

  const params: Record<string, string> = { efta_number: eftaNumber }
  const page = searchParams.get('page')
  const startPage = searchParams.get('start_page')
  const endPage = searchParams.get('end_page')

  if (page) params.page = page
  if (startPage) params.start_page = startPage
  if (endPage) params.end_page = endPage

  try {
    const data = await corpusApiFetch('/api/corpus/text', params)

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('404') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
