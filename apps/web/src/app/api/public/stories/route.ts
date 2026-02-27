import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const section = searchParams.get('section') || undefined

    let query = supabase
      .from('stories')
      .select('id, slug, title, deck, section, byline, reading_time_minutes, is_featured, published_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false })

    if (section) {
      query = query.eq('section', section)
    }

    const { data: stories, error } = await query

    if (error) {
      throw new Error(`Failed to fetch stories: ${error.message}`)
    }

    return NextResponse.json({ stories: stories ?? [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
