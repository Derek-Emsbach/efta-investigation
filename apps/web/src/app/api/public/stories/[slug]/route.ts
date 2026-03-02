import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rateLimited = checkRateLimit(request)
  if (rateLimited) return rateLimited

  try {
    const { slug } = await params

    const { data: story, error } = await supabase
      .from('stories')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .single()

    if (error || !story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    // Fetch relations in parallel
    const [entitiesResult, citationsResult, caseFileResult] = await Promise.all([
      supabase
        .from('story_entities')
        .select('*, entity:entities(id, name, slug, tier, category, profile_published)')
        .eq('story_id', story.id),

      supabase
        .from('story_citations')
        .select('*, document:documents(id, bates_number, title, document_type)')
        .eq('story_id', story.id)
        .order('citation_number', { ascending: true }),

      story.case_file_id
        ? supabase
            .from('case_files')
            .select('id, slug, case_id, title, status')
            .eq('id', story.case_file_id)
            .single()
        : Promise.resolve({ data: null }),
    ])

    return NextResponse.json({
      story,
      entities: entitiesResult.data ?? [],
      citations: citationsResult.data ?? [],
      caseFile: caseFileResult.data,
    }, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=1200' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
