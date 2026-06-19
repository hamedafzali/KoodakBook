-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 014: animation foundation (Phase 0)
--
-- Makes animations DATA, not code. Each content row carries which reusable
-- template renders it (animation_template) and its typed parameters
-- (animation_params jsonb). Stories carry a per-page scene_plan. Image briefs
-- live alongside as image_brief jsonb so the art pipeline has a spec to work
-- from.
--
-- The workflow columns (animation_review / engine_version / model) are added
-- now but unused until the final phase, where a Claude-based generator drafts
-- these values and a human approves them before publish. Until then they are
-- authored by hand in the admin panel.
--
-- The template registry + param shapes live in packages/shared/src/animation.ts
-- (one source of truth for admin, runtime renderer, and the future generator).
-- ═══════════════════════════════════════════════════════════

-- ── Words ─────────────────────────────────────────────────
alter table words add column if not exists animation_template   text;
alter table words add column if not exists animation_params     jsonb not null default '{}'::jsonb;
alter table words add column if not exists image_brief          jsonb;
alter table words add column if not exists animation_review     text not null default 'pending';
alter table words add column if not exists animation_engine_version int;
alter table words add column if not exists animation_model      text;

alter table words drop constraint if exists words_animation_review_check;
alter table words add constraint words_animation_review_check
  check (animation_review in ('pending','approved','rejected','none'));

-- ── Letters (always the letter-draw template) ─────────────
alter table letters add column if not exists animation_template text default 'letter';
alter table letters add column if not exists animation_params   jsonb not null default '{}'::jsonb;

-- ── Badges (always the reward template) ───────────────────
alter table badges add column if not exists animation_template text default 'reward';
alter table badges add column if not exists animation_params   jsonb not null default '{}'::jsonb;

-- ── Story pages (per-page scene plan) ─────────────────────
alter table story_pages add column if not exists scene_plan        jsonb;
alter table story_pages add column if not exists animation_review  text not null default 'pending';
alter table story_pages add column if not exists animation_engine_version int;
alter table story_pages add column if not exists animation_model   text;

alter table story_pages drop constraint if exists story_pages_animation_review_check;
alter table story_pages add constraint story_pages_animation_review_check
  check (animation_review in ('pending','approved','rejected','none'));

-- Index the review queue so the admin panel can list rows awaiting approval.
create index if not exists idx_words_animation_review       on words (animation_review);
create index if not exists idx_story_pages_animation_review on story_pages (animation_review);
