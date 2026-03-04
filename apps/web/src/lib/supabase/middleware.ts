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

    if (!profile?.subscription_tier) {
      const url = request.nextUrl.clone()
      url.pathname = '/signup'
      url.searchParams.set('upgrade', 'true')
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
