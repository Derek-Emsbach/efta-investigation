import { PublicHeader } from '@/components/publication/public-header'
import { PublicFooter } from '@/components/publication/public-footer'
import { DonateBar } from '@/components/publication/donate-bar'
import { CyclopsPromo } from '@/components/publication/promo/cyclops-promo'
import { ModeSwitch } from '@/components/ui/mode-switch'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { hasSupabaseAuthCookie } from '@/lib/supabase/auth-cookie'
import type { SubscriptionTier } from '@efta/shared'

export default async function PublicationLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Fetch auth state server-side so the header renders correctly on first paint
  // Anonymous visitors: no auth round-trip, no profile queries.
  const cookieStore = await cookies()
  const signedIn = hasSupabaseAuthCookie(cookieStore.getAll())
  const supabase = await createClient()
  const user = signedIn ? (await supabase.auth.getUser()).data.user : null

  let authState: { displayName: string | null; subscriptionTier: SubscriptionTier | null; rank: string | null; role: string | null } | null = null

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, subscription_tier, role')
      .eq('id', user.id)
      .single()

    let rank: string | null = null
    if (profile?.subscription_tier === 'investigator' || profile?.subscription_tier === 'supporter') {
      const { data: stats } = await supabase
        .from('investigator_stats')
        .select('current_rank')
        .eq('user_id', user.id)
        .single()
      rank = stats?.current_rank ?? 'Junior Detective'
    }

    authState = {
      displayName: profile?.display_name ?? null,
      subscriptionTier: (profile?.subscription_tier as SubscriptionTier) ?? null,
      rank,
      role: profile?.role ?? null,
    }
  }

  return (
    <div data-theme="publication" className="min-h-screen bg-background text-text-primary font-body">
      <ModeSwitch mode="newsroom" />
      <DonateBar variant="top" />
      <PublicHeader authState={authState} />
      <main>{children}</main>
      <DonateBar variant="bottom" />
      <CyclopsPromo variant="footer-banner" />
      <PublicFooter />
    </div>
  )
}
