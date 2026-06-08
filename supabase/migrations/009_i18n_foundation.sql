-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 009: language-agnostic content foundation
--
-- The content model is currently bilingual-hardcoded (words.persian/english/
-- finglish, letters.name_persian/english, stories.title_persian/english,
-- story_pages.text_persian/english). That blocks adding a second heritage
-- language without an expensive rewrite.
--
-- This migration is ADDITIVE and REVERSIBLE: it introduces a generalized
-- translations model ALONGSIDE the existing columns and backfills it. Nothing
-- reads it yet, so the running app is unaffected. The cutover (rewire readers
-- → writers → drop old columns) is a separate, reviewed phase — see
-- docs/i18n-plan.md. Do NOT drop the old columns here.
-- ═══════════════════════════════════════════════════════════

-- Language + script direction as first-class data (RTL/LTR per locale).
create table if not exists locales (
  code      text primary key,                 -- BCP-47: 'fa', 'en', 'fa-Latn', future 'ar','hi','hy'
  name      text not null,
  direction text not null default 'ltr' check (direction in ('ltr', 'rtl'))
);

insert into locales (code, name, direction) values
  ('fa',      'Persian',          'rtl'),
  ('fa-Latn', 'Persian (Latin)',  'ltr'),   -- finglish
  ('en',      'English',          'ltr')
on conflict (code) do nothing;

-- One row per (entity, locale, field). entity_id is a loose FK (entity_type
-- disambiguates the table) so a single table covers words/letters/stories/pages.
create table if not exists content_translations (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('word', 'letter', 'story', 'story_page')),
  entity_id   uuid not null,
  locale      text not null references locales(code),
  field       text not null,                  -- 'text' | 'name' | 'title'
  value       text not null,
  unique (entity_type, entity_id, locale, field)
);
create index if not exists idx_content_tx_entity on content_translations (entity_type, entity_id);
create index if not exists idx_content_tx_locale on content_translations (locale);

-- ── Backfill from existing bilingual columns (idempotent) ──────────────────
insert into content_translations (entity_type, entity_id, locale, field, value)
  select 'word', id, 'fa', 'text', persian from words
on conflict do nothing;
insert into content_translations (entity_type, entity_id, locale, field, value)
  select 'word', id, 'en', 'text', english from words
on conflict do nothing;
insert into content_translations (entity_type, entity_id, locale, field, value)
  select 'word', id, 'fa-Latn', 'text', finglish from words where finglish is not null and finglish <> ''
on conflict do nothing;

insert into content_translations (entity_type, entity_id, locale, field, value)
  select 'letter', id, 'fa', 'name', name_persian from letters
on conflict do nothing;
insert into content_translations (entity_type, entity_id, locale, field, value)
  select 'letter', id, 'en', 'name', name_english from letters
on conflict do nothing;

insert into content_translations (entity_type, entity_id, locale, field, value)
  select 'story', id, 'fa', 'title', title_persian from stories
on conflict do nothing;
insert into content_translations (entity_type, entity_id, locale, field, value)
  select 'story', id, 'en', 'title', title_english from stories
on conflict do nothing;

insert into content_translations (entity_type, entity_id, locale, field, value)
  select 'story_page', id, 'fa', 'text', text_persian from story_pages
on conflict do nothing;
insert into content_translations (entity_type, entity_id, locale, field, value)
  select 'story_page', id, 'en', 'text', text_english from story_pages where text_english is not null and text_english <> ''
on conflict do nothing;
