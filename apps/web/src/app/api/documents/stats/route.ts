import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Run parallel queries for severity breakdowns
    const [severityRows, typeRows, statusRows, totalResult, unassessedResult] = await Promise.all([
      // All docs with severity (to count per severity)
      supabase
        .from('documents')
        .select('severity')
        .not('severity', 'is', null),
      // Docs with severity + type
      supabase
        .from('documents')
        .select('severity, document_type')
        .not('severity', 'is', null),
      // Docs with severity + status
      supabase
        .from('documents')
        .select('severity, processing_status')
        .not('severity', 'is', null),
      // Total count
      supabase
        .from('documents')
        .select('*', { count: 'exact', head: true }),
      // Unassessed count (null severity)
      supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .is('severity', null),
    ])

    const SEVERITY_KEYS = ['extreme_critical', 'critical', 'high', 'routine'] as const

    const severities: Record<string, {
      total: number
      byType: Record<string, number>
      byStatus: Record<string, number>
    }> = {}

    // Initialize
    for (const sev of SEVERITY_KEYS) {
      severities[sev] = { total: 0, byType: {}, byStatus: {} }
    }

    // Count totals per severity
    if (severityRows.data) {
      for (const row of severityRows.data) {
        const sev = row.severity as string
        if (sev && severities[sev]) severities[sev].total++
      }
    }

    // Type breakdown per severity
    if (typeRows.data) {
      for (const row of typeRows.data) {
        const sev = row.severity as string
        const typ = row.document_type as string
        if (sev && severities[sev] && typ) {
          severities[sev].byType[typ] = (severities[sev].byType[typ] ?? 0) + 1
        }
      }
    }

    // Status breakdown per severity
    if (statusRows.data) {
      for (const row of statusRows.data) {
        const sev = row.severity as string
        const status = row.processing_status as string
        if (sev && severities[sev] && status) {
          severities[sev].byStatus[status] = (severities[sev].byStatus[status] ?? 0) + 1
        }
      }
    }

    return NextResponse.json({
      severities,
      unassessed: unassessedResult.count ?? 0,
      total: totalResult.count ?? 0,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
