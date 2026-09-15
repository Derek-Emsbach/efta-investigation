import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ADMIN_PATHS = [
  '/dashboard/upload',
  '/dashboard/processing',
  '/dashboard/review',
  '/dashboard/assistant',
  '/dashboard/admin',
  '/dashboard/settings',
  '/dashboard/submissions',
  '/dashboard/moderation',
]

// ---------------------------------------------------------------------------
// Internal API surface — authentication required.
//
// These routes existed before /api/public/* and return UNFILTERED database
// rows: every entity regardless of profile_published, including records that
// are deliberately unpublished (private individuals, unresolved-identity
// records, and entities withheld pending review). The page-level publication
// gate does not apply to them.
//
// Every caller in this codebase lives under /dashboard, which already requires
// auth, so requiring auth here changes no legitimate behaviour. Public traffic
// must use /api/public/*, which filters on profile_published.
//
// Added 2026-07-31 after an audit found /api/network and /api/entities served
// the complete entity table — including `metadata` — to unauthenticated callers.
// ---------------------------------------------------------------------------
const PROTECTED_API_PREFIXES = [
  '/api/entities',
  '/api/network',
  '/api/search',
  '/api/stats',
  '/api/review',
  '/api/admin',
  '/api/assistant',
  '/api/documents',
  '/api/events',
]

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Internal APIs: 401 JSON rather than a redirect, so fetch() callers get a
  // usable error instead of an HTML login page.
  if (!user && PROTECTED_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.json(
      { error: 'Authentication required. Public data is available under /api/public/*.' },
      { status: 401 },
    )
  }

  // /dashboard/* and /account/* require authentication
  const requiresAuth =
    pathname.startsWith('/dashboard') || pathname.startsWith('/account')

  if (!user && requiresAuth) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }

  // /investigate/* requires authentication + a subscription_tier
  if (pathname.startsWith('/investigate')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('from', pathname)
      return NextResponse.redirect(url)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()

    if (!profile?.subscription_tier || profile.subscription_tier === 'subscriber') {
      const url = request.nextUrl.clone()
      url.pathname = '/support'
      return NextResponse.redirect(url)
    }
  }

  // Admin route guard: redirect non-admins away from admin-only dashboard paths
  if (user && ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role ?? 'viewer'

    if (role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
