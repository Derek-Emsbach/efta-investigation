import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')

    // Fetch queue items with joined document info
    let query = supabase
      .from('processing_queue')
      .select(`
        id,
        document_id,
        status,
        priority,
        current_step,
        error_message,
        started_at,
        completed_at,
        results,
        created_at,
        documents (
          id,
          bates_number,
          title,
          file_size_bytes,
          processing_status,
          dataset_id
        )
      `)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const { data, error } = await query.limit(200)

    if (error) {
      throw new Error(`Failed to fetch processing queue: ${error.message}`)
    }

    // Compute summary stats
    const items = data ?? []
    const stats = {
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      needs_review: 0,
      total: items.length,
    }

    for (const item of items) {
      const s = item.status as keyof typeof stats
      if (s in stats && s !== 'total') {
        stats[s]++
      }
    }

    return NextResponse.json({ items, stats })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
