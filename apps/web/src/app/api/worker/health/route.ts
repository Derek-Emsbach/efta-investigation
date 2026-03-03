import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export type WorkerStatus = 'healthy' | 'degraded' | 'offline' | 'idle'

export interface WorkerHealthData {
  status: WorkerStatus
  lastActivity: string | null
  lastCompletedAt: string | null
  lastStartedAt: string | null
  stuckItems: number
  throughputLastHour: number
  failRateLastHour: number
  averageProcessingMinutes: number | null
  currentlyProcessing: {
    batesNumber: string | null
    step: string | null
    startedAt: string | null
    minutesElapsed: number | null
  } | null
}

/**
 * GET /api/worker/health
 *
 * Infers worker health from processing_queue activity:
 * - healthy: completed or started items in last 15 min
 * - degraded: no activity in 15-60 min with queued items, or items stuck > 30 min
 * - offline: no activity in 60+ min with queued items
 * - idle: nothing in queue, worker has nothing to do
 */
export async function GET() {
  const supabase = await createClient()

  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString()

  const [
    lastCompletedResult,
    lastStartedResult,
    stuckResult,
    completedLastHourResult,
    failedLastHourResult,
    avgDurationResult,
    currentlyProcessingResult,
    queuedCountResult,
  ] = await Promise.all([
    // Most recent completed item
    supabase
      .from('processing_queue')
      .select('completed_at')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),

    // Most recent started item
    supabase
      .from('processing_queue')
      .select('started_at')
      .order('started_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),

    // Items stuck in "processing" for > 30 min
    supabase
      .from('processing_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing')
      .lt('started_at', new Date(now.getTime() - 30 * 60 * 1000).toISOString()),

    // Completed in last hour
    supabase
      .from('processing_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_at', oneHourAgo),

    // Failed in last hour
    supabase
      .from('processing_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('completed_at', oneHourAgo),

    // Average processing time (last 20 completed)
    supabase
      .from('processing_queue')
      .select('started_at, completed_at')
      .eq('status', 'completed')
      .not('started_at', 'is', null)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(20),

    // Currently processing
    supabase
      .from('processing_queue')
      .select('current_step, started_at, documents(bates_number)')
      .eq('status', 'processing')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Queued items waiting
    supabase
      .from('processing_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued'),
  ])

  const lastCompletedAt = (lastCompletedResult.data as { completed_at: string } | null)?.completed_at ?? null
  const lastStartedAt = (lastStartedResult.data as { started_at: string } | null)?.started_at ?? null
  const stuckItems = stuckResult.count ?? 0
  const completedLastHour = completedLastHourResult.count ?? 0
  const failedLastHour = failedLastHourResult.count ?? 0
  const queuedCount = queuedCountResult.count ?? 0

  // Calculate average processing duration in minutes
  let averageProcessingMinutes: number | null = null
  if (avgDurationResult.data && avgDurationResult.data.length > 0) {
    const durations = (avgDurationResult.data as { started_at: string; completed_at: string }[])
      .map((r) => (new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()) / 60_000)
      .filter((d) => d > 0 && d < 120) // exclude outliers (> 2 hours)
    if (durations.length > 0) {
      averageProcessingMinutes = Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
    }
  }

  // Currently processing details
  const currentDoc = currentlyProcessingResult.data as {
    current_step: string | null
    started_at: string | null
    documents: { bates_number: string } | null
  } | null

  let currentlyProcessing: WorkerHealthData['currentlyProcessing'] = null
  if (currentDoc) {
    const elapsed = currentDoc.started_at
      ? Math.round((now.getTime() - new Date(currentDoc.started_at).getTime()) / 60_000)
      : null
    currentlyProcessing = {
      batesNumber: currentDoc.documents?.bates_number ?? null,
      step: currentDoc.current_step,
      startedAt: currentDoc.started_at,
      minutesElapsed: elapsed,
    }
  }

  // Determine last activity timestamp
  const lastActivity = [lastCompletedAt, lastStartedAt]
    .filter(Boolean)
    .sort()
    .reverse()[0] ?? null

  // Determine overall status
  const totalLastHour = completedLastHour + failedLastHour
  const failRate = totalLastHour > 0 ? failedLastHour / totalLastHour : 0

  let status: WorkerStatus = 'idle'

  if (queuedCount === 0 && !currentlyProcessing && stuckItems === 0) {
    // Nothing to do
    status = 'idle'
  } else if (stuckItems > 0) {
    // Items stuck in processing — worker likely crashed
    status = 'offline'
  } else if (lastActivity && lastActivity >= fifteenMinAgo) {
    // Recent activity
    status = failRate > 0.5 ? 'degraded' : 'healthy'
  } else if (lastActivity && lastActivity >= oneHourAgo) {
    // Activity in last hour but not last 15 min
    status = 'degraded'
  } else if (queuedCount > 0 || currentlyProcessing) {
    // Items waiting but no recent activity
    status = 'offline'
  }

  const health: WorkerHealthData = {
    status,
    lastActivity,
    lastCompletedAt,
    lastStartedAt,
    stuckItems,
    throughputLastHour: completedLastHour,
    failRateLastHour: Math.round(failRate * 100),
    averageProcessingMinutes,
    currentlyProcessing,
  }

  return NextResponse.json(health)
}
