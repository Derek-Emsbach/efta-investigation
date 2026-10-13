import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getStripe, getSupporterPriceId, getInvestigatorPriceId, getSupporterMonthlyPriceId } from '@/lib/stripe'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout session for either a one-time donation (supporter)
 * or monthly subscription. Authentication is optional: guests can donate;
 * signed-in users additionally get their profile tier upgraded by the webhook.
 *
 * Body: { type: 'supporter' | 'supporter_monthly' | 'investigator' }
 */
export async function POST(request: Request) {
  const rateLimited = await checkRateLimit(request, 'auth')
  if (rateLimited) return rateLimited

  // Authenticate the user
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Guests may donate without an account (biggest conversion win).
  // Logged-in users get their Supporter tier applied by the webhook via user_id.

  const body = await request.json()
  const donationType = body.type as 'supporter' | 'supporter_monthly' | 'investigator'
  const VALID_TYPES = ['supporter', 'supporter_monthly', 'investigator']

  if (!donationType || !VALID_TYPES.includes(donationType)) {
    return NextResponse.json({ error: 'Invalid donation type' }, { status: 400 })
  }

  const isSubscription = donationType === 'investigator' || donationType === 'supporter_monthly'

  let priceId: string
  try {
    if (donationType === 'investigator') priceId = getInvestigatorPriceId()
    else if (donationType === 'supporter_monthly') priceId = getSupporterMonthlyPriceId()
    else priceId = getSupporterPriceId()
  } catch {
    console.error(`Missing Stripe price ID for ${donationType}`)
    return NextResponse.json({ error: 'Payment not configured' }, { status: 500 })
  }

  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || ''

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: isSubscription ? 'subscription' : 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      ...(user?.email ? { customer_email: user.email } : {}),
      ...(isSubscription ? {} : { customer_creation: 'always' as const }),
      metadata: {
        user_id: user?.id ?? '',
        donation_type: donationType === 'supporter' ? 'one_time' : donationType === 'supporter_monthly' ? 'supporter_monthly' : 'subscription',
      },
      success_url: `${origin}/support/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/support`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Stripe checkout session error:', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
