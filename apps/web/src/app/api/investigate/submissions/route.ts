import { NextResponse } from 'next/server'
import { requireInvestigator } from '@/lib/supabase/require-investigator'
import { checkRateLimit } from '@/lib/rate-limit'

const VALID_TYPES = new Set(['finding', 'connection', 'entity', 'correction'])

export async function GET(request: Request) {
  const rateLimited = await checkRateLimit(request, {
    tier: 'general',
    isInvestigator: true,
  })
  if (rateLimited) return rateLimited

  const result = await requireInvestigator()
  if (result instanceof NextResponse) return result
  const { user, supabase } = result

  const url = new URL(request.url)
  const status = url.searchParams.get('status')

  let query = supabase
    .from('user_submissions')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data: submissions, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ submissions })
}

export async function POST(request: Request) {
  const rateLimited = await checkRateLimit(request, {
    tier: 'general',
    isInvestigator: true,
  })
  if (rateLimited) return rateLimited

  const result = await requireInvestigator()
  if (result instanceof NextResponse) return result
  const { user, supabase } = result

  const body = await request.json()

  // Validate required fields
  if (!body.submission_type || !VALID_TYPES.has(body.submission_type)) {
    return NextResponse.json(
      { error: 'Invalid submission_type. Must be: finding, connection, entity, or correction' },
      { status: 400 },
    )
  }

  if (!body.title?.trim()) {
    return NextResponse.json(
      { error: 'Title is required' },
      { status: 400 },
    )
  }

  if (!body.body?.trim()) {
    return NextResponse.json(
      { error: 'Body is required' },
      { status: 400 },
    )
  }

  const { data: submission, error } = await supabase
    .from('user_submissions')
    .insert({
      user_id: user.id,
      submission_type: body.submission_type,
      title: body.title.trim(),
      body: body.body.trim(),
      evidence_urls: Array.isArray(body.evidence_urls) ? body.evidence_urls : [],
      entity_ids: Array.isArray(body.entity_ids) ? body.entity_ids : [],
      status: 'draft',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ submission }, { status: 201 })
}
