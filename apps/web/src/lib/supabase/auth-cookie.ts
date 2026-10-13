/**
 * True when the request carries a Supabase auth session cookie
 * (`sb-<project-ref>-auth-token`, possibly chunked as `.0`, `.1`).
 *
 * Anonymous visitors (the overwhelming majority of public traffic) have none,
 * so we can skip the `auth.getUser()` network round-trip to Supabase Auth
 * entirely for them. Logged-in users take the normal, fully verified path.
 */
export function hasSupabaseAuthCookie(cookies: { name: string }[]): boolean {
  return cookies.some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'))
}
