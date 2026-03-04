import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Dataset, Tier } from '@efta/shared'

const TIERS: Tier[] = [1, 2, 3, 4, 5, 6]

export async function GET() {
  try {
    const supabase = await createClient()

    // Run all queries in parallel
    // - Documents: use RPCs (instant, no table scan on 1.37M rows)
    // - Entities/events: small tables, COUNT(*) is fine
    const [
      entitiesResult,
      estimatedDocCountResult,
      severityStatsResult,
      eventsResult,
      datasetsResult,
      ...tierResults
    ] = await Promise.all([
      // Total entity count (small table)
      supabase.from('entities').select('*', { count: 'exact', head: true }),

      // Total document count via RPC (reads pg_class.reltuples — instant)
      supabase.rpc('estimated_document_count'),

      // Severity breakdown via RPC (single aggregation query)
      supabase.rpc('document_severity_stats'),

      // Total event count (small table)
      supabase.from('events').select('*', { count: 'exact', head: true }),

      // All datasets
      supabase.from('datasets').select('*').order('number', { ascending: true }),

      // Tier counts (6 queries on small entities table)
      ...TIERS.map((tier) =>
        supabase.from('entities').select('*', { count: 'exact', head: true }).eq('tier', tier)
      ),
    ])

    // Check for critical errors
    if (entitiesResult.error) {
      throw new Error(`Failed to count entities: ${entitiesResult.error.message}`)
    }
    if (estimatedDocCountResult.error) {
      throw new Error(`Failed to get document count: ${estimatedDocCountResult.error.message}`)
    }
    if (eventsResult.error) {
      throw new Error(`Failed to count events: ${eventsResult.error.message}`)
    }
    if (datasetsResult.error) {
      throw new Error(`Failed to fetch datasets: ${datasetsResult.error.message}`)
    }

    // Build tier counts
    const tierCounts: Record<number, number> = {}
    for (let i = 0; i < TIERS.length; i++) {
      const result = tierResults[i]
      if (result.error) {
        throw new Error(`Failed to count tier ${TIERS[i]}: ${result.error.message}`)
      }
      tierCounts[TIERS[i]] = result.count ?? 0
    }

    // Build severity counts from RPC result
    const severityCounts: Record<string, number> = {}
    if (severityStatsResult.error) {
      // Fallback: severity stats RPC failed, return zeros
      for (const level of ['extreme_critical', 'critical', 'high', 'routine']) {
        severityCounts[level] = 0
      }
    } else {
      // RPC returns array of { severity, count } rows
      const stats = severityStatsResult.data as Array<{ severity: string; count: number }>
      for (const row of stats) {
        severityCounts[row.severity] = row.count
      }
    }

    return NextResponse.json({
      totalEntities: entitiesResult.count ?? 0,
      totalDocuments: typeof estimatedDocCountResult.data === 'number' ? estimatedDocCountResult.data : 0,
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
