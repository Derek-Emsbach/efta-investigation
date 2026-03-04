import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, subscription_tier, avatar_url, bio_short, is_public, created_at')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  return NextResponse.json({ profile })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  // Only allow updating safe fields — never role or subscription_tier
  const allowed: Record<string, unknown> = {}
  if (typeof body.display_name === 'string') {
    const name = body.display_name.trim()
    if (name.length < 2 || name.length > 40) {
      return NextResponse.json(
        { error: 'Display name must be 2–40 characters.' },
        { status: 400 },
      )
    }
    allowed.display_name = name
  }
  if (typeof body.bio_short === 'string') {
    allowed.bio_short = body.bio_short.slice(0, 160)
  }
  if (typeof body.avatar_url === 'string' || body.avatar_url === null) {
    allowed.avatar_url = body.avatar_url
  }
  if (typeof body.is_public === 'boolean') {
    allowed.is_public = body.is_public
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ ...allowed, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
