import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const [
    pendingReviewResult,
    pendingBySeverityResult,
    failedQueueResult,
    suspectRedactionsResult,
    suspectByCategory,
    queuedResult,
    processingResult,
    completedResult,
    failedResult,
    currentlyProcessingResult,
  ] = await Promise.all([
    // Pending reviews total
    supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('processing_status', 'needs_review'),

    // Pending reviews by severity — RPC GROUP BY instead of fetching all rows
    supabase.rpc('count_documents_by', {
      p_group_col: 'severity',
      p_filter_col: 'processing_status',
      p_filter_val: 'needs_review',
    }),

    // Failed processing
    supabase
      .from('processing_queue')
      .select('error_message')
      .eq('status', 'failed')
      .order('completed_at', { ascending: false })
      .limit(5),

    // Suspect redactions total
    supabase
      .from('redactions')
      .select('*', { count: 'exact', head: true })
      .eq('is_suspect', true),

    // Suspect redactions by category
    supabase
      .from('redactions')
      .select('category')
      .eq('is_suspect', true),

    // Queue stats
    supabase
      .from('processing_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued'),
    supabase
      .from('processing_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing'),
    supabase
      .from('processing_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed'),
    supabase
      .from('processing_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed'),

    // Currently processing doc
    supabase
      .from('processing_queue')
      .select('document_id, current_step, documents(bates_number)')
      .eq('status', 'processing')
      .limit(1)
      .maybeSingle(),
  ])

  // RPC returns { "critical": N, "null": N, ... } — rename "null" key to "unassessed"
  const rawSeverity = (pendingBySeverityResult.data as Record<string, number>) ?? {}
  const bySeverity: Record<string, number> = {}
  for (const [key, count] of Object.entries(rawSeverity)) {
    bySeverity[key === 'null' ? 'unassessed' : key] = count
  }

  // Compute category breakdown for suspect redactions
  const byCategory: Record<string, number> = {}
  for (const row of suspectByCategory.data ?? []) {
    const cat = (row as { category: string | null }).category ?? 'unknown'
    byCategory[cat] = (byCategory[cat] ?? 0) + 1
  }

  // Extract unique error messages
  const errors = [
    ...new Set(
      (failedQueueResult.data ?? [])
        .map((r) => (r as { error_message: string | null }).error_message)
        .filter(Boolean) as string[]
    ),
  ].slice(0, 3)

  const currentDoc = currentlyProcessingResult.data as {
    document_id: string
    current_step: string | null
    documents: { bates_number: string } | null
  } | null

  return NextResponse.json({
    pendingReviews: {
      total: pendingReviewResult.count ?? 0,
      bySeverity,
    },
    failedProcessing: {
      total: failedResult.count ?? 0,
      errors,
    },
    suspectRedactions: {
      total: suspectRedactionsResult.count ?? 0,
      byCategory,
    },
    processingQueue: {
      queued: queuedResult.count ?? 0,
      processing: processingResult.count ?? 0,
      completed: completedResult.count ?? 0,
      failed: failedResult.count ?? 0,
      currentDoc: currentDoc?.documents?.bates_number ?? null,
      currentStep: currentDoc?.current_step ?? null,
    },
  })
}
