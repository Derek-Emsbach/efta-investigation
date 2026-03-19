import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50))

    // Stats: queue status counts + document-level needs_review count
    const [queueStatsResult, needsReviewResult] = await Promise.all([
      supabase.rpc('processing_queue_stats'),
      supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('processing_status', 'needs_review'),
    ])

    if (queueStatsResult.error) {
      throw new Error(`Failed to fetch stats: ${queueStatsResult.error.message}`)
    }

    const rawStats = (queueStatsResult.data as Record<string, number>) ?? {}
    const stats = {
      queued: rawStats.queued ?? 0,
      processing: rawStats.processing ?? 0,
      completed: rawStats.completed ?? 0,
      failed: rawStats.failed ?? 0,
      needs_review: needsReviewResult.count ?? 0,
      total: Object.values(rawStats).reduce((s, n) => s + n, 0),
    }

    // Data query — paginated with optional filter
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
      `, { count: 'exact' })
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    // Optional dataset filter (filters through the joined documents relation)
    const datasetId = searchParams.get('dataset_id')
    if (datasetId) {
      // Two-step: get document IDs for this dataset, then filter queue items
      const { data: dsDocIds } = await supabase
        .from('documents')
        .select('id')
        .eq('dataset_id', datasetId)
        .limit(10000)
      if (dsDocIds && dsDocIds.length > 0) {
        query = query.in('document_id', dsDocIds.map((d) => d.id))
      } else {
        return NextResponse.json({ items: [], stats, page, limit, totalCount: 0 })
      }
    }

    const rangeStart = (page - 1) * limit
    const rangeEnd = page * limit - 1
    const { data, error, count } = await query.range(rangeStart, rangeEnd)

    if (error) {
      throw new Error(`Failed to fetch processing queue: ${error.message}`)
    }

    return NextResponse.json({
      items: data ?? [],
      stats,
      page,
      limit,
      totalCount: count ?? 0,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
