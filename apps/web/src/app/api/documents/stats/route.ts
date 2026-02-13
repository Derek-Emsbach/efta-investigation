import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Single RPC call replaces 3 full table scans + 2 counts
    const { data, error } = await supabase.rpc('document_severity_stats')

    if (error) {
      throw new Error(`Failed to fetch document stats: ${error.message}`)
    }

    // RPC returns the exact shape the frontend expects
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
