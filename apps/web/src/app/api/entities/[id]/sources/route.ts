import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('external_sources')
      .select('*')
      .eq('entity_id', id)
      .order('retrieved_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch sources: ${error.message}`)
    }

    return NextResponse.json({ data: data ?? [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
