import { NextResponse } from 'next/server'
import { requirePaidTier } from '@/lib/supabase/require-paid-tier'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const rateLimited = await checkRateLimit(request, { tier: 'general', isInvestigator: true })
  if (rateLimited) return rateLimited

  const { id } = await props.params

  const result = await requirePaidTier()
  if (result instanceof NextResponse) return result
  const { user, supabase } = result

  const { data: note, error } = await supabase
    .from('investigator_notes')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }

  return NextResponse.json({ note })
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const rateLimited = await checkRateLimit(request, { tier: 'general', isInvestigator: true })
  if (rateLimited) return rateLimited

  const { id } = await props.params

  const result = await requirePaidTier()
  if (result instanceof NextResponse) return result
  const { user, supabase } = result

  const body = await request.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof body.title === 'string') updates.title = body.title.trim()
  if (typeof body.content === 'string') updates.content = body.content
  if (Array.isArray(body.entity_ids)) updates.entity_ids = body.entity_ids
  if (typeof body.is_pinned === 'boolean') updates.is_pinned = body.is_pinned

  const { data: note, error } = await supabase
    .from('investigator_notes')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error || !note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }

  return NextResponse.json({ note })
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const rateLimited = await checkRateLimit(request, { tier: 'general', isInvestigator: true })
  if (rateLimited) return rateLimited

  const { id } = await props.params

  const result = await requirePaidTier()
  if (result instanceof NextResponse) return result
  const { user, supabase } = result

  const { error } = await supabase
    .from('investigator_notes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
