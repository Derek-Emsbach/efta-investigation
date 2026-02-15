import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('datasets')
      .select('id, number, name')
      .order('number', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch datasets: ${error.message}`)
    }

    return NextResponse.json({ data: data ?? [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
