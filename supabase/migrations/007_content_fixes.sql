-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 007: content corrections
-- - Standard-Iranian letter names (طاه→طا, ظاه→ظا) so TTS reads them cleanly
-- - Correct word categories (numbers/shapes/feelings/actions/greetings were
--   mislabeled as nature/objects/body)
-- ═══════════════════════════════════════════════════════════

update letters set name_persian = 'طا' where character = 'ط' and name_persian = 'طاه';
update letters set name_persian = 'ظا' where character = 'ظ' and name_persian = 'ظاه';

-- Widen the category check to admit the new themes before re-tagging rows.
alter table words drop constraint if exists words_category_check;
alter table words add constraint words_category_check check (category in (
  'animals','colors','family','food','body','nature','objects',
  'numbers','shapes','feelings','actions','greetings'
));

update words set category = 'numbers'
  where english in ('one','two','three','four','five','six','seven','eight','nine','ten');

update words set category = 'shapes'
  where english in ('circle','square','triangle','star','heart','rectangle');

update words set category = 'feelings'
  where english in ('happy','sad','tired','hungry','scared','laugh','cry','angry');

update words set category = 'actions'
  where english in ('eat','sleep','run','play','read','write','go','come','sit','stand');

update words set category = 'greetings'
  where english in ('hello','goodbye','thank you','yes','no','please');
