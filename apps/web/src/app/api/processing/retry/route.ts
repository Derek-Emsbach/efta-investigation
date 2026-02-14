import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

/**
 * POST /api/processing/retry
 *
 * Retry failed queue items by resetting them to 'queued'.
 * Accepts either specific IDs or retries all failed items.
 * Admin only.
 *
 * Body: { ids?: string[] }  (omit ids to retry all failed)
 */
export async function POST(request: Request) {
  try {
    const result = await requireAdmin()
    if (result instanceof NextResponse) return result
    const { supabase } = result

    const body = await request.json().catch(() => ({}))
    const ids: string[] | undefined = Array.isArray(body.ids) ? body.ids : undefined

    // Build query to find failed items
    let query = supabase
      .from('processing_queue')
      .select('id, document_id')
      .eq('status', 'failed')

    if (ids && ids.length > 0) {
      query = query.in('id', ids)
    }

    const { data: failedItems, error: fetchError } = await query

    if (fetchError) {
      throw new Error(`Failed to fetch items: ${fetchError.message}`)
    }

    if (!failedItems || failedItems.length === 0) {
      return NextResponse.json({ message: 'No failed items to retry', count: 0 })
    }

    const queueIds = failedItems.map((item) => item.id)
    const documentIds = [...new Set(failedItems.map((item) => item.document_id))]

    // Reset queue items to queued
    const { error: updateError } = await supabase
      .from('processing_queue')
      .update({
        status: 'queued',
        error_message: null,
        current_step: null,
        started_at: null,
        completed_at: null,
      })
      .in('id', queueIds)

    if (updateError) {
      throw new Error(`Failed to update queue items: ${updateError.message}`)
    }

    // Reset corresponding documents to queued
    await supabase
      .from('documents')
      .update({ processing_status: 'queued' })
      .in('id', documentIds)

    return NextResponse.json({
      message: `Retrying ${failedItems.length} item(s)`,
      count: failedItems.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
