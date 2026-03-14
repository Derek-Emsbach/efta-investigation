/**
 * Simple in-memory rate limiter for public API routes.
 * Uses a sliding window counter per IP address.
 *
 * Three tiers:
 * - General (entities, stories, case files, homepage): 120 req/min
 * - Evidence search (heavier queries against 1.37M rows): 60 req/min
 * - Comments (create, react, flag): 30 req/min
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const stores: Record<string, Map<string, RateLimitEntry>> = {
  general: new Map(),
  search: new Map(),
  comments: new Map(),
}

const LIMITS = {
  general: { max: 120, windowMs: 60_000 },
  search: { max: 60, windowMs: 60_000 },
  comments: { max: 30, windowMs: 60_000 },
}

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const store of Object.values(stores)) {
    for (const [key, entry] of store) {
      if (entry.resetAt < now) {
        store.delete(key)
      }
    }
  }
}, 5 * 60_000)

export function rateLimit(
  ip: string,
  tier: 'general' | 'search' | 'comments' = 'general',
): { success: boolean; remaining: number; resetAt: number } {
  const store = stores[tier]
  const config = LIMITS[tier]
  const now = Date.now()

  const entry = store.get(ip)

  if (!entry || entry.resetAt < now) {
    // New window
    const resetAt = now + config.windowMs
    store.set(ip, { count: 1, resetAt })
    return { success: true, remaining: config.max - 1, resetAt }
  }

  if (entry.count >= config.max) {
    return { success: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { success: true, remaining: config.max - entry.count, resetAt: entry.resetAt }
}

/**
 * Apply rate limiting in an API route handler.
 * Returns a Response if rate-limited, or null if the request is allowed.
 */
export function checkRateLimit(
  request: Request,
  tier: 'general' | 'search' | 'comments' = 'general',
): Response | null {
  // Get IP from Vercel headers, fall back to x-forwarded-for
  const ip =
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'

  const result = rateLimit(ip, tier)

  if (!result.success) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Limit': String(LIMITS[tier].max),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
        },
      },
    )
  }

  return null
}
