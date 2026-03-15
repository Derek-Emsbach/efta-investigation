import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/admin/ml/anomalies
 *
 * List ML-detected anomalies with optional filters.
 * Query params: severity, type, status, limit, offset
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl

  const severity = searchParams.get('severity')
  const type = searchParams.get('type')
  const status = searchParams.get('status') || 'pending'
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
  const offset = parseInt(searchParams.get('offset') || '0')

  let query = supabase
    .from('ml_anomalies')
    .select('*', { count: 'exact' })
    .order('score', { ascending: false })

  if (severity) query = query.eq('severity', severity)
  if (type) query = query.eq('anomaly_type', type)
  if (status !== 'all') query = query.eq('review_status', status)

  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * PATCH /api/admin/ml/anomalies
 *
 * Update anomaly review status.
 * Body: { id: string, review_status: string, review_notes?: string }
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()

  const { id, review_status, review_notes } = body

  if (!id || !review_status) {
    return NextResponse.json(
      { error: 'id and review_status are required' },
      { status: 400 }
    )
  }

  const updateData: Record<string, unknown> = {
    review_status,
    reviewed_at: new Date().toISOString(),
  }
  if (review_notes !== undefined) {
    updateData.review_notes = review_notes
  }

  const { data, error } = await supabase
    .from('ml_anomalies')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
