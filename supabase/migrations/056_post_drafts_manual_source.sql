-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 056: post_drafts 'manual' source
--
-- Adds a third `post_drafts.source` value for a human-written, one-off post
-- (e.g. a launch/invite announcement) that isn't produced by either existing
-- path — 'story_published' (an event) or 'ai_scheduled' (a generator run on
-- a schedule). Same queue, same approval step, same postToChannel() — only
-- the provenance tag differs. See docs/telegram-approval-queue.md.
-- ═══════════════════════════════════════════════════════════

alter table post_drafts drop constraint if exists post_drafts_source_check;
alter table post_drafts add constraint post_drafts_source_check
  check (source in ('story_published', 'ai_scheduled', 'manual'));
