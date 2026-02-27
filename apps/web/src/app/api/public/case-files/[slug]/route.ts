import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const { data: caseFile, error } = await supabase
      .from('case_files')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .single()

    if (error || !caseFile) {
      return NextResponse.json({ error: 'Case file not found' }, { status: 404 })
    }

    const caseFileId = caseFile.id

    // Fetch related data in parallel
    const [entitiesResult, questionsResult] = await Promise.all([
      supabase
        .from('case_file_entities')
        .select('*, entity:entities(id, name, slug, tier, entity_type, category, profile_published)')
        .eq('case_file_id', caseFileId),

      supabase
        .from('open_questions')
        .select('*')
        .eq('case_file_id', caseFileId)
        .order('priority', { ascending: true }),
    ])

    return NextResponse.json({
      caseFile,
      entities: entitiesResult.data ?? [],
      questions: questionsResult.data ?? [],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
