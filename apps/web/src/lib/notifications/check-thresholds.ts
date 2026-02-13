import type { SupabaseClient } from '@supabase/supabase-js'

/** Run all threshold checks and create alerts as needed. */
export async function checkThresholds(supabase: SupabaseClient) {
  const results: string[] = []

  // 1. Token usage in last 24 hours
  const twentyFourHoursAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  ).toISOString()

  const { data: recentUsage } = await supabase
    .from('api_usage_log')
    .select('total_tokens')
    .gte('created_at', twentyFourHoursAgo)

  const totalTokens24h =
    recentUsage?.reduce((sum, row) => sum + (row.total_tokens ?? 0), 0) ?? 0

  if (totalTokens24h > 500_000) {
    const severity = totalTokens24h > 1_000_000 ? 'critical' : 'warning'
    await createAlertIfNew(supabase, {
      alert_type: 'token_usage_high',
      severity,
      title: 'High API Token Usage',
      message: `${totalTokens24h.toLocaleString()} tokens used in the last 24 hours. Estimated cost: $${estimateCost(totalTokens24h).toFixed(2)}`,
      action_url: '/admin',
      metadata: { totalTokens24h },
    })
    results.push(`Token usage alert: ${totalTokens24h.toLocaleString()} tokens`)
  }

  // 2. Processing queue backlog
  const { count: queuedCount } = await supabase
    .from('processing_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')

  if (queuedCount && queuedCount > 100) {
    await createAlertIfNew(supabase, {
      alert_type: 'processing_backlog',
      severity: queuedCount > 500 ? 'warning' : 'info',
      title: 'Processing Queue Backlog',
      message: `${queuedCount} documents queued for processing.`,
      action_url: '/processing',
      metadata: { queuedCount },
    })
    results.push(`Processing backlog: ${queuedCount} queued`)
  }

  // 3. Failed processing jobs
  const { count: failedCount } = await supabase
    .from('processing_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed')

  if (failedCount && failedCount > 0) {
    await createAlertIfNew(supabase, {
      alert_type: 'worker_failure',
      severity: failedCount > 10 ? 'warning' : 'info',
      title: 'Failed Processing Jobs',
      message: `${failedCount} documents failed processing and may need investigation.`,
      action_url: '/processing',
      metadata: { failedCount },
    })
    results.push(`Worker failures: ${failedCount}`)
  }

  // 4. Database size check (rough estimate from document count)
  const { count: docCount } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })

  if (docCount && docCount > 8000) {
    await createAlertIfNew(supabase, {
      alert_type: 'database_warning',
      severity: docCount > 15000 ? 'critical' : 'warning',
      title: 'Database Growing Large',
      message: `${docCount.toLocaleString()} documents in database. Consider checking your Supabase plan limits.`,
      action_url: '/admin',
      metadata: { docCount },
    })
    results.push(`Database size warning: ${docCount} documents`)
  }

  return results.length > 0
    ? results
    : ['All checks passed — no alerts generated']
}

/** Estimate API cost from total tokens (rough Sonnet 4.5 pricing). */
function estimateCost(totalTokens: number): number {
  // Rough average: input tokens + output tokens, weighted
  // ~60% input at $3/M + ~30% output at $15/M + ~10% cache at $0.30/M
  return totalTokens * 0.000006
}

/** Only create an alert if there isn't already an active (undismissed) alert of the same type. */
async function createAlertIfNew(
  supabase: SupabaseClient,
  alert: {
    alert_type: string
    severity: string
    title: string
    message: string
    action_url?: string
    metadata?: Record<string, unknown>
  },
) {
  // Check for existing active alert of same type in last 24h
  const twentyFourHoursAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  ).toISOString()

  const { data: existing } = await supabase
    .from('notification_alerts')
    .select('id')
    .eq('alert_type', alert.alert_type)
    .eq('dismissed', false)
    .gte('created_at', twentyFourHoursAgo)
    .limit(1)

  if (existing && existing.length > 0) return

  await supabase.from('notification_alerts').insert({
    alert_type: alert.alert_type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    action_url: alert.action_url ?? null,
    metadata: alert.metadata ?? {},
  })
}
