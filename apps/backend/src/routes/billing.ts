import { Router } from 'express'
import { queryOne } from '../lib/db'
import { requireAuth } from '../middleware/auth'
import { asyncHandler } from '../lib/asyncHandler'
import { getStripe, getPremiumPriceId, isBillingConfigured } from '../lib/billing'

const router = Router()
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000'

/* Checkout + billing-portal — the two authenticated, JSON billing endpoints.
 * Mounted at /api/billing AFTER express.json() in index.ts, same as every
 * other route. The webhook (routes/billingWebhook.ts) is the one billing
 * route that is NOT here: it needs the raw body for signature verification,
 * so it's mounted separately, before express.json() runs. */

function notConfigured(res: import('express').Response) {
  res.status(503).json({ data: null, error: 'پرداخت هنوز فعال نشده' })
}

// GET /api/billing/status — unauthenticated, cheap: lets the frontend show
// "به‌زودی" vs a real button without guessing from `purchasable` alone (a
// plan can be marked purchasable in the admin panel before the Stripe keys
// are actually live, and this catches that gap instead of erroring at click time).
router.get('/status', (_req, res) => {
  res.json({ data: { configured: isBillingConfigured() }, error: null })
})

// POST /api/billing/checkout — start a subscription checkout for the one
// paid plan (premium: €9.99/mo, up to 5 children), 14-day trial, card
// required upfront (path-and-plans recommendation). Returns a Stripe-hosted
// URL; the frontend just redirects to it — no card details ever touch this
// server, which is the whole point of Stripe Checkout over a custom form.
router.post('/checkout', requireAuth, asyncHandler(async (req, res) => {
  if (!isBillingConfigured()) { notConfigured(res); return }

  const user = await queryOne<{ id: string; email: string; stripe_customer_id: string | null }>(
    'select id, email, stripe_customer_id from users where id = $1',
    [res.locals.userId],
  )
  if (!user) { res.status(404).json({ data: null, error: 'Not found' }); return }

  const stripe = getStripe()
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: getPremiumPriceId(), quantity: 1 }],
    subscription_data: { trial_period_days: 14 },
    // Correlates the webhook back to this user without trusting anything
    // the client sends at redirect time (Stripe sets these server-side).
    client_reference_id: user.id,
    metadata: { user_id: user.id },
    ...(user.stripe_customer_id
      ? { customer: user.stripe_customer_id }
      : { customer_email: user.email }),
    success_url: `${WEB_URL}/parent/plan?checkout=success`,
    cancel_url: `${WEB_URL}/parent/plan?checkout=cancel`,
  })
  if (!session.url) { res.status(502).json({ data: null, error: 'Stripe did not return a checkout URL' }); return }
  res.json({ data: { url: session.url }, error: null })
}))

// POST /api/billing/portal — Stripe's hosted subscription-management page
// (cancel, update card, view invoices). A subscriber must be able to cancel
// their own plan without emailing support; Stripe's portal is one API call
// and covers that entirely.
router.post('/portal', requireAuth, asyncHandler(async (req, res) => {
  if (!isBillingConfigured()) { notConfigured(res); return }

  const user = await queryOne<{ stripe_customer_id: string | null }>(
    'select stripe_customer_id from users where id = $1',
    [res.locals.userId],
  )
  if (!user?.stripe_customer_id) {
    res.status(404).json({ data: null, error: 'اشتراکی برای مدیریت وجود ندارد' })
    return
  }

  const stripe = getStripe()
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${WEB_URL}/parent/plan`,
  })
  res.json({ data: { url: session.url }, error: null })
}))

export default router
