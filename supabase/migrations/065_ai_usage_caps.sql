-- KoodakBook — Migration 065: daily caps on the AI cost surfaces that had none
--
-- routes/ai.ts already caps story generation (ai_stories_per_day, backed by
-- counting today's `stories` rows) — that was verified, real, and working.
-- Two other AI-calling routes in the same file were found, by a direct code
-- read on 2026-09-17, to have NO cap at all:
--
--   POST /api/ai/stories/:id/translate — any authenticated user (free or
--   premium — this route has no plan check either) can call this repeatedly
--   for any story id / language pair. Missing translations are real LLM
--   calls; there is no per-user counter anywhere.
--
--   POST /api/ai/stories/:id/audio — regenerates TTS for every page of an
--   AI story on every call. lib/tts/index.ts's synthesizeStoryPages()
--   unconditionally re-synthesizes each page — it does not skip pages that
--   already have audio_url — so repeated calls burn real TTS cost with
--   nothing stopping them.
--
-- This table is a generic per-user daily counter for exactly these two
-- surfaces, same shape/spirit as ai_cap_hits (migration 060) but for actual
-- usage rather than cap-hit tracking. `amount` lets translate count PAGES
-- translated (proportional to real cost) in one row per call, rather than
-- needing one row per page.
create table if not exists ai_usage_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  kind       text not null check (kind in ('translate_pages', 'audio_regen')),
  amount     int not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_events_user_kind_day
  on ai_usage_events (user_id, kind, created_at);
