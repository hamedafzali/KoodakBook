-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 055: Telegram post approval queue
--
-- See docs/telegram-approval-queue.md. Nothing reaches the public
-- @koodakbook_app channel without a human approving it here first — content
-- generation (story publish, AI-scheduled content) only ever inserts a row;
-- the review endpoint is the one place that calls Telegram's sendMessage.
-- Mirrors the story-cover review queue (migration 053) in shape: a status
-- enum reviewed by an admin, with a reason kept on rejection.
-- ═══════════════════════════════════════════════════════════

create table if not exists post_drafts (
  id          uuid primary key default gen_random_uuid(),
  -- What produced this draft. 'story_published' = the old auto-post-on-publish
  -- path, now routed through this queue instead. 'ai_scheduled' = the weekly
  -- tip / word roundup / holiday content generator (scripts/generatePostDrafts.ts).
  source      text not null check (source in ('story_published', 'ai_scheduled')),
  source_ref  text,               -- e.g. story id, or the scheduled-content kind — traceability only
  text        text not null,      -- rendered message body, ready to post as-is
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,               -- admin email
  review_note text,               -- required on reject; optional context on approve
  posted_at   timestamptz,        -- set only once sendMessage actually succeeds
  post_result text                -- last send attempt's outcome/error, for a retry to show why
);

create index if not exists idx_post_drafts_status on post_drafts (status, created_at desc);
