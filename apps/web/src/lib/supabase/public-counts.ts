import { createCachedReadClient } from './cached-read'
import { applyPublicEntityFilter, getPublicEntityIds } from './public-visibility'

/**
 * Public-facing counts. Every page that shows one of these figures reads it
 * from here, so the homepage, About, and section pages always agree.
 * Each returns null on a query error — callers show a dash or omit the
 * figure rather than a hardcoded fallback.
 */

/** Entities visible to logged-out readers (same rule as /entities). */
export async function getPublishedEntityCount(): Promise<number | null> {
  const supabase = createCachedReadClient()
  const { count, error } = await applyPublicEntityFilter(
    supabase.from('entities').select('id', { count: 'exact', head: true }),
  )
  return error ? null : count
}

/** Connections whose BOTH endpoints are publicly visible (as /network draws them). */
export async function getPublicConnectionCount(): Promise<number | null> {
  const publicIds = await getPublicEntityIds()
  if (!publicIds) return null

  const supabase = createCachedReadClient()
  const pageSize = 1000
  let total = 0
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('entity_connections')
      .select('entity_a, entity_b')
      .order('id')
      .range(from, from + pageSize - 1)
    if (error) return null
    for (const c of data ?? []) {
      if (publicIds.has(c.entity_a) && publicIds.has(c.entity_b)) total++
    }
    if (!data || data.length < pageSize) break
  }
  return total
}

/** Open questions — the homepage stat bar's query. */
export async function getOpenQuestionCount(): Promise<number | null> {
  const supabase = createCachedReadClient()
  const { count, error } = await supabase
    .from('open_questions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open')
  return error ? null : count
}

/** Display helper: exact number, or an em dash when the count is unavailable. */
export function formatCount(n: number | null): string {
  return n === null ? '—' : n.toLocaleString('en-US')
}
