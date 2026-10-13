import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
  process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** GET /api/public/newsletter/unsubscribe?token=<unsubscribe_token> — link goes in every email footer. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  if (UUID_RE.test(token)) {
    await supabase.from('newsletter_subscribers').update({ status: 'unsubscribed' }).eq('unsubscribe_token', token)
  }
  // Same response either way (no token probing).
  return new NextResponse(
    '<!doctype html><meta charset="utf-8"><title>Unsubscribed</title><body style="font-family:Georgia,serif;max-width:520px;margin:80px auto;padding:0 16px;color:#1a1a1a;background:#faf8f5"><h1>You have been unsubscribed.</h1><p>You will not receive further briefings. <a href="/">Back to The Epstein Crimes</a></p></body>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}
