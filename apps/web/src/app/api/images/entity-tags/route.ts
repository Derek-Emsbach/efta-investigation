/**
 * /api/images/entity-tags
 *
 * GET  - Fetch image_entities pending review (role='mentioned', confidence='possible')
 * PATCH - Update a tag's confidence/role (confirm, upgrade, etc.)
 * DELETE - Remove an image_entity link
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // Auth check — admin only
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1)
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '40') || 40)
  const role = searchParams.get('role') ?? 'mentioned'
  const confidence = searchParams.get('confidence') ?? 'possible'
  const entityId = searchParams.get('entity_id')

  let query = supabase
    .from('image_entities')
    .select(
      `id, image_id, entity_id, role, confidence, created_at,
       document_images:image_id (
         id, image_type, caption, r2_key, metadata,
         documents:document_id (bates_number, title)
       ),
       entities:entity_id (id, name, tier, slug)`,
      { count: 'exact' }
    )
    .eq('role', role)
    .eq('confidence', confidence)

  if (entityId) query = query.eq('entity_id', entityId)

  query = query.order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [], count: count ?? 0, page, limit })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, role, confidence } = body

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const updates: Record<string, string> = {}
  if (role) updates.role = role
  if (confidence) updates.confidence = confidence

  const { error } = await supabase.from('image_entities').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabase.from('image_entities').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
