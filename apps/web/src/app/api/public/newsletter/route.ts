import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
  process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
)

const SOURCES = ['home', 'story', 'support', 'footer', 'news'] as const
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * POST /api/public/newsletter  { email, source, company? }
 * `company` is a honeypot — if filled, pretend success and drop it.
 * Always returns ok for an already-subscribed address (no email enumeration).
 */
export async function POST(request: Request) {
  const limited = await checkRateLimit(request, 'auth')
  if (limited) return limited

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const { email, source, company } = body as Record<string, unknown>

  if (typeof company === 'string' && company.length > 0) {
    return NextResponse.json({ ok: true })
  }
  if (typeof email !== 'string' || email.length > 254 || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }
  const src = SOURCES.includes(source as (typeof SOURCES)[number]) ? (source as string) : null

  const { error } = await supabase
    .from('newsletter_subscribers')
    .insert({ email: email.trim().toLowerCase(), source: src })

  // 23505 = unique violation → already subscribed; treat as success.
  if (error && error.code !== '23505') {
    console.error('[newsletter] insert failed:', error.message)
    return NextResponse.json({ error: 'Could not subscribe right now. Try again later.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
