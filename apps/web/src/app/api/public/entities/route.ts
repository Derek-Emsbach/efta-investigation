import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(request: NextRequest) {
  try {
    const { data: entities, error } = await supabase
      .from('entities')
      .select('id, name, slug, entity_type, tier, category, bio, status, aliases, datasets_appeared, profile_published')
      .eq('profile_published', true)
      .order('tier', { ascending: true })
      .order('name')

    if (error) {
      throw new Error(`Failed to fetch entities: ${error.message}`)
    }

    return NextResponse.json({ entities: entities ?? [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
