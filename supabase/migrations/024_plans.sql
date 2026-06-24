-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 024: plans & entitlements
--
-- Replaces the hardcoded free|premium boolean with a real plans system
-- (docs/admin-capabilities-plan.md, Phase 4). Plans carry back-end entitlements
-- (features + limits); users.plan continues to hold the plan KEY for back-compat.
-- Per SaaS best practice: plans = entitlements, tiers = the customer view.
-- ═══════════════════════════════════════════════════════════

create table if not exists plans (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  name        text not null,
  description text,
  price_cents int not null default 0,
  currency    text not null default 'EUR',
  interval    text not null default 'month' check (interval in ('month', 'year', 'none')),
  trial_days  int not null default 0,
  is_active   boolean not null default true,
  is_default  boolean not null default false,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists plan_features (
  plan_id     uuid references plans(id) on delete cascade,
  feature_key text not null,
  value       text not null default 'true',
  primary key (plan_id, feature_key)
);

-- ── Seed the two existing tiers ───────────────────────────
insert into plans (key, name, description, price_cents, interval, is_default, sort) values
  ('free',    'رایگان',  'دسترسی پایه — چند داستان اول',   0,   'none',  true,  0),
  ('premium', 'پرمیوم', 'دسترسی کامل + داستان‌های شخصی', 999, 'month', false, 1)
on conflict (key) do nothing;

insert into plan_features (plan_id, feature_key, value)
  select p.id, t.k, t.v from plans p
  cross join (values
    ('max_children','1'),('full_story_library','false'),('ai_stories','false'),
    ('co_read','false'),('record_voice','false')
  ) as t(k, v) where p.key = 'free'
on conflict do nothing;

insert into plan_features (plan_id, feature_key, value)
  select p.id, t.k, t.v from plans p
  cross join (values
    ('max_children','5'),('full_story_library','true'),('ai_stories','true'),
    ('co_read','true'),('record_voice','true')
  ) as t(k, v) where p.key = 'premium'
on conflict do nothing;
