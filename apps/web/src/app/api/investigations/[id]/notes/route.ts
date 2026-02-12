import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('investigation_notes')
      .select('*')
      .eq('investigation_id', id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ notes: data ?? [] })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    const { data, error } = await supabase
      .from('investigation_notes')
      .insert({
        investigation_id: id,
        content: body.content,
        note_type: body.note_type ?? 'user_note',
        created_by: body.created_by ?? 'user',
        metadata: body.metadata ?? {},
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ note: data }, { status: 201 })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
