import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/admin/ml/crossref
 *
 * Get scored document cross-references.
 * Query params: document_id (required), min_score, limit
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl

  const documentId = searchParams.get('document_id')
  const minScore = parseInt(searchParams.get('min_score') || '30')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

  if (!documentId) {
    return NextResponse.json(
      { error: 'document_id is required' },
      { status: 400 }
    )
  }

  // Search both document_a and document_b columns
  const [resA, resB] = await Promise.all([
    supabase
      .from('ml_crossref_scores')
      .select('*')
      .eq('document_a', documentId)
      .gte('score', minScore)
      .order('score', { ascending: false })
      .limit(limit),
    supabase
      .from('ml_crossref_scores')
      .select('*')
      .eq('document_b', documentId)
      .gte('score', minScore)
      .order('score', { ascending: false })
      .limit(limit),
  ])

  const allScores = [...(resA.data || []), ...(resB.data || [])]

  // Deduplicate and sort
  const seen = new Set<string>()
  const unique = allScores.filter(s => {
    const key = [s.document_a, s.document_b].sort().join(':')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  unique.sort((a, b) => b.score - a.score)

  // Resolve document info for related docs
  const relatedDocIds = new Set<string>()
  for (const s of unique) {
    const otherId = s.document_a === documentId ? s.document_b : s.document_a
    relatedDocIds.add(otherId)
  }

  let docMap = new Map<string, Record<string, unknown>>()
  if (relatedDocIds.size > 0) {
    const { data: docs } = await supabase
      .from('documents')
      .select('id, bates_number, title, document_type, original_date')
      .in('id', Array.from(relatedDocIds))

    docMap = new Map(docs?.map(d => [d.id, d]) || [])
  }

  const enriched = unique.map(s => {
    const otherId = s.document_a === documentId ? s.document_b : s.document_a
    return {
      ...s,
      related_document: docMap.get(otherId) || null,
    }
  })

  return NextResponse.json({ data: enriched.slice(0, limit) })
}
