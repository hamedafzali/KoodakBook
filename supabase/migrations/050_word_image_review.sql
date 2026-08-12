-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 050: word image review queue
--
-- Migration 014 added image_brief + animation_review to words and described
-- exactly this workflow: "a Claude-based generator drafts these values and a
-- human approves them before publish". This migration wires the last mile for
-- the IMAGE half of that pipeline — the batch generator (tools/word-images)
-- produces candidate art offline, uploads it here, and a human clicks approve
-- before any child sees it.
--
-- Deliberately reuses animation_review as the queue status rather than adding
-- a parallel column. Three columns are added, and none of them is a second
-- status field:
--
--   image_candidate_url   where an uploaded-but-unapproved image parks. NOTHING
--                         reads this on the child side. Approval is the only
--                         path that copies it into image_url.
--   image_review_note     why a human rejected it (required on reject, so the
--                         next generation pass has something to work from).
--   image_reviewed_at     when the human clicked, for queue bookkeeping.
--
-- The invariant this encodes: image_url is the PUBLISHED field and is only
-- ever written by an explicit human approve. A generator can fill
-- image_candidate_url all day and no child sees anything.
-- ═══════════════════════════════════════════════════════════

alter table words add column if not exists image_candidate_url text;
alter table words add column if not exists image_review_note    text;
alter table words add column if not exists image_reviewed_at    timestamptz;

-- The review queue lists words that have a candidate awaiting a human click.
-- Partial index: the queue is a small slice of the table and shrinks to zero
-- as the backlog is cleared.
create index if not exists idx_words_image_candidate
  on words (animation_review)
  where image_candidate_url is not null;
