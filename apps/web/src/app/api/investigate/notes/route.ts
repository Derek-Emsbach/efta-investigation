import { NextResponse } from 'next/server'
import { requirePaidTier } from '@/lib/supabase/require-paid-tier'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(request: Request) {
  const rateLimited = await checkRateLimit(request, { tier: 'general', isInvestigator: true })
  if (rateLimited) return rateLimited

  const result = await requirePaidTier()
  if (result instanceof NextResponse) return result
  const { user, supabase } = result

  const { data: notes, error } = await supabase
    .from('investigator_notes')
    .select('id, title, content, entity_ids, is_pinned, created_at, updated_at')
    .eq('user_id', user.id)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ notes })
}

export async function POST(request: Request) {
  const rateLimited = await checkRateLimit(request, { tier: 'general', isInvestigator: true })
  if (rateLimited) return rateLimited

  const result = await requirePaidTier()
  if (result instanceof NextResponse) return result
  const { user, supabase } = result

  const body = await request.json()
  const title = (body.title as string ?? '').trim()
  const content = (body.content as string) ?? ''
  const entityIds = (body.entity_ids as string[]) ?? []

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const { data: note, error } = await supabase
    .from('investigator_notes')
    .insert({
      user_id: user.id,
      title,
      content,
      entity_ids: entityIds,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ note }, { status: 201 })
}
