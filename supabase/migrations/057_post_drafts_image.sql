-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 057: post_drafts image attachment
--
-- Adds an optional image to a queued draft (a screenshot, a character
-- illustration) so a post isn't text-only. Stores a path under the backend's
-- own /uploads (same convention as words/letters media — see wordsF/letterRows
-- in routes/placement.ts), not an external URL: postToChannel() reads the
-- file and uploads its bytes straight to Telegram's sendPhoto, so a draft's
-- image works even before the app has a public domain (see WEB_URL note in
-- docs/telegram-approval-queue.md).
-- ═══════════════════════════════════════════════════════════

alter table post_drafts add column if not exists image_path text;
