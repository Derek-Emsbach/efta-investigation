import { PublicHeader } from '@/components/publication/public-header'
import { PublicFooter } from '@/components/publication/public-footer'
import { DonateBar } from '@/components/publication/donate-bar'
import { createClient } from '@/lib/supabase/server'
import type { SubscriptionTier } from '@efta/shared'

export default async function PublicationLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Fetch auth state server-side so the header renders correctly on first paint
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let authState: { displayName: string | null; subscriptionTier: SubscriptionTier | null; rank: string | null } | null = null

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, subscription_tier')
      .eq('id', user.id)
      .single()

    let rank: string | null = null
    if (profile?.subscription_tier === 'investigator') {
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
    }
  }

  return (
    <div data-theme="publication" className="min-h-screen bg-background text-text-primary font-body">
      <DonateBar variant="top" />
      <PublicHeader authState={authState} />
      <main>{children}</main>
      <DonateBar variant="bottom" />
      <PublicFooter />
    </div>
  )
}
