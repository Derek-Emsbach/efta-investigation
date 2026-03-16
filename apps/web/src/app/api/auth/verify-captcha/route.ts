import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { verifyTurnstileToken } from '@/lib/turnstile'

export async function POST(request: Request) {
  // Auth-tier rate limit: 5 attempts per minute
  const rateLimited = await checkRateLimit(request, 'auth')
  if (rateLimited) return rateLimited

  const body = await request.json()
  const token = body.token as string

  if (!token) {
    return NextResponse.json(
      { error: 'Missing captcha token' },
      { status: 400 },
    )
  }

  const result = await verifyTurnstileToken(token)

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 403 },
    )
  }

  return NextResponse.json({ success: true })
}
