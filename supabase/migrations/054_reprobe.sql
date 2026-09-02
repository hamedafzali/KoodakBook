-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 054: re-placement (reprobe)
--
-- See docs/re-placement-flow-design.md. Periodic re-placement appends to
-- placement_history exactly like onboarding placement does; this column lets
-- a reprobe snapshot be told apart from the original onboarding snapshot and
-- the one-time progression-rebuild migration snapshot (§3/§4 of the design).
-- No new table: gate_recompute_log (migration 049) already accepts a free-text
-- `trigger`, so 'reprobe' needs no schema change there — only this doc note:
-- trigger is now one of 'lesson' | 'story' | 'migration' | 'manual' | 'reprobe'.
-- ═══════════════════════════════════════════════════════════

alter table placement_history add column if not exists kind text not null default 'onboarding';
alter table placement_history add constraint placement_history_kind_check
  check (kind in ('onboarding', 'reprobe', 'migration'));
