-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 053: story cover review queue
--
-- Mirrors migration 050 (word image review queue), applied to stories.cover_url
-- instead of words.image_url. Unlike words/story_pages, stories has no existing
-- review-status column to reuse (animation_review is a story_pages/words concept
-- for per-page illustration+animation, not covers), so this adds a new
-- cover_review status column alongside the candidate/note/reviewed-at columns.
--
--   cover_review          queue status: 'none' (no candidate yet), 'pending'
--                         (candidate awaiting a human decision), 'approved',
--                         'rejected'. Same four values as animation_review for
--                         consistency across the two review queues.
--   cover_candidate_url   where an uploaded-but-unapproved cover parks. NOTHING
--                         reads this on the child/parent side. Approval is the
--                         only path that copies it into cover_url.
--   cover_review_note     why a human rejected it (required on reject).
--   cover_reviewed_at     when the human clicked, for queue bookkeeping.
--
-- The invariant this encodes: cover_url is the PUBLISHED field and is only
-- ever written by an explicit human approve. A generator can fill
-- cover_candidate_url all day and no one sees anything on the story card.
-- ═══════════════════════════════════════════════════════════

alter table stories add column if not exists cover_review        text not null default 'none';
alter table stories add column if not exists cover_candidate_url text;
alter table stories add column if not exists cover_review_note   text;
alter table stories add column if not exists cover_reviewed_at   timestamptz;

alter table stories drop constraint if exists stories_cover_review_check;
alter table stories add constraint stories_cover_review_check
  check (cover_review in ('none','pending','approved','rejected'));

create index if not exists idx_stories_cover_candidate
  on stories (cover_review)
  where cover_candidate_url is not null;
