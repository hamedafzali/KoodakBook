import { Router, raw } from 'express'
import Stripe from 'stripe'
import { query, queryOne } from '../lib/db'
import { asyncHandler } from '../lib/asyncHandler'
import { getStripe, getWebhookSecret, isBillingConfigured } from '../lib/billing'
import { logAudit } from '../lib/audit'
import {
  notifyCancelScheduled, notifyPaymentFailed, notifySubscriptionEnded, notifySubscriptionStarted,
} from '../lib/adminNotify'

/* Stripe webhook — the ONLY thing that writes stripe_customer_id /
 * stripe_subscription_id / plan / plan_expires_at for a Stripe-managed
 * subscription. Mounted in index.ts BEFORE the global express.json(), with
 * its own express.raw() here, because Stripe's signature check
 * (stripe.webhooks.constructEvent) needs the exact raw request body — once
 * express.json() has parsed and re-serialized it, the signature no longer
 * verifies. This is the standard, and only correct, way to do it. */

const router = Router()

router.post('/', raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
  if (!isBillingConfigured()) { res.status(503).json({ data: null, error: 'پرداخت هنوز فعال نشده' }); return }

  const sig = req.headers['stripe-signature']
  if (!sig || typeof sig !== 'string') { res.status(400).json({ data: null, error: 'Missing Stripe-Signature' }); return }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, getWebhookSecret())
  } catch (err) {
    res.status(400).json({ data: null, error: `Webhook signature verification failed: ${(err as Error).message}` })
    return
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.client_reference_id ?? session.metadata?.user_id
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
      if (!userId || !customerId || !subscriptionId) break

      const subscription = await getStripe().subscriptions.retrieve(subscriptionId)
      const periodEnd = currentPeriodEnd(subscription)
      await query(
        `update users set plan = 'premium', plan_expires_at = $1,
                stripe_customer_id = $2, stripe_subscription_id = $3
          where id = $4`,
        [periodEnd, customerId, subscriptionId, userId],
      )
      const user = await queryOne<{ email: string }>('select email from users where id = $1', [userId])
      await recordBillingEvent('billing.subscription_started', userId, { subscription: subscriptionId, period_end: periodEnd })
      if (user) {
        notifySubscriptionStarted({ email: user.email, periodEnd, trial: subscription.status === 'trialing' })
          .catch(() => {})
      }
      break
    }

    // Renewal (or a trial converting to its first paid period) — keep
    // plan_expires_at in sync with what Stripe actually charged for.
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const periodEnd = currentPeriodEnd(subscription)
      if (!periodEnd) break
      await query(
        `update users set plan_expires_at = $1
          where stripe_subscription_id = $2`,
        [periodEnd, subscription.id],
      )
      // The family pressed "cancel" in the billing portal: Stripe keeps the
      // subscription until the period ends and flips cancel_at_period_end.
      // Only the transition is news, not every later update that repeats it.
      const before = (event.data as { previous_attributes?: { cancel_at_period_end?: boolean } }).previous_attributes
      if (subscription.cancel_at_period_end && before?.cancel_at_period_end === false) {
        const user = await userBySubscription(subscription.id)
        if (user) {
          await recordBillingEvent('billing.cancel_scheduled', user.id, { subscription: subscription.id, ends_at: periodEnd })
          notifyCancelScheduled({ email: user.email, endsAt: periodEnd }).catch(() => {})
        }
      }
      break
    }

    // Cancelled (self-serve via the billing portal, or a failed-payment
    // dunning cycle that finally gave up) — lapse back to free immediately
    // rather than waiting for plan_expires_at to pass on its own.
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const user = await userBySubscription(subscription.id)
      await query(
        `update users set plan = 'free', plan_expires_at = null
          where stripe_subscription_id = $1`,
        [subscription.id],
      )
      if (user) {
        await recordBillingEvent('billing.subscription_ended', user.id, { subscription: subscription.id })
        notifySubscriptionEnded({ email: user.email }).catch(() => {})
      }
      break
    }

    // A charge failed (card declined/expired). Nothing changes here — Stripe
    // retries on its own schedule and sends customer.subscription.deleted if
    // it finally gives up — but the operator should know a family is at risk.
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
      if (!customerId) break
      const user = await queryOne<{ id: string; email: string }>(
        'select id, email from users where stripe_customer_id = $1', [customerId])
      if (!user) break
      await recordBillingEvent('billing.payment_failed', user.id, { invoice: invoice.id, attempt: invoice.attempt_count })
      notifyPaymentFailed({
        email: user.email,
        amountCents: invoice.amount_due ?? null,
        currency: invoice.currency ?? null,
        attempt: invoice.attempt_count ?? null,
      }).catch(() => {})
      break
    }

    default:
      break
  }

  res.json({ received: true })
}))

async function userBySubscription(subscriptionId: string) {
  return queryOne<{ id: string; email: string }>(
    'select id, email from users where stripe_subscription_id = $1', [subscriptionId])
}

/** Billing events go into audit_log (actor 'stripe-webhook') so the admin
 *  reports and the daily summary can count subscriptions, cancellations and
 *  failed payments without calling Stripe. Best-effort: a failed insert must
 *  not make Stripe retry an event whose real work already succeeded. */
async function recordBillingEvent(action: string, userId: string, detail: Record<string, unknown>) {
  await logAudit('stripe-webhook', action, 'user', userId, detail)
}

/** Stripe's subscription current_period_end lives on the subscription's
 *  first (and, for this single-price plan, only) item — not on the
 *  subscription object itself as of the 2025-ish API versions this SDK
 *  targets. Falls back to null (caller then leaves plan_expires_at alone)
 *  rather than throwing on a shape this doesn't recognise. */
function currentPeriodEnd(subscription: Stripe.Subscription): string | null {
  const item = subscription.items.data[0]
  const unixSeconds = item?.current_period_end
  return typeof unixSeconds === 'number' ? new Date(unixSeconds * 1000).toISOString() : null
}

export default router
