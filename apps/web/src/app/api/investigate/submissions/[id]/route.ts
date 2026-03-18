import { NextResponse } from 'next/server'
import { requireInvestigator } from '@/lib/supabase/require-investigator'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const rateLimited = await checkRateLimit(request, {
    tier: 'general',
    isInvestigator: true,
  })
  if (rateLimited) return rateLimited

  const { id } = await props.params

  const result = await requireInvestigator()
  if (result instanceof NextResponse) return result
  const { user, supabase } = result

  const { data: submission, error } = await supabase
    .from('user_submissions')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
  }

  return NextResponse.json({ submission })
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const rateLimited = await checkRateLimit(request, {
    tier: 'general',
    isInvestigator: true,
  })
  if (rateLimited) return rateLimited

  const { id } = await props.params

  const result = await requireInvestigator()
  if (result instanceof NextResponse) return result
  const { user, supabase } = result

  // Fetch existing to check ownership and status
  const { data: existing } = await supabase
    .from('user_submissions')
    .select('status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
  }

  // Can only edit drafts
  if (existing.status !== 'draft') {
    return NextResponse.json(
      { error: 'Only draft submissions can be edited' },
      { status: 400 },
    )
  }

  const body = await request.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof body.title === 'string') updates.title = body.title.trim()
  if (typeof body.body === 'string') updates.body = body.body.trim()
  if (Array.isArray(body.evidence_urls)) updates.evidence_urls = body.evidence_urls
  if (Array.isArray(body.entity_ids)) updates.entity_ids = body.entity_ids

  // Allow submitting a draft
  if (body.status === 'submitted' && existing.status === 'draft') {
    updates.status = 'submitted'
  }

  const { data: submission, error } = await supabase
    .from('user_submissions')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error || !submission) {
    return NextResponse.json({ error: 'Failed to update submission' }, { status: 500 })
  }

  return NextResponse.json({ submission })
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const rateLimited = await checkRateLimit(request, {
    tier: 'general',
    isInvestigator: true,
  })
  if (rateLimited) return rateLimited

  const { id } = await props.params

  const result = await requireInvestigator()
  if (result instanceof NextResponse) return result
  const { user, supabase } = result

  // Only allow deleting drafts
  const { data: existing } = await supabase
    .from('user_submissions')
    .select('status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
  }

  if (existing.status !== 'draft') {
    return NextResponse.json(
      { error: 'Only draft submissions can be deleted' },
      { status: 400 },
    )
  }

  const { error } = await supabase
    .from('user_submissions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
