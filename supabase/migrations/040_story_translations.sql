-- KoodakBook — Migration 040: multi-language story translations
--
-- Story pages carried a single English translation (text_english). Diaspora
-- families live across German, Dutch, Swedish, French… so translations become
-- a per-language map, filled on demand by the AI provider and cached here.
-- The parent picks the family's language; the child never sees a toggle.
alter table story_pages add column if not exists translations jsonb not null default '{}'::jsonb;

-- Seed English from the existing column so nothing regresses.
update story_pages
   set translations = jsonb_build_object('en', text_english)
 where text_english is not null and text_english <> '' and not (translations ? 'en');
