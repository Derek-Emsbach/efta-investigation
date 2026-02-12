import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Link evidence (entity, document, or event) to an investigation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()
    const { type, target_id, role, relevance_notes } = body

    if (!type || !target_id) {
      return NextResponse.json(
        { error: 'type and target_id are required' },
        { status: 400 }
      )
    }

    let result

    switch (type) {
      case 'entity':
        result = await supabase
          .from('entity_investigations')
          .insert({
            entity_id: target_id,
            investigation_id: id,
            role: role ?? null,
          })
          .select()
          .single()
        break

      case 'document':
        result = await supabase
          .from('investigation_documents')
          .insert({
            document_id: target_id,
            investigation_id: id,
            relevance_notes: relevance_notes ?? null,
          })
          .select()
          .single()
        break

      case 'event':
        result = await supabase
          .from('investigation_events')
          .insert({
            event_id: target_id,
            investigation_id: id,
            relevance_notes: relevance_notes ?? null,
          })
          .select()
          .single()
        break

      default:
        return NextResponse.json(
          { error: 'type must be entity, document, or event' },
          { status: 400 }
        )
    }

    if (result.error) throw result.error

    return NextResponse.json({ link: result.data }, { status: 201 })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Unlink evidence from an investigation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { searchParams } = request.nextUrl
    const type = searchParams.get('type')
    const targetId = searchParams.get('target_id')

    if (!type || !targetId) {
      return NextResponse.json(
        { error: 'type and target_id query params are required' },
        { status: 400 }
      )
    }

    let result

    switch (type) {
      case 'entity':
        result = await supabase
          .from('entity_investigations')
          .delete()
          .eq('investigation_id', id)
          .eq('entity_id', targetId)
        break

      case 'document':
        result = await supabase
          .from('investigation_documents')
          .delete()
          .eq('investigation_id', id)
          .eq('document_id', targetId)
        break

      case 'event':
        result = await supabase
          .from('investigation_events')
          .delete()
          .eq('investigation_id', id)
          .eq('event_id', targetId)
        break

      default:
        return NextResponse.json(
          { error: 'type must be entity, document, or event' },
          { status: 400 }
        )
    }

    if (result.error) throw result.error

    return NextResponse.json({ success: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
