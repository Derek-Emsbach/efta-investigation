/**
 * Cursor-based pagination utilities for large tables (1M+ rows).
 *
 * Cursor = base64-encoded JSON { v: sortColumnValue, id: rowId }.
 * The id acts as a tiebreaker for rows with identical sort values.
 *
 * Query pattern:
 *   WHERE (sort_col > cursorVal) OR (sort_col = cursorVal AND id > cursorId)
 *   ORDER BY sort_col ASC, id ASC
 *   LIMIT pageSize + 1   -- extra row detects hasMore
 */

// ─── Types ──────────────────────────────────────────────

export interface CursorPage<T> {
  data: T[]
  nextCursor: string | null
  prevCursor: string | null
  hasMore: boolean
  estimatedTotal: number
}

interface CursorPayload {
  v: string
  id: string
}

// ─── Encode / Decode ────────────────────────────────────

export function encodeCursor(
  sortValue: string | number | null | undefined,
  id: string,
): string {
  const payload: CursorPayload = {
    v: sortValue == null ? '' : String(sortValue),
    id,
  }
  return btoa(JSON.stringify(payload))
}

export function decodeCursor(cursor: string): CursorPayload {
  try {
    return JSON.parse(atob(cursor)) as CursorPayload
  } catch {
    throw new Error('Invalid cursor')
  }
}

// ─── Supabase Filter Builder ────────────────────────────

/**
 * Build a Supabase `.or()` filter string for cursor pagination.
 *
 * For ascending order:
 *   (sort_col > val) OR (sort_col = val AND id > cursorId)
 *
 * For descending order:
 *   (sort_col < val) OR (sort_col = val AND id < cursorId)
 *
 * Handles null/empty sort values by filtering on id only.
 */
export function buildCursorFilter(
  sortColumn: string,
  sortValue: string,
  cursorId: string,
  ascending: boolean,
): string {
  const op = ascending ? 'gt' : 'lt'

  if (sortValue === '') {
    // Null sort values — filter on id only
    return `id.${op}.${cursorId}`
  }

  return `${sortColumn}.${op}.${sortValue},and(${sortColumn}.eq.${sortValue},id.${op}.${cursorId})`
}
