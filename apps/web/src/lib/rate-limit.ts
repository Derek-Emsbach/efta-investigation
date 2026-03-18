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

// Investigators get 3x the base limit for general and search tiers
const INVESTIGATOR_MULTIPLIER = 3
const INVESTIGATOR_ELEVATED: Set<Tier> = new Set(['general', 'search'])

// ---------------------------------------------------------------------------
// Upstash Redis limiters (one per tier, lazy-initialized)
// ---------------------------------------------------------------------------

type LimiterKey = Tier | `${Tier}:investigator`

let upstashLimiters: Record<string, Ratelimit> | null = null

function getUpstashLimiters(): Record<string, Ratelimit> | null {
  if (upstashLimiters) return upstashLimiters

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) return null

  const redis = new Redis({ url, token })

  const limiters: Record<string, Ratelimit> = {}

  for (const [tier, config] of Object.entries(LIMITS)) {
    limiters[tier] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.max, '60 s'),
      prefix: `rl:${tier}`,
    })

    // Create elevated investigator variants for applicable tiers
    if (INVESTIGATOR_ELEVATED.has(tier as Tier)) {
      limiters[`${tier}:investigator`] = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(config.max * INVESTIGATOR_MULTIPLIER, '60 s'),
        prefix: `rl:${tier}:inv`,
      })
    }
  }

  upstashLimiters = limiters
  return upstashLimiters
}

function getLimiterKey(tier: Tier, isInvestigator: boolean): LimiterKey {
  if (isInvestigator && INVESTIGATOR_ELEVATED.has(tier)) {
    return `${tier}:investigator`
  }
  return tier
}

// ---------------------------------------------------------------------------
// In-memory fallback (local dev / missing env vars)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number
  resetAt: number
}

const memoryStores = new Map<string, Map<string, RateLimitEntry>>()

function getMemoryStore(key: string): Map<string, RateLimitEntry> {
  let store = memoryStores.get(key)
  if (!store) {
    store = new Map()
    memoryStores.set(key, store)
  }
  return store
}

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const store of memoryStores.values()) {
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
  isInvestigator: boolean = false,
): { success: boolean; remaining: number; resetAt: number } {
  const limiterKey = getLimiterKey(tier, isInvestigator)
  const store = getMemoryStore(limiterKey)
  const baseConfig = LIMITS[tier]
  const max = (isInvestigator && INVESTIGATOR_ELEVATED.has(tier))
    ? baseConfig.max * INVESTIGATOR_MULTIPLIER
    : baseConfig.max
  const now = Date.now()

  const entry = store.get(ip)

  if (!entry || entry.resetAt < now) {
    const resetAt = now + baseConfig.windowMs
    store.set(ip, { count: 1, resetAt })
    return { success: true, remaining: max - 1, resetAt }
  }

  if (entry.count >= max) {
    return { success: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { success: true, remaining: max - entry.count, resetAt: entry.resetAt }
}

// ---------------------------------------------------------------------------
// Public API (same signature as before — drop-in replacement)
// ---------------------------------------------------------------------------

export function rateLimit(
  ip: string,
  tier: Tier = 'general',
  isInvestigator: boolean = false,
): { success: boolean; remaining: number; resetAt: number } {
  // Synchronous path — only used by in-memory fallback
  return memoryRateLimit(ip, tier, isInvestigator)
}

interface RateLimitOptions {
  /** Which rate limit tier to use. Default: 'general' */
  tier?: Tier
  /** Set to true when the caller is an authenticated investigator. Gives 3x limit on general/search tiers. */
  isInvestigator?: boolean
}

/**
 * Apply rate limiting in an API route handler.
 * Returns a Response if rate-limited, or null if the request is allowed.
 *
 * Uses Upstash Redis when configured, falls back to in-memory.
 * Pass `isInvestigator: true` for elevated limits (3x general/search).
 */
export async function checkRateLimit(
  request: Request,
  tierOrOptions: Tier | RateLimitOptions = 'general',
): Promise<Response | null> {
  const opts: RateLimitOptions = typeof tierOrOptions === 'string'
    ? { tier: tierOrOptions }
    : tierOrOptions
  const tier = opts.tier ?? 'general'
  const isInvestigator = opts.isInvestigator ?? false

  const ip =
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'

  const limiterKey = getLimiterKey(tier, isInvestigator)
  const limiters = getUpstashLimiters()

  if (limiters) {
    const limiter = limiters[limiterKey] ?? limiters[tier]
    // Upstash path — single HTTP round-trip to Redis
    const { success, limit, remaining, reset } = await limiter.limit(ip)

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
  const effectiveMax = (isInvestigator && INVESTIGATOR_ELEVATED.has(tier))
    ? LIMITS[tier].max * INVESTIGATOR_MULTIPLIER
    : LIMITS[tier].max
  const result = memoryRateLimit(ip, tier, isInvestigator)

  if (!result.success) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Limit': String(effectiveMax),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
        },
      },
    )
  }

  return null
}
