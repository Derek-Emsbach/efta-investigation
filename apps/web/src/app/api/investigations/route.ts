import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = request.nextUrl
    const status = searchParams.get('status')

    let query = supabase
      .from('investigations')
      .select(
        `*, entity_investigations(count), investigation_documents(count), investigation_events(count), investigation_notes(count)`
      )
      .order('updated_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error

    const investigations = (data ?? []).map((inv) => ({
      ...inv,
      entity_count:
        (inv.entity_investigations as unknown as { count: number }[])?.[0]
          ?.count ?? 0,
      document_count:
        (inv.investigation_documents as unknown as { count: number }[])?.[0]
          ?.count ?? 0,
      event_count:
        (inv.investigation_events as unknown as { count: number }[])?.[0]
          ?.count ?? 0,
      note_count:
        (inv.investigation_notes as unknown as { count: number }[])?.[0]
          ?.count ?? 0,
    }))

    return NextResponse.json({ investigations })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { data, error } = await supabase
      .from('investigations')
      .insert({
        name: body.name,
        summary: body.summary ?? null,
        status: body.status ?? 'active',
        open_questions: body.open_questions ?? [],
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ investigation: data }, { status: 201 })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
