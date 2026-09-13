-- KoodakBook — Migration 063: one paid plan + Stripe billing
--
-- Implements the "path and plans" recommendation (Claude Project doc
-- claude/enhancement-phases.md, Stage I): one free plan, one paid plan
-- (`premium`, €9.99/mo, up to 5 children), everything else hidden — not
-- deleted, per migration 034's own is_public/is_active split, which exists
-- exactly so a plan can stay assignable (premium_solo is still granted by
-- the temp-premium-trial growth mechanic, lib/tempPremiumTrial.ts) while
-- disappearing from the public catalogue.
--
-- Also adds the Stripe identifiers billing needs. Reuses users.plan /
-- plan_expires_at end-to-end (same pattern as migration 060's temp trials
-- and lib/tempPremiumTrial.ts) — no new gating path, no new "is premium"
-- check anywhere. The webhook handler (routes/billingWebhook.ts) is the
-- only thing that writes these new columns.

update plans set is_public = false
 where key in ('premium_solo', 'premium_duo', 'premium_yearly');

alter table users add column if not exists stripe_customer_id     text;
alter table users add column if not exists stripe_subscription_id text;

-- Not unique on customer_id: Stripe allows (and this app's own re-subscribe
-- flow can produce) more than one subscription per customer over time, but
-- at most one ACTIVE stripe_subscription_id should ever point at a given
-- user at once, which this enforces.
create unique index if not exists idx_users_stripe_subscription
  on users (stripe_subscription_id) where stripe_subscription_id is not null;

create index if not exists idx_users_stripe_customer
  on users (stripe_customer_id) where stripe_customer_id is not null;
