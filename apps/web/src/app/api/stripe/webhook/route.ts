import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getStripe, getWebhookSecret } from '@/lib/stripe'

// Use service role to bypass RLS for tier updates
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
  process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
)

/**
 * Stripe webhook handler.
 *
 * Handles these events:
 * - checkout.session.completed → upgrade to supporter (one-time) or investigator (subscription)
 * - customer.subscription.deleted → downgrade from investigator to supporter
 * - customer.subscription.updated → handle cancellation/reactivation
 *
 * Idempotent: uses stripe_event_id unique constraint on donation_events table.
 */
export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, getWebhookSecret())
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    console.error('Stripe webhook signature verification failed:', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event)
        break

      default:
        // Ignore other event types
        break
    }
  } catch (err) {
    console.error(`Stripe webhook error [${event.type}]:`, err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session

  const userId = session.metadata?.user_id
  const stripeCustomerId = session.customer as string
  const donationType = session.metadata?.donation_type as 'one_time' | 'subscription' | undefined

  if (!userId) {
    console.error('Checkout session missing user_id in metadata:', session.id)
    return
  }

  // Record the donation event (idempotent via stripe_event_id unique constraint)
  await supabase.from('donation_events').upsert(
    {
      stripe_event_id: event.id,
      user_id: userId,
      stripe_customer_id: stripeCustomerId,
      event_type: donationType === 'subscription' ? 'subscription_created' : 'one_time_payment',
      amount_cents: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
      metadata: { session_id: session.id },
    },
    { onConflict: 'stripe_event_id' },
  )

  // Determine new tier
  const newTier = donationType === 'subscription' ? 'investigator' : 'supporter'

  // Fetch existing profile to accumulate donation total and check first_donation_at
  const { data: existing } = await supabase
    .from('profiles')
    .select('first_donation_at, donation_total_cents')
    .eq('id', userId)
    .single()

  const updateData: Record<string, unknown> = {
    stripe_customer_id: stripeCustomerId,
    subscription_tier: newTier,
    donation_total_cents: (existing?.donation_total_cents ?? 0) + (session.amount_total ?? 0),
  }

  if (!existing?.first_donation_at) {
    updateData.first_donation_at = new Date().toISOString()
  }

  if (donationType === 'subscription') {
    updateData.stripe_subscription_id = session.subscription as string
    updateData.subscription_started_at = new Date().toISOString()
    updateData.subscription_cancelled_at = null
  }

  await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', userId)
}

async function handleSubscriptionDeleted(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  const stripeCustomerId = subscription.customer as string

  // Find user by stripe_customer_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, subscription_tier')
    .eq('stripe_customer_id', stripeCustomerId)
    .single()

  if (!profile) {
    console.error('No profile found for Stripe customer:', stripeCustomerId)
    return
  }

  // Record event
  await supabase.from('donation_events').upsert(
    {
      stripe_event_id: event.id,
      user_id: profile.id,
      stripe_customer_id: stripeCustomerId,
      event_type: 'subscription_cancelled',
      amount_cents: 0,
      currency: 'usd',
    },
    { onConflict: 'stripe_event_id' },
  )

  // Downgrade from investigator to supporter (they still donated once)
  if (profile.subscription_tier === 'investigator') {
    await supabase
      .from('profiles')
      .update({
        subscription_tier: 'supporter',
        stripe_subscription_id: null,
        subscription_cancelled_at: new Date().toISOString(),
      })
      .eq('id', profile.id)
  }
}

async function handleSubscriptionUpdated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  const stripeCustomerId = subscription.customer as string

  // If subscription is being cancelled at period end, we don't downgrade yet
  // (Stripe sends 'deleted' when it actually ends)
  // But if it's reactivated, re-upgrade
  if (subscription.status === 'active' && !subscription.cancel_at_period_end) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, subscription_tier')
      .eq('stripe_customer_id', stripeCustomerId)
      .single()

    if (profile && profile.subscription_tier !== 'investigator') {
      await supabase
        .from('profiles')
        .update({
          subscription_tier: 'investigator',
          stripe_subscription_id: subscription.id,
          subscription_cancelled_at: null,
        })
        .eq('id', profile.id)
    }
  }
}
