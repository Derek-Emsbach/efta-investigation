import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Cache homepage data for 2 minutes
let homepageCache: { data: unknown; expiry: number } | null = null

export async function GET(request: NextRequest) {
  const rateLimited = checkRateLimit(request)
  if (rateLimited) return rateLimited

  try {
    if (homepageCache && homepageCache.expiry > Date.now()) {
      return NextResponse.json(homepageCache.data)
    }

    const [storiesResult, caseFilesResult, entitiesResult, statsResult] =
      await Promise.all([
        // Latest published stories
        supabase
          .from('stories')
          .select('id, slug, title, deck, section, byline, reading_time_minutes, is_featured, published_at')
          .eq('is_published', true)
          .order('published_at', { ascending: false })
          .limit(10),

        // Published case files
        supabase
          .from('case_files')
          .select('id, slug, case_id, title, status, summary, completion_percentage, published_at')
          .eq('is_published', true)
          .order('published_at', { ascending: false })
          .limit(6),

        // Top entities by tier (for spotlight)
        supabase
          .from('entities')
          .select('id, name, slug, tier, category, bio, profile_published')
          .eq('profile_published', true)
          .in('tier', [1, 2])
          .order('tier', { ascending: true })
          .order('name')
          .limit(8),

        // Quick stats
        supabase.rpc('estimated_document_count'),
      ])

    const data = {
      stories: storiesResult.data ?? [],
      caseFiles: caseFilesResult.data ?? [],
      entities: entitiesResult.data ?? [],
      stats: {
        documents: statsResult.data ?? 1_370_000,
        pages: 2_770_000,
        entities: 99,
        connections: 200,
        openQuestions: 50,
      },
    }

    homepageCache = { data, expiry: Date.now() + 2 * 60 * 1000 }

    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
