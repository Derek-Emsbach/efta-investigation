import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getStripe, getSupporterPriceId, getInvestigatorPriceId } from '@/lib/stripe'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout session for either a one-time donation (supporter)
 * or monthly subscription (investigator). Requires authentication.
 *
 * Body: { type: 'supporter' | 'investigator' }
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

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const donationType = body.type as 'supporter' | 'investigator'

  if (!donationType || !['supporter', 'investigator'].includes(donationType)) {
    return NextResponse.json({ error: 'Invalid donation type' }, { status: 400 })
  }

  const isSubscription = donationType === 'investigator'

  let priceId: string
  try {
    priceId = isSubscription ? getInvestigatorPriceId() : getSupporterPriceId()
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
      customer_email: user.email,
      metadata: {
        user_id: user.id,
        donation_type: isSubscription ? 'subscription' : 'one_time',
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
