import { createCachedReadClient } from './cached-read'

/**
 * The ONE public-visibility rule for entities. Every logged-out read of an
 * entity (page, public API, sitemap, counts, embedded joins) goes through here.
 *
 * Visible = profile_published AND no active metadata.publication_hold.
 * publication_hold appears as `true` or as `{ active, since, reason }`; any
 * value other than null/false counts as held (fails closed).
 */
const PUBLIC_ENTITY_HOLD_FILTER =
  'metadata->publication_hold.is.null,metadata->>publication_hold.eq.false'

/**
 * Columns to add to an embedded `entities(...)` select so the row can be
 * checked with isPubliclyVisibleEntity without shipping the whole metadata blob.
 */
export const PUBLIC_ENTITY_VISIBILITY_COLUMNS =
  'profile_published, publication_hold:metadata->publication_hold'

interface EntityFilterable {
  eq(column: string, value: boolean): { or(filters: string): unknown }
}

/**
 * Restrict a direct `.from('entities')` query to publicly visible rows.
 * Safe to combine with a caller's own `.or()`: each `.or()` becomes a separate
 * `or=` param, and PostgREST ANDs them.
 */
export function applyPublicEntityFilter<Q extends object>(query: Q): Q {
  // Structurally constraining Q to the PostgREST builder blows TS's
  // instantiation depth (TS2589), so narrow inside instead. eq/or return the
  // same builder, so casting back to Q keeps the caller's row typing.
  const builder = query as unknown as EntityFilterable
  return builder.eq('profile_published', true).or(PUBLIC_ENTITY_HOLD_FILTER) as Q
}

export interface VisibilityFields {
  profile_published?: boolean | null
  publication_hold?: unknown
}

/** JS twin of applyPublicEntityFilter, for embedded joins and component checks. */
export function isPubliclyVisibleEntity(
  entity: VisibilityFields | null | undefined,
): boolean {
  if (!entity || entity.profile_published !== true) return false
  const hold = entity.publication_hold
  return hold === undefined || hold === null || hold === false
}

/** Ids of every publicly visible entity (cached read). Null on query error. */
export async function getPublicEntityIds(): Promise<Set<string> | null> {
  const supabase = createCachedReadClient()
  const ids = new Set<string>()
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await applyPublicEntityFilter(
      supabase.from('entities').select('id'),
    ).range(from, from + pageSize - 1)
    if (error) return null
    for (const row of data ?? []) ids.add(row.id as string)
    if (!data || data.length < pageSize) break
  }
  return ids
}
