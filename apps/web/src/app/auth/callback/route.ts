import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Auth callback route for Supabase email flows.
 * Handles: email confirmation, password reset, magic links.
 *
 * Supabase redirects here with a `code` query parameter.
 * We exchange it for a session, then redirect to the appropriate page.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Determine redirect based on the flow type
      const type = searchParams.get('type')

      if (type === 'recovery') {
        // Password reset — send to account page with reset flag
        return NextResponse.redirect(`${origin}/account?reset=true`)
      }

      // Email confirmation or other — redirect to `next` or home
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // If code exchange fails, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
