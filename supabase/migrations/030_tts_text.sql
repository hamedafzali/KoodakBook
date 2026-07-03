-- Pronunciation overrides for TTS.
--
-- Persian script omits short vowels, so TTS engines must guess them — wrong
-- for homographs (کرم = kerm/karam/…) and for bare letter names («ره» read as
-- the word "rah" instead of the letter "re"). tts_text holds a fully
-- diacritized (or respelled) form used ONLY for audio synthesis; the displayed
-- text stays undiacritized.
alter table words   add column if not exists tts_text text;
alter table letters add column if not exists tts_text text;

-- Backfill letter names with harakat so both Piper (eSpeak-ng) and Edge TTS
-- say the letter name, not a homograph word. Unambiguous names (جیم, دال, …)
-- need no override.
update letters set tts_text = v.t
from (values
  ('ا', 'اَلِف'),
  ('آ', 'اَلِف مَد'),
  ('ب', 'بِه'),
  ('پ', 'پِه'),
  ('ت', 'تِه'),
  ('ث', 'ثِه'),
  ('چ', 'چِه'),
  ('ح', 'حِه'),
  ('خ', 'خِه'),
  ('ر', 'رِه'),
  ('ز', 'زِه'),
  ('ژ', 'ژِه'),
  ('ف', 'فِه'),
  ('ه', 'هِه'),
  ('ی', 'یِه')
) as v(c, t)
where letters.character = v.c and letters.tts_text is null;
