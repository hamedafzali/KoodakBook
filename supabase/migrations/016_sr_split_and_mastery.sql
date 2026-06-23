-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 016: receptive/productive SR split + mastery
--
-- Extends the Leitner engine (mig-006). One Leitner box conflates "recognises"
-- with "can produce", so we add a parallel PRODUCTIVE track (speak/recall) next
-- to the existing RECEPTIVE one, plus an explicit mastery state machine.
--
-- ADDITIVE / non-breaking: the legacy box / due_at / status columns stay
-- authoritative for current readers. The /word route now populates the new
-- columns IN PARALLEL (receptive mirrors legacy; productive advances on speak
-- attempts). A later phase rewires readers onto these columns — see
-- project.md §11.1. Until then nothing reads box_receptive/box_productive.
--
-- Mastery state machine (project.md §11.1):
--   introduced → practicing → mastered → consolidated
-- Productive performance ENRICHES mastery but never gates it (Persian ASR is
-- unreliable on iOS Safari — the loop must not stall on a tech limit).
-- ═══════════════════════════════════════════════════════════

-- ── Parallel Leitner tracks ───────────────────────────────
alter table child_word_progress add column if not exists box_receptive  int not null default 1;
alter table child_word_progress add column if not exists box_productive int;
alter table child_word_progress add column if not exists due_receptive  timestamptz;
alter table child_word_progress add column if not exists due_productive timestamptz;

-- ── Mastery state machine ─────────────────────────────────
alter table child_word_progress add column if not exists mastery text not null default 'introduced';

alter table child_word_progress drop constraint if exists child_word_progress_mastery_check;
alter table child_word_progress add constraint child_word_progress_mastery_check
  check (mastery in ('introduced', 'practicing', 'mastered', 'consolidated'));

-- Productive review queue (mirror of idx_cwp_due for the receptive track).
create index if not exists idx_cwp_due_productive on child_word_progress (child_id, due_productive);

-- ── Backfill ──────────────────────────────────────────────
-- Seed the receptive track from the existing single Leitner track.
update child_word_progress
  set box_receptive = box,
      due_receptive = due_at
  where due_receptive is null;

-- Map legacy status → the new mastery state.
update child_word_progress
  set mastery = case status
    when 'mastered'  then 'mastered'
    when 'practiced' then 'practicing'
    else 'introduced' end;
