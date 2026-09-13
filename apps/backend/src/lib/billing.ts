import Stripe from 'stripe'

/* Stripe client + config, following the same "blank env = not configured yet,
 * never crash" convention as lib/ai/index.ts (AiNotConfiguredError) — routes
 * catch this and return 503, exactly like routes/ai.ts does for a missing
 * AI_API_KEY. Safe to deploy before the Stripe account exists; every billing
 * route just answers "not enabled yet" until the three env vars are set. */

export class BillingNotConfiguredError extends Error {}

let cached: Stripe | null = null

/** Lazily construct the Stripe client. Throws BillingNotConfiguredError, never
 *  a raw Stripe SDK error, if STRIPE_SECRET_KEY isn't set. */
export function getStripe(): Stripe {
  if (cached) return cached
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new BillingNotConfiguredError('Missing STRIPE_SECRET_KEY')
  cached = new Stripe(key)
  return cached
}

/** The one paid plan's Stripe Price id (recurring, €9.99/mo — see plans.premium
 *  in the DB; the price itself lives in Stripe, not duplicated here). */
export function getPremiumPriceId(): string {
  const id = process.env.STRIPE_PRICE_ID_PREMIUM
  if (!id) throw new BillingNotConfiguredError('Missing STRIPE_PRICE_ID_PREMIUM')
  return id
}

export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) throw new BillingNotConfiguredError('Missing STRIPE_WEBHOOK_SECRET')
  return secret
}

/** True once all three billing env vars are set — lets the frontend/admin
 *  panel tell "not configured" apart from "configured but plan not marked
 *  purchasable yet" without probing Stripe itself. */
export function isBillingConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_PRICE_ID_PREMIUM && !!process.env.STRIPE_WEBHOOK_SECRET
}
