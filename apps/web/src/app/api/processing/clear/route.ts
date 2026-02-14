import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

/**
 * POST /api/processing/clear
 *
 * Delete completed queue items. Accepts specific IDs or clears all completed.
 * Admin only.
 *
 * Body: { ids?: string[] }  (omit ids to clear all completed)
 */
export async function POST(request: Request) {
  try {
    const result = await requireAdmin()
    if (result instanceof NextResponse) return result
    const { supabase } = result

    const body = await request.json().catch(() => ({}))
    const ids: string[] | undefined = Array.isArray(body.ids) ? body.ids : undefined

    // Count items first
    let countQuery = supabase
      .from('processing_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')

    if (ids && ids.length > 0) {
      countQuery = countQuery.in('id', ids)
    }

    const { count } = await countQuery

    if (!count || count === 0) {
      return NextResponse.json({ message: 'No completed items to clear', count: 0 })
    }

    // Delete
    let deleteQuery = supabase
      .from('processing_queue')
      .delete()
      .eq('status', 'completed')

    if (ids && ids.length > 0) {
      deleteQuery = deleteQuery.in('id', ids)
    }

    const { error: deleteError } = await deleteQuery

    if (deleteError) {
      throw new Error(`Failed to clear items: ${deleteError.message}`)
    }

    return NextResponse.json({
      message: `Cleared ${count} completed item(s)`,
      count,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
