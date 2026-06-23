-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 021: placement history (pilot literacy-gain)
--
-- child_strand_levels holds only the CURRENT levels (overwritten on each probe
-- / promotion). To measure literacy GAIN over a pilot (§11.5) we need pre/post
-- snapshots, so every placement-probe result is also appended here. Comparing a
-- child's first vs latest snapshot gives the gain.
-- ═══════════════════════════════════════════════════════════

create table if not exists placement_history (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references children(id) on delete cascade,
  level         int not null,
  strand_levels jsonb not null,
  taken_at      timestamptz not null default now()
);
create index if not exists idx_placement_history_child on placement_history (child_id, taken_at);
