-- KoodakBook — Migration 060: free→temp-premium unlock (re-engagement trial)
--
-- Growth mechanic: a free-plan family that hits its daily AI-story cap on
-- several distinct days is clearly bumping against the free tier's real
-- limit — the moment to show them what premium feels like, not just tell
-- them. Reuses users.plan / plan_expires_at (isPremiumActive() already
-- treats an expired grant as a lapse back to free — no new gating logic).
--
-- ai_cap_hits: one row per (user, calendar day) they were blocked by the
-- daily cap. Idempotent per day so repeated requests same day don't
-- over-count the streak.
create table if not exists ai_cap_hits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  hit_date   date not null,
  created_at timestamptz not null default now(),
  unique (user_id, hit_date)
);

create index if not exists idx_ai_cap_hits_user on ai_cap_hits (user_id);

-- temp_premium_grants: audit trail of every trial we've granted — lets us
-- both cap re-grants (once per 90 days, see lib/tempPremiumTrial.ts) and
-- later measure whether a trial actually converts to a paid plan.
create table if not exists temp_premium_grants (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  plan_key   text not null,
  reason     text not null default 'ai_cap_streak',
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_temp_premium_grants_user on temp_premium_grants (user_id, granted_at desc);
