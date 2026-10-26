-- KoodakBook — Migration 069: disambiguate near-duplicate words
--
-- Migration 035 (content wave 1) added three words whose Persian spelling was
-- already in the word bank, each meaning (almost) the same thing as the
-- existing word:
--
--   آفتاب  sunshine  (weather)   — same as آفتاب "sun" (nature); the weather
--                                  lesson already teaches آفتابی "sunny"
--   کلاس   classroom (school)    — same as کلاس "class" (school)
--   روشن   bright    (opposites) — same as روشن "light" (opposites)
--
-- None of them is in a lesson. They surfaced as the same word twice in games,
-- review and the public word pages. Decision (2026-10-26): keep both rows (no
-- child's progress is touched) but give each duplicate its own Persian word:
--
--   sunshine  → نور خورشید  (noor-e khorshid)
--   classroom → کلاس درس    (kelas-e dars)
--   bright    → درخشان      (derakhshan)
--
-- قلب "heart (shape)" / "heart (body)" and نه "no" / "nine" are real
-- homographs (one spelling, two meanings) and stay as they are.
--
-- Matched on (persian, english, category), not id: ids differ per database.
-- A recording made for the old spelling would now say the wrong word, so the
-- renamed rows drop their audio (audio_url and any primary audio_asset); the
-- admin audio regeneration fills them in again. Idempotent: a second run
-- finds no row with the old spelling.

create temporary table _renames (old_persian text, english text, category text, new_persian text, new_finglish text) on commit drop;
insert into _renames values
  ('آفتاب', 'sunshine',  'weather',   'نور خورشید', 'noor-e khorshid'),
  ('کلاس',  'classroom', 'school',    'کلاس درس',   'kelas-e dars'),
  ('روشن',  'bright',    'opposites', 'درخشان',     'derakhshan');

create temporary table _renamed on commit drop as
  select w.id, r.new_persian, r.new_finglish
    from words w join _renames r
      on w.persian = r.old_persian and w.english = r.english and w.category = r.category;

update audio_assets set is_primary = false
 where entity_type = 'word' and entity_id in (select id from _renamed) and is_primary;

update words w set persian = r.new_persian, finglish = r.new_finglish, audio_url = null, tts_text = null
  from _renamed r where w.id = r.id;

-- The i18n model (migration 009) mirrors the word's text per locale.
update content_translations ct set value = r.new_persian
  from _renamed r
 where ct.entity_type = 'word' and ct.entity_id = r.id and ct.locale = 'fa' and ct.field = 'text';
update content_translations ct set value = r.new_finglish
  from _renamed r
 where ct.entity_type = 'word' and ct.entity_id = r.id and ct.locale = 'fa-Latn' and ct.field = 'text';
