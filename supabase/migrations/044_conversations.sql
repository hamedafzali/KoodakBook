-- KoodakBook — Migration 044: character conversations (plan §4, V2)
--
-- Every turn is logged: parents get a reviewable transcript (trust feature),
-- we get tuning data, and the daily cap counts against it. Quality is never
-- tiered — plans differ in TURNS per day (same model as AI stories).

create table if not exists conversations (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references children(id) on delete cascade,
  character_id uuid not null references characters(id) on delete cascade,
  role         text not null check (role in ('child', 'character')),
  text         text not null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_conversations_child on conversations (child_id, created_at desc);

-- Daily turn caps (child turns/day). No row = unlimited (family & yearly).
insert into plan_features (plan_id, feature_key, value)
select p.id, 'conversations_per_day', v.n from plans p
join (values ('free', '10'), ('premium_solo', '50'), ('premium_duo', '100')) as v(key, n)
  on p.key = v.key
on conflict (plan_id, feature_key) do update set value = excluded.value;
