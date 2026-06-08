-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 006: Leitner spaced-repetition
-- Replace the "introduced more than N days ago" heuristic with real
-- Leitner boxes (1-5) and an explicit due date per word per child.
-- ═══════════════════════════════════════════════════════════

alter table child_word_progress add column if not exists box int not null default 1;
alter table child_word_progress add column if not exists due_at timestamptz;
alter table child_word_progress add column if not exists last_reviewed_at timestamptz;

-- Pull words due for review quickly.
create index if not exists idx_cwp_due on child_word_progress (child_id, due_at);

-- Backfill existing rows: seed a sensible box from current status, due now.
update child_word_progress
  set box = case status when 'mastered' then 5 when 'practiced' then 2 else 1 end
  where due_at is null;
update child_word_progress set due_at = now() where due_at is null;
