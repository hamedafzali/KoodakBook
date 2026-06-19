-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 011: content-quality fixes (from content audit)
--
-- Fixes data-integrity defects in the seeded vocabulary:
--   1. Transliteration (finglish) typos / inconsistencies
--   2. Part-of-speech mismatches (laughter/crying glossed as verbs)
--   3. Register error (نوزاد = clinical "newborn", not toddler "baby")
--   4. Collapsed kinship glosses — Persian distinguishes paternal vs maternal
--      uncle/aunt; the English gloss erased that heritage distinction
--   5. English "parent notes" for kinship terms (stored in the language-agnostic
--      content_translations model as field='note', locale='en')
--
-- Readers still use the legacy words.* columns, so we edit those AND re-sync
-- content_translations to keep the i18n model truthful (see migration 009).
--
-- Note on the نه homograph (نه = "no"/na AND "nine"/noh): both rows are valid
-- and distinct under unique(persian,english); each has its own id + audio_url.
-- Any tap-to-hear lookup MUST key on word id, never on the Persian string.
-- ═══════════════════════════════════════════════════════════

-- ── 1. Transliteration fixes ──────────────────────────────
update words set finglish = 'mooz'      where persian = 'موز'     and english = 'banana';
update words set finglish = 'khoshhal'  where persian = 'خوشحال'  and english = 'happy';
update words set finglish = 'tarside'   where persian = 'ترسیده'  and english = 'scared';
update words set finglish = 'ghahve-i'  where persian = 'قهوه‌ای' and english = 'brown';

-- ── 2. Part-of-speech fixes (these are nouns, not feeling-verbs) ──
update words set english = 'laughter' where persian = 'خنده' and english = 'laugh';
update words set english = 'crying'   where persian = 'گریه' and english = 'cry';

-- ── 3. Register fix ───────────────────────────────────────
-- نوزاد is clinical ("newborn/neonate"). Keep it but gloss it accurately;
-- the natural toddler word نی‌نی ("baby") is added in migration 012.
update words set english = 'newborn' where persian = 'نوزاد' and english = 'baby';

-- ── 4. Precise kinship glosses ────────────────────────────
update words set english = 'uncle (paternal)'      where persian = 'عمو';
update words set english = 'uncle (maternal)'       where persian = 'دایی';
update words set english = 'aunt (paternal)'        where persian = 'عمه';
update words set english = 'aunt (maternal)'        where persian = 'خاله';
update words set english = 'cousin (boy, paternal)' where persian = 'پسر عمو';

-- ── 5. Re-sync content_translations from the corrected legacy columns ──
update content_translations ct
set value = w.english
from words w
where ct.entity_type = 'word' and ct.entity_id = w.id
  and ct.locale = 'en' and ct.field = 'text'
  and ct.value <> w.english;

update content_translations ct
set value = w.finglish
from words w
where ct.entity_type = 'word' and ct.entity_id = w.id
  and ct.locale = 'fa-Latn' and ct.field = 'text'
  and w.finglish is not null and w.finglish <> ''
  and ct.value <> w.finglish;

-- ── 6. English parent notes for kinship terms ─────────────
-- Stored language-agnostically: entity 'word', locale 'en', field 'note'.
-- These let a non-Persian-reading parent explain why Persian has more family
-- words than English — turning a translation gap into a heritage moment.
insert into content_translations (entity_type, entity_id, locale, field, value)
select 'word', w.id, 'en', 'note', n.note
from words w
join (values
  ('عمو',     'Father''s brother. Persian uses different words for paternal and maternal uncles.'),
  ('دایی',    'Mother''s brother. Different from عمو (father''s brother) — a nice heritage detail.'),
  ('عمه',     'Father''s sister. Persian distinguishes paternal vs maternal aunts.'),
  ('خاله',    'Mother''s sister. Different from عمه (father''s sister).'),
  ('پسر عمو', 'Son of your father''s brother. Persian names each cousin by which side of the family.')
) as n(persian, note) on n.persian = w.persian
on conflict (entity_type, entity_id, locale, field) do nothing;
