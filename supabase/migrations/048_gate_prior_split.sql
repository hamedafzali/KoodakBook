-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 048: gate / prior split (progression rebuild)
--
-- See docs/placement-progression-rebuild.md. child_strand_levels.level stops
-- being an ever-ratcheting "auto-promoted level" (BUG-C) and becomes a GATE that
-- is RECOMPUTED from mastery evidence each time — idempotent, and free to move
-- both up and down. The placement estimate is retained SEPARATELY as a decaying
-- PRIOR so a recompute can correct the gate without losing where the child was
-- first placed.
--
-- ADDITIVE / non-breaking: existing readers of child_strand_levels.level keep
-- working (it still holds the current per-strand level); they now read a gate
-- instead of a promoted level, but the shape and meaning for gating are the same.
-- ═══════════════════════════════════════════════════════════

-- ── Retained prior + admin-facing confidence ──────────────
alter table child_strand_levels add column if not exists prior_level int;
alter table child_strand_levels add column if not exists confidence  numeric;

-- Backfill the prior from the child's ORIGINAL placement snapshot where we have
-- one (mig-021 placement_history; earliest row per child = placement), else the
-- current level. For active children n is large, so the prior barely moves the
-- recomputed gate — this is best-effort recovery of the starting point, not a
-- precise reconstruction, and it deliberately does not try to be.
update child_strand_levels csl
set prior_level = coalesce((
  select (ph.strand_levels ->> csl.strand::text)::int
  from placement_history ph
  where ph.child_id = csl.child_id
    and ph.strand_levels ? csl.strand::text
  order by ph.taken_at asc
  limit 1
), csl.level)
where prior_level is null;

-- ── Gate-recompute audit trail (§3.3) ─────────────────────
-- One append-only row per strand per recompute, so the prior half-life k, the
-- mastery threshold, and the downward-damping cap can be TUNED against real gate
-- trajectories instead of guessed twice. gate_before/gate_after capture the
-- direction and magnitude of every move; `damped` flags a downward move that the
-- asymmetric cap clipped. Pilot-scoped — safe to prune once tuning settles.
create table if not exists gate_recompute_log (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references children(id) on delete cascade,
  strand       char(1) not null,
  at           timestamptz not null default now(),
  n            int not null,          -- scored interactions in the strand at recompute time
  prior        int not null,          -- the decaying placement prior
  demonstrated int not null,          -- level the mastery evidence supports
  w            numeric not null,      -- prior weight k/(k+n) that was applied
  k            numeric not null,      -- the k in force (so a later k change is legible in the trace)
  gate_before  int,                   -- gate before this recompute (null on first ever)
  gate_after   int not null,          -- gate after
  damped       boolean not null default false,
  trigger      text not null          -- 'lesson' | 'story' | 'migration' | 'manual'
);
create index if not exists idx_gate_recompute_child on gate_recompute_log (child_id, strand, at);
