import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import type { ImageEntityRole, TagConfidence } from '@efta/shared'

type RouteContext = { params: Promise<{ id: string }> }

/** GET — list entities linked to this image (with entity name + tier) */
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('image_entities')
      .select('id, entity_id, role, confidence, created_at, entities:entity_id(id, name, tier)')
      .eq('image_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch image entities: ${error.message}`)
    }

    return NextResponse.json(data ?? [])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** POST — link an entity to this image */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin
    const { supabase } = admin

    const { id } = await params
    const body = await request.json()
    const { entity_id, role, confidence } = body as {
      entity_id: string
      role?: ImageEntityRole
      confidence?: TagConfidence
    }

    if (!entity_id) {
      return NextResponse.json({ error: 'entity_id is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('image_entities')
      .insert({
        image_id: id,
        entity_id,
        role: role ?? null,
        confidence: confidence ?? 'confirmed',
      })
      .select('id, entity_id, role, confidence, created_at, entities:entity_id(id, name, tier)')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Entity already linked to this image' }, { status: 409 })
      }
      throw new Error(`Failed to link entity: ${error.message}`)
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** DELETE — unlink an entity from this image */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin
    const { supabase } = admin

    const { id } = await params
    const body = await request.json()
    const { entity_id } = body as { entity_id: string }

    if (!entity_id) {
      return NextResponse.json({ error: 'entity_id is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('image_entities')
      .delete()
      .eq('image_id', id)
      .eq('entity_id', entity_id)

    if (error) {
      throw new Error(`Failed to unlink entity: ${error.message}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
