import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/admin/ml/runs
 *
 * List model training runs with metrics.
 * Query params: model_name, status, limit
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl

  const modelName = searchParams.get('model_name')
  const status = searchParams.get('status')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

  let query = supabase
    .from('ml_model_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (modelName) query = query.eq('model_name', modelName)
  if (status) query = query.eq('status', status)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
