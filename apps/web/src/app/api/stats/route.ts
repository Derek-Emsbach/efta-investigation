import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Dataset, Severity, Tier } from '@efta/shared'

const TIERS: Tier[] = [1, 2, 3, 4, 5, 6]
const SEVERITY_LEVELS: Severity[] = ['extreme_critical', 'critical', 'high', 'routine']

export async function GET() {
  try {
    const supabase = await createClient()

    // Run all count queries in parallel
    const [
      entitiesResult,
      documentsResult,
      eventsResult,
      datasetsResult,
      ...tierAndSeverityResults
    ] = await Promise.all([
      // Total counts
      supabase.from('entities').select('*', { count: 'exact', head: true }),
      supabase.from('documents').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }),

      // All datasets
      supabase.from('datasets').select('*').order('number', { ascending: true }),

      // Tier counts (6 queries, one per tier)
      ...TIERS.map((tier) =>
        supabase.from('entities').select('*', { count: 'exact', head: true }).eq('tier', tier)
      ),

      // Severity counts (4 queries, one per level)
      ...SEVERITY_LEVELS.map((severity) =>
        supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('severity', severity)
      ),
    ])

    // Check for critical errors on the main counts
    if (entitiesResult.error) {
      throw new Error(`Failed to count entities: ${entitiesResult.error.message}`)
    }
    if (documentsResult.error) {
      throw new Error(`Failed to count documents: ${documentsResult.error.message}`)
    }
    if (eventsResult.error) {
      throw new Error(`Failed to count events: ${eventsResult.error.message}`)
    }
    if (datasetsResult.error) {
      throw new Error(`Failed to fetch datasets: ${datasetsResult.error.message}`)
    }

    // Build tier counts from parallel results
    const tierResults = tierAndSeverityResults.slice(0, TIERS.length)
    const severityResults = tierAndSeverityResults.slice(TIERS.length)

    const tierCounts: Record<number, number> = {}
    for (let i = 0; i < TIERS.length; i++) {
      const result = tierResults[i]
      if (result.error) {
        throw new Error(`Failed to count tier ${TIERS[i]}: ${result.error.message}`)
      }
      tierCounts[TIERS[i]] = result.count ?? 0
    }

    const severityCounts: Record<string, number> = {}
    for (let i = 0; i < SEVERITY_LEVELS.length; i++) {
      const result = severityResults[i]
      if (result.error) {
        throw new Error(`Failed to count severity ${SEVERITY_LEVELS[i]}: ${result.error.message}`)
      }
      severityCounts[SEVERITY_LEVELS[i]] = result.count ?? 0
    }

    return NextResponse.json({
      totalEntities: entitiesResult.count ?? 0,
      totalDocuments: documentsResult.count ?? 0,
      totalEvents: eventsResult.count ?? 0,
      tierCounts,
      severityCounts,
      datasets: datasetsResult.data as Dataset[],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
