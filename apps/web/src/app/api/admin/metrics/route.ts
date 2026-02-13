import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString()

  const [
    usageLogs,
    entities,
    documents,
    events,
    connections,
    evidence,
    redactions,
    queue,
    storageBytesResult,
  ] = await Promise.all([
    supabase
      .from('api_usage_log')
      .select(
        'created_at, endpoint, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, total_tokens, tool_iterations, duration_ms, error',
      )
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('entities').select('*', { count: 'exact', head: true }),
    supabase.from('documents').select('*', { count: 'exact', head: true }),
    supabase.from('events').select('*', { count: 'exact', head: true }),
    supabase
      .from('entity_connections')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('evidence_items')
      .select('*', { count: 'exact', head: true }),
    supabase.from('redactions').select('*', { count: 'exact', head: true }),
    supabase.from('processing_queue').select('*', { count: 'exact', head: true }),
    // RPC: SUM(file_size_bytes) server-side instead of fetching 1.3M rows
    supabase.rpc('document_storage_bytes'),
  ])

  const logs = usageLogs.data ?? []
  const totalTokens = logs.reduce((s, l) => s + (l.total_tokens ?? 0), 0)
  const totalRequests = logs.length

  // Estimate cost: blended rate ~$6/M tokens (mix of input/output/cache)
  const estimatedCost = totalTokens * 0.000006

  const totalStorageBytes = (storageBytesResult.data as number) ?? 0

  // Group usage by day for chart
  const dailyUsage: Record<
    string,
    { input: number; output: number; cache: number; requests: number }
  > = {}

  for (const log of logs) {
    const day = log.created_at.slice(0, 10)
    if (!dailyUsage[day]) {
      dailyUsage[day] = { input: 0, output: 0, cache: 0, requests: 0 }
    }
    dailyUsage[day].input += log.input_tokens ?? 0
    dailyUsage[day].output += log.output_tokens ?? 0
    dailyUsage[day].cache +=
      (log.cache_creation_tokens ?? 0) + (log.cache_read_tokens ?? 0)
    dailyUsage[day].requests += 1
  }

  return NextResponse.json({
    tokenUsage: {
      total: totalTokens,
      requests: totalRequests,
      estimatedCost: Number(estimatedCost.toFixed(2)),
      daily: Object.entries(dailyUsage)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    },
    databaseCounts: {
      entities: entities.count ?? 0,
      documents: documents.count ?? 0,
      events: events.count ?? 0,
      connections: connections.count ?? 0,
      evidence: evidence.count ?? 0,
      redactions: redactions.count ?? 0,
      processing_queue: queue.count ?? 0,
    },
    storage: {
      totalBytes: totalStorageBytes,
      totalGB: Number((totalStorageBytes / 1024 ** 3).toFixed(2)),
    },
    recentLogs: logs.slice(0, 50).map((l) => ({
      created_at: l.created_at,
      endpoint: l.endpoint,
      total_tokens: l.total_tokens,
      tool_iterations: l.tool_iterations,
      duration_ms: l.duration_ms,
      error: l.error,
    })),
  })
}
