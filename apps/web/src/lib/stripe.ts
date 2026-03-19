import Stripe from 'stripe'

let _stripe: Stripe | null = null

/**
 * Lazy-initialized Stripe client.
 * Only called from Stripe API routes, so it won't throw during build
 * or for routes that don't need Stripe.
 */
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    _stripe = new Stripe(key, {
      typescript: true,
    })
  }
  return _stripe
}

export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set')
  return secret
}

export function getSupporterPriceId(): string {
  const id = process.env.STRIPE_PRICE_SUPPORTER
  if (!id) throw new Error('STRIPE_PRICE_SUPPORTER is not set')
  return id
}

export function getInvestigatorPriceId(): string {
  const id = process.env.STRIPE_PRICE_INVESTIGATOR
  if (!id) throw new Error('STRIPE_PRICE_INVESTIGATOR is not set')
  return id
}

export function getSupporterMonthlyPriceId(): string {
  const id = process.env.STRIPE_PRICE_SUPPORTER_MONTHLY
  if (!id) throw new Error('STRIPE_PRICE_SUPPORTER_MONTHLY is not set')
  return id
}
