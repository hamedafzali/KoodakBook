-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 051: repeated-failure detection (frustration loop)
--
-- The expert review flagged repeated-failure churn as the single biggest
-- engagement risk for 4-7 year olds: a child who misses the same word five
-- times gets nothing different today. child_word_progress tracks replay_count
-- (total interactions ever) but nothing about a MISS STREAK, so there is no
-- signal to react to.
--
-- ADDITIVE, single column, RECEPTIVE track only. The receptive/productive
-- split (mig-016) deliberately keeps the two tracks from touching each other's
-- schedule (BUG-A); consecutive_misses follows that same boundary rather than
-- crossing it, because the only consumer today is the receptive review queue
-- (routes/progress.ts GET /:child_id/review). A productive (speak/recall)
-- equivalent is future scope, not bundled in here.
-- ═══════════════════════════════════════════════════════════

alter table child_word_progress add column if not exists consecutive_misses int not null default 0;
