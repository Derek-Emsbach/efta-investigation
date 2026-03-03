import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface AnalysisInsight {
  type: 'missing_connections' | 'under_investigated' | 'stale_reviews' | 'timeline_gaps' | 'redaction_inconsistencies'
  title: string
  count: number
  severity: 'critical' | 'warning' | 'info'
  items: AnalysisItem[]
  href: string
}

export interface AnalysisItem {
  id: string
  label: string
  detail: string
  href: string
}

// Cache for 2 minutes to avoid hammering DB on rapid reloads
let cachedResponse: { data: AnalysisInsight[]; timestamp: number } | null = null
const CACHE_TTL = 120_000

/**
 * GET /api/admin/analysis
 *
 * Runs 5 data quality analysis queries and returns actionable insights:
 * 1. Missing connections — entities co-occurring in 3+ documents with no connection record
 * 2. Under-investigated entities — Tier 1-3 entities with fewer than 3 linked documents
 * 3. Stale reviews — documents in needs_review status for 7+ days
 * 4. Timeline gaps — entities with timeline events spanning 5+ years but fewer than 3 events
 * 5. Redaction inconsistencies — documents with both Category A and Category D redactions
 */
export async function GET() {
  // Return cached result if fresh
  if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL) {
    return NextResponse.json(cachedResponse.data)
  }

  const supabase = await createClient()

  const insights: AnalysisInsight[] = []

  // Run all 5 analyses in parallel
  const [
    missingConns,
    underInvestigated,
    staleReviews,
    timelineGaps,
    redactionInconsistencies,
  ] = await Promise.all([
    analyzeMissingConnections(supabase),
    analyzeUnderInvestigated(supabase),
    analyzeStaleReviews(supabase),
    analyzeTimelineGaps(supabase),
    analyzeRedactionInconsistencies(supabase),
  ])

  if (missingConns.count > 0) insights.push(missingConns)
  if (underInvestigated.count > 0) insights.push(underInvestigated)
  if (staleReviews.count > 0) insights.push(staleReviews)
  if (timelineGaps.count > 0) insights.push(timelineGaps)
  if (redactionInconsistencies.count > 0) insights.push(redactionInconsistencies)

  // Sort by severity priority
  const severityOrder = { critical: 0, warning: 1, info: 2 }
  insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  cachedResponse = { data: insights, timestamp: Date.now() }

  return NextResponse.json(insights)
}


// ── Analysis 1: Missing Connections ──────────────────────────────────

async function analyzeMissingConnections(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<AnalysisInsight> {
  // Find entity pairs that share 3+ documents but have no connection record.
  // We query entity_documents to find co-occurrence on the same document,
  // then check if an entity_connections record exists.
  const { data: coOccurrences } = await supabase.rpc('find_co_occurring_entities', {
    min_shared_docs: 3,
    max_results: 20,
  })

  // If the RPC doesn't exist, fall back to a simpler query
  let items: AnalysisItem[] = []

  if (coOccurrences && Array.isArray(coOccurrences)) {
    items = coOccurrences.map((row: { entity_a_id: string; entity_b_id: string; entity_a_name: string; entity_b_name: string; shared_docs: number }) => ({
      id: `${row.entity_a_id}-${row.entity_b_id}`,
      label: `${row.entity_a_name} ↔ ${row.entity_b_name}`,
      detail: `${row.shared_docs} shared documents, no connection recorded`,
      href: `/dashboard/entities/${row.entity_a_id}`,
    }))
  } else {
    // Fallback: find entities with high document overlap using simpler approach
    const { data: entityDocs } = await supabase
      .from('entity_documents')
      .select('entity_id, document_id, entity:entities!inner(name, tier)')
      .in('entity.tier', [1, 2, 3])
      .limit(500)

    if (entityDocs) {
      // Group by document to find co-occurrences
      const docEntities = new Map<string, { id: string; name: string }[]>()
      for (const row of entityDocs) {
        const entity = row.entity as unknown as { name: string; tier: number }
        const list = docEntities.get(row.document_id) ?? []
        list.push({ id: row.entity_id, name: entity.name })
        docEntities.set(row.document_id, list)
      }

      // Count co-occurrences
      const pairCounts = new Map<string, { a: { id: string; name: string }; b: { id: string; name: string }; count: number }>()
      for (const entities of docEntities.values()) {
        for (let i = 0; i < entities.length; i++) {
          for (let j = i + 1; j < entities.length; j++) {
            const [a, b] = entities[i].id < entities[j].id ? [entities[i], entities[j]] : [entities[j], entities[i]]
            const key = `${a.id}|${b.id}`
            const existing = pairCounts.get(key)
            if (existing) {
              existing.count++
            } else {
              pairCounts.set(key, { a, b, count: 1 })
            }
          }
        }
      }

      // Filter to 3+ co-occurrences, then check for existing connections
      const candidates = [...pairCounts.values()]
        .filter((p) => p.count >= 3)
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)

      if (candidates.length > 0) {
        // Check which pairs already have connections
        const { data: existingConns } = await supabase
          .from('entity_connections')
          .select('entity_a, entity_b')

        const connSet = new Set<string>()
        for (const conn of existingConns ?? []) {
          const c = conn as { entity_a: string; entity_b: string }
          connSet.add(`${c.entity_a}|${c.entity_b}`)
          connSet.add(`${c.entity_b}|${c.entity_a}`)
        }

        for (const pair of candidates) {
          const key = `${pair.a.id}|${pair.b.id}`
          if (!connSet.has(key)) {
            items.push({
              id: key,
              label: `${pair.a.name} ↔ ${pair.b.name}`,
              detail: `${pair.count} shared documents, no connection recorded`,
              href: `/dashboard/entities/${pair.a.id}`,
            })
          }
        }
      }
    }
  }

  return {
    type: 'missing_connections',
    title: 'Missing Connections',
    count: items.length,
    severity: items.length > 5 ? 'warning' : 'info',
    items: items.slice(0, 10),
    href: '/dashboard/network',
  }
}


// ── Analysis 2: Under-Investigated Entities ──────────────────────────

async function analyzeUnderInvestigated(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<AnalysisInsight> {
  // Find Tier 1-3 entities with fewer than 3 linked documents
  const { data: entities } = await supabase
    .from('entities')
    .select('id, name, tier')
    .in('tier', [1, 2, 3])
    .order('tier', { ascending: true })

  const items: AnalysisItem[] = []

  if (entities) {
    // For each entity, count linked documents
    for (const entity of entities) {
      const e = entity as { id: string; name: string; tier: number }
      const { count } = await supabase
        .from('entity_documents')
        .select('*', { count: 'exact', head: true })
        .eq('entity_id', e.id)

      if ((count ?? 0) < 3) {
        items.push({
          id: e.id,
          label: e.name,
          detail: `Tier ${e.tier} with only ${count ?? 0} linked document${count !== 1 ? 's' : ''}`,
          href: `/dashboard/entities/${e.id}`,
        })
      }

      // Limit to 15 items to avoid too many queries
      if (items.length >= 15) break
    }
  }

  return {
    type: 'under_investigated',
    title: 'Under-Investigated Entities',
    count: items.length,
    severity: items.some((i) => i.detail.startsWith('Tier 1')) ? 'critical' : 'warning',
    items: items.slice(0, 10),
    href: '/dashboard/entities',
  }
}


// ── Analysis 3: Stale Reviews ────────────────────────────────────────

async function analyzeStaleReviews(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<AnalysisInsight> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: stale, count } = await supabase
    .from('documents')
    .select('id, bates_number, title, updated_at', { count: 'exact' })
    .eq('processing_status', 'needs_review')
    .lt('updated_at', sevenDaysAgo)
    .order('updated_at', { ascending: true })
    .limit(10)

  const items: AnalysisItem[] = (stale ?? []).map((doc) => {
    const d = doc as { id: string; bates_number: string | null; title: string | null; updated_at: string }
    const daysStale = Math.floor((Date.now() - new Date(d.updated_at).getTime()) / (24 * 60 * 60 * 1000))
    return {
      id: d.id,
      label: d.bates_number ?? 'Unknown',
      detail: `${d.title ?? 'Untitled'} — waiting ${daysStale} days`,
      href: `/dashboard/documents/${d.id}`,
    }
  })

  return {
    type: 'stale_reviews',
    title: 'Stale Reviews',
    count: count ?? items.length,
    severity: (count ?? 0) > 10 ? 'warning' : 'info',
    items,
    href: '/dashboard/review',
  }
}


// ── Analysis 4: Timeline Gaps ────────────────────────────────────────

async function analyzeTimelineGaps(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<AnalysisInsight> {
  // Find entities with events spanning 5+ years but fewer than 3 total events
  // This suggests significant gaps in timeline coverage
  const { data: entities } = await supabase
    .from('entities')
    .select('id, name, tier')
    .in('tier', [1, 2, 3, 4])
    .order('tier', { ascending: true })
    .limit(100)

  const items: AnalysisItem[] = []

  if (entities) {
    for (const entity of entities) {
      const e = entity as { id: string; name: string; tier: number }
      const { data: events } = await supabase
        .from('entity_events')
        .select('event:events!inner(date)')
        .eq('entity_id', e.id)
        .not('event.date', 'is', null)
        .order('event(date)', { ascending: true })

      if (!events || events.length < 1) continue

      const dates = events
        .map((ev) => (ev.event as unknown as { date: string })?.date)
        .filter(Boolean)
        .sort()

      if (dates.length < 3 && dates.length >= 1) {
        const firstYear = new Date(dates[0]).getFullYear()
        const lastYear = new Date(dates[dates.length - 1]).getFullYear()
        const span = lastYear - firstYear

        if (span >= 5 || (dates.length === 1 && e.tier <= 2)) {
          items.push({
            id: e.id,
            label: e.name,
            detail: dates.length === 1
              ? `Tier ${e.tier}, only 1 timeline event`
              : `${span}-year span with only ${dates.length} events`,
            href: `/dashboard/entities/${e.id}`,
          })
        }
      }

      if (items.length >= 15) break
    }
  }

  return {
    type: 'timeline_gaps',
    title: 'Timeline Gaps',
    count: items.length,
    severity: items.some((i) => i.detail.includes('Tier 1') || i.detail.includes('Tier 2')) ? 'warning' : 'info',
    items: items.slice(0, 10),
    href: '/dashboard/timeline',
  }
}


// ── Analysis 5: Redaction Inconsistencies ────────────────────────────

async function analyzeRedactionInconsistencies(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<AnalysisInsight> {
  // Find documents with both Category A (victim protection) and Category D (perpetrator protection)
  // redactions — this pattern often indicates suspicious redaction practices
  const { data: catADocs } = await supabase
    .from('redactions')
    .select('document_id')
    .eq('category', 'A')

  const { data: catDDocs } = await supabase
    .from('redactions')
    .select('document_id')
    .eq('category', 'D')

  const items: AnalysisItem[] = []

  if (catADocs && catDDocs) {
    const catASet = new Set(catADocs.map((r) => (r as { document_id: string }).document_id))
    const overlap = catDDocs
      .map((r) => (r as { document_id: string }).document_id)
      .filter((docId) => catASet.has(docId))

    const uniqueDocIds = [...new Set(overlap)].slice(0, 10)

    if (uniqueDocIds.length > 0) {
      const { data: docs } = await supabase
        .from('documents')
        .select('id, bates_number, title')
        .in('id', uniqueDocIds)

      for (const doc of docs ?? []) {
        const d = doc as { id: string; bates_number: string | null; title: string | null }
        items.push({
          id: d.id,
          label: d.bates_number ?? 'Unknown',
          detail: `${d.title ?? 'Untitled'} — has both Category A and D redactions`,
          href: `/dashboard/documents/${d.id}`,
        })
      }
    }
  }

  return {
    type: 'redaction_inconsistencies',
    title: 'Redaction Inconsistencies',
    count: items.length,
    severity: items.length > 0 ? 'critical' : 'info',
    items,
    href: '/dashboard/search',
  }
}
