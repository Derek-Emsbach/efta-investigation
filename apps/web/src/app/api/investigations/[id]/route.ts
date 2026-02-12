import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Fetch investigation with all relations in parallel
    const [invResult, entitiesResult, docsResult, eventsResult, notesResult] =
      await Promise.all([
        supabase
          .from('investigations')
          .select('*')
          .eq('id', id)
          .single(),
        supabase
          .from('entity_investigations')
          .select('*, entities(id, name, entity_type, tier, category, is_public)')
          .eq('investigation_id', id),
        supabase
          .from('investigation_documents')
          .select(
            '*, documents(id, bates_number, title, document_type, severity, original_date, classification)'
          )
          .eq('investigation_id', id)
          .order('added_at', { ascending: false }),
        supabase
          .from('investigation_events')
          .select('*, events(id, title, date, event_type, description, significance)')
          .eq('investigation_id', id)
          .order('added_at', { ascending: false }),
        supabase
          .from('investigation_notes')
          .select('*')
          .eq('investigation_id', id)
          .order('created_at', { ascending: false }),
      ])

    if (invResult.error) throw invResult.error
    if (!invResult.data) {
      return NextResponse.json(
        { error: 'Investigation not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      investigation: invResult.data,
      entities: entitiesResult.data ?? [],
      documents: docsResult.data ?? [],
      events: eventsResult.data ?? [],
      notes: notesResult.data ?? [],
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.name !== undefined) updates.name = body.name
    if (body.summary !== undefined) updates.summary = body.summary
    if (body.status !== undefined) updates.status = body.status
    if (body.open_questions !== undefined)
      updates.open_questions = body.open_questions

    const { data, error } = await supabase
      .from('investigations')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ investigation: data })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { error } = await supabase
      .from('investigations')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
