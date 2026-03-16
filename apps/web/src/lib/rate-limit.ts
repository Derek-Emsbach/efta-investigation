/**
 * Distributed rate limiter using Upstash Redis.
 * Replaces the previous in-memory Map-based limiter, which reset on every
 * serverless cold start (allowing limit bypass across Vercel isolates).
 *
 * Falls back to in-memory limiting when UPSTASH_REDIS_REST_URL is not set
 * (local development).
 *
 * Four tiers:
 * - General (entities, stories, case files, homepage): 120 req/min
 * - Evidence search (heavier queries against 1.37M rows): 60 req/min
 * - Comments (create, react, flag): 30 req/min
 * - Auth (login, signup, password reset): 5 req/min
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

type Tier = 'general' | 'search' | 'comments' | 'auth'

const LIMITS: Record<Tier, { max: number; windowMs: number }> = {
  general: { max: 120, windowMs: 60_000 },
  search: { max: 60, windowMs: 60_000 },
  comments: { max: 30, windowMs: 60_000 },
  auth: { max: 5, windowMs: 60_000 },
}

// ---------------------------------------------------------------------------
// Upstash Redis limiters (one per tier, lazy-initialized)
// ---------------------------------------------------------------------------

let upstashLimiters: Record<Tier, Ratelimit> | null = null

function getUpstashLimiters(): Record<Tier, Ratelimit> | null {
  if (upstashLimiters) return upstashLimiters

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) return null

  const redis = new Redis({ url, token })

  upstashLimiters = {
    general: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(120, '60 s'),
      prefix: 'rl:general',
    }),
    search: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '60 s'),
      prefix: 'rl:search',
    }),
    comments: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '60 s'),
      prefix: 'rl:comments',
    }),
    auth: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '60 s'),
      prefix: 'rl:auth',
    }),
  }

  return upstashLimiters
}

// ---------------------------------------------------------------------------
// In-memory fallback (local dev / missing env vars)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number
  resetAt: number
}

const memoryStores: Record<Tier, Map<string, RateLimitEntry>> = {
  general: new Map(),
  search: new Map(),
  comments: new Map(),
  auth: new Map(),
}

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const store of Object.values(memoryStores)) {
    for (const [key, entry] of store) {
      if (entry.resetAt < now) {
        store.delete(key)
      }
    }
  }
}, 5 * 60_000)

function memoryRateLimit(
  ip: string,
  tier: Tier,
): { success: boolean; remaining: number; resetAt: number } {
  const store = memoryStores[tier]
  const config = LIMITS[tier]
  const now = Date.now()

  const entry = store.get(ip)

  if (!entry || entry.resetAt < now) {
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

// ---------------------------------------------------------------------------
// Public API (same signature as before — drop-in replacement)
// ---------------------------------------------------------------------------

export function rateLimit(
  ip: string,
  tier: Tier = 'general',
): { success: boolean; remaining: number; resetAt: number } {
  // Synchronous path — only used by in-memory fallback
  return memoryRateLimit(ip, tier)
}

/**
 * Apply rate limiting in an API route handler.
 * Returns a Response if rate-limited, or null if the request is allowed.
 *
 * Uses Upstash Redis when configured, falls back to in-memory.
 */
export async function checkRateLimit(
  request: Request,
  tier: Tier = 'general',
): Promise<Response | null> {
  const ip =
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'

  const limiters = getUpstashLimiters()

  if (limiters) {
    // Upstash path — single HTTP round-trip to Redis
    const { success, limit, remaining, reset } = await limiters[tier].limit(ip)

    if (!success) {
      const resetMs = reset
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((resetMs - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(resetMs / 1000)),
          },
        },
      )
    }

    return null
  }

  // In-memory fallback
  const result = memoryRateLimit(ip, tier)

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
