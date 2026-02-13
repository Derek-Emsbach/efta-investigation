import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Run parallel queries for tier breakdowns
    const [tierCounts, categoryCounts, typeCounts, statusCounts, totalResult] = await Promise.all([
      // Count by tier
      supabase
        .from('entities')
        .select('tier')
        .not('tier', 'is', null),
      // Count by category (with tier)
      supabase
        .from('entities')
        .select('tier, category')
        .not('tier', 'is', null),
      // Count by type (with tier)
      supabase
        .from('entities')
        .select('tier, entity_type')
        .not('tier', 'is', null),
      // Count by status (with tier)
      supabase
        .from('entities')
        .select('tier, status')
        .not('tier', 'is', null),
      // Total count
      supabase
        .from('entities')
        .select('*', { count: 'exact', head: true }),
    ])

    // Build tier breakdown
    const tiers: Record<number, {
      total: number
      byCategory: Record<string, number>
      byType: Record<string, number>
      byStatus: Record<string, number>
    }> = {}

    // Initialize tiers 1-6
    for (let t = 1; t <= 6; t++) {
      tiers[t] = { total: 0, byCategory: {}, byType: {}, byStatus: {} }
    }

    // Count totals per tier
    if (tierCounts.data) {
      for (const row of tierCounts.data) {
        const t = row.tier as number
        if (t >= 1 && t <= 6) tiers[t].total++
      }
    }

    // Category breakdown per tier
    if (categoryCounts.data) {
      for (const row of categoryCounts.data) {
        const t = row.tier as number
        const cat = row.category as string
        if (t >= 1 && t <= 6 && cat) {
          tiers[t].byCategory[cat] = (tiers[t].byCategory[cat] ?? 0) + 1
        }
      }
    }

    // Type breakdown per tier
    if (typeCounts.data) {
      for (const row of typeCounts.data) {
        const t = row.tier as number
        const typ = row.entity_type as string
        if (t >= 1 && t <= 6 && typ) {
          tiers[t].byType[typ] = (tiers[t].byType[typ] ?? 0) + 1
        }
      }
    }

    // Status breakdown per tier
    if (statusCounts.data) {
      for (const row of statusCounts.data) {
        const t = row.tier as number
        const status = row.status as string
        if (t >= 1 && t <= 6 && status) {
          tiers[t].byStatus[status] = (tiers[t].byStatus[status] ?? 0) + 1
        }
      }
    }

    return NextResponse.json({
      tiers,
      total: totalResult.count ?? 0,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
