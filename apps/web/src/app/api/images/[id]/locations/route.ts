import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import type { TagConfidence } from '@efta/shared'

type RouteContext = { params: Promise<{ id: string }> }

/** GET — list locations linked to this image (with location name + type + city) */
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('image_locations')
      .select('id, location_id, confidence, notes, created_at, locations:location_id(id, name, location_type, city)')
      .eq('image_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch image locations: ${error.message}`)
    }

    return NextResponse.json(data ?? [])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** POST — link a location to this image */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin
    const { supabase } = admin

    const { id } = await params
    const body = await request.json()
    const { location_id, confidence, notes } = body as {
      location_id: string
      confidence?: TagConfidence
      notes?: string
    }

    if (!location_id) {
      return NextResponse.json({ error: 'location_id is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('image_locations')
      .insert({
        image_id: id,
        location_id,
        confidence: confidence ?? 'confirmed',
        notes: notes ?? null,
      })
      .select('id, location_id, confidence, notes, created_at, locations:location_id(id, name, location_type, city)')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Location already linked to this image' }, { status: 409 })
      }
      throw new Error(`Failed to link location: ${error.message}`)
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** DELETE — unlink a location from this image */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin
    const { supabase } = admin

    const { id } = await params
    const body = await request.json()
    const { location_id } = body as { location_id: string }

    if (!location_id) {
      return NextResponse.json({ error: 'location_id is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('image_locations')
      .delete()
      .eq('image_id', id)
      .eq('location_id', location_id)

    if (error) {
      throw new Error(`Failed to unlink location: ${error.message}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
