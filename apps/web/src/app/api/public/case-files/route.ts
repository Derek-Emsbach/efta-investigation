import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(request: NextRequest) {
  const rateLimited = await checkRateLimit(request)
  if (rateLimited) return rateLimited

  try {
    const { data: caseFiles, error } = await supabase
      .from('case_files')
      .select('id, slug, case_id, title, status, classification, summary, completion_percentage, published_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch case files: ${error.message}`)
    }

    return NextResponse.json({ caseFiles: caseFiles ?? [] }, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=1200' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
