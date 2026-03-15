import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/admin/ml/connections
 *
 * List ML-suggested connections with optional filters.
 * Query params: status, min_confidence, limit, offset
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl

  const status = searchParams.get('status') || 'pending'
  const minConfidence = parseInt(searchParams.get('min_confidence') || '0')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
  const offset = parseInt(searchParams.get('offset') || '0')

  let query = supabase
    .from('ml_connection_suggestions')
    .select('*', { count: 'exact' })
    .order('confidence', { ascending: false })

  if (status !== 'all') query = query.eq('status', status)
  if (minConfidence > 0) query = query.gte('confidence', minConfidence)

  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Resolve entity names
  if (data && data.length > 0) {
    const entityIds = new Set<string>()
    for (const row of data) {
      if (row.entity_a) entityIds.add(row.entity_a)
      if (row.entity_b) entityIds.add(row.entity_b)
    }

    const { data: entities } = await supabase
      .from('entities')
      .select('id, name, tier, entity_type')
      .in('id', Array.from(entityIds))

    const entityMap = new Map(entities?.map(e => [e.id, e]) || [])

    const enriched = data.map(row => ({
      ...row,
      entity_a_info: entityMap.get(row.entity_a) || null,
      entity_b_info: entityMap.get(row.entity_b) || null,
    }))

    return NextResponse.json({ data: enriched, total: count })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/admin/ml/connections
 *
 * Approve a connection suggestion — creates an entity_connections record.
 * Body: { suggestion_id: string }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()

  const { suggestion_id } = body

  if (!suggestion_id) {
    return NextResponse.json(
      { error: 'suggestion_id is required' },
      { status: 400 }
    )
  }

  // Get the suggestion
  const { data: suggestion, error: fetchErr } = await supabase
    .from('ml_connection_suggestions')
    .select('*')
    .eq('id', suggestion_id)
    .single()

  if (fetchErr || !suggestion) {
    return NextResponse.json(
      { error: 'Suggestion not found' },
      { status: 404 }
    )
  }

  // Map confidence to strength
  const confidence = suggestion.confidence || 50
  let strength: string
  if (confidence >= 80) strength = 'strong'
  else if (confidence >= 50) strength = 'moderate'
  else strength = 'weak'

  // Create the entity_connections record
  const { data: connection, error: insertErr } = await supabase
    .from('entity_connections')
    .insert({
      entity_a: suggestion.entity_a,
      entity_b: suggestion.entity_b,
      connection_type: suggestion.suggested_type || 'connected_to',
      strength,
      description: suggestion.evidence_summary || 'ML-suggested connection',
      metadata: {
        ml_suggestion_id: suggestion_id,
        ml_confidence: confidence,
        ml_score_components: suggestion.score_components,
      },
    })
    .select()
    .single()

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // Update suggestion status to merged
  await supabase
    .from('ml_connection_suggestions')
    .update({ status: 'merged' })
    .eq('id', suggestion_id)

  return NextResponse.json(connection)
}

/**
 * PATCH /api/admin/ml/connections
 *
 * Update suggestion status (reject, skip).
 * Body: { id: string, status: string, review_notes?: string }
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()

  const { id, status, review_notes } = body

  if (!id || !status) {
    return NextResponse.json(
      { error: 'id and status are required' },
      { status: 400 }
    )
  }

  const updateData: Record<string, unknown> = { status }
  if (review_notes !== undefined) {
    updateData.review_notes = review_notes
  }

  const { data, error } = await supabase
    .from('ml_connection_suggestions')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
