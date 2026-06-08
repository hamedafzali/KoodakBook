-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 008: account plan / entitlements
-- Foundation for monetization. Every account is 'free' until upgraded.
-- Premium gating reads this column; billing integration sets it later.
-- ═══════════════════════════════════════════════════════════

alter table users add column if not exists plan text not null default 'free'
  check (plan in ('free', 'premium'));

-- Optional expiry for time-bound (e.g. grandparent gift) subscriptions.
alter table users add column if not exists plan_expires_at timestamptz;
