-- KoodakBook — Migration 043: character roster expansion
--
-- A roster to audition (per product direction): different types and teaching
-- roles; the "main character" gets chosen later — that's just sort order (or
-- a rename) in admin, never code. New character = row + lines + one SVG.

-- آوا — a Persian child, the speaking buddy («آوا» = voice/sound — fitting).
insert into characters (slug, name_persian, type, personality, age_band, level, voice_id, topics, teaching_role, home_scene, sort)
values ('ava', 'آوا', 'child', 'پرانرژی، مهربان، پرحرف — عاشق حرف زدن و آواز', 2, 1,
        'pFZP5JQG7iQjIQuC4Bku', '{greetings,family,feelings}', 'conversation', 'home', 2)
on conflict (slug) do nothing;

-- پشمک — a fluffy cat, the phonics teacher (sharp ears hear every sound).
insert into characters (slug, name_persian, type, personality, age_band, level, voice_id, topics, teaching_role, home_scene, sort)
values ('pashmak', 'پشمک', 'animal', 'نرم و ملوس، بازیگوش، تیزگوش — صداها را از همه بهتر می‌شنود', 1, 1,
        'pFZP5JQG7iQjIQuC4Bku', '{animals,body}', 'phonics', 'room', 3)
on conflict (slug) do nothing;

-- لاکی — the tortoise from خرگوش و لاک‌پشت, the numbers teacher (آهسته و پیوسته).
insert into characters (slug, name_persian, type, personality, age_band, level, voice_id, topics, teaching_role, home_scene, sort)
values ('laki', 'لاکی', 'animal', 'آرام، صبور، مطمئن — قدم به قدم می‌شمارد و هیچ‌وقت تسلیم نمی‌شود', 1, 1,
        'pFZP5JQG7iQjIQuC4Bku', '{numbers,shapes}', 'math', 'sea', 4)
on conflict (slug) do nothing;

insert into character_lines (character_id, trigger, text_persian, emotion)
select c.id, v.t, v.txt, v.e from characters c,
(values
  ('greeting',  'سلام! من آوام! بیا با هم فارسی حرف بزنیم!', 'excited'),
  ('praise',    'وای! چه قشنگ گفتی!', 'excited'),
  ('retry',     'بیا یک بار دیگه با هم بگیم!', 'encouraging'),
  ('encourage', 'تو صدای خیلی قشنگی داری!', 'happy'),
  ('game_open', 'بیا با هم بازی کنیم! من و تو!', 'excited'),
  ('bye',       'می‌بینمت! به مامان و بابا سلام برسون!', 'happy')
) as v(t, txt, e)
where c.slug = 'ava'
  and not exists (select 1 from character_lines l where l.character_id = c.id);

insert into character_lines (character_id, trigger, text_persian, emotion)
select c.id, v.t, v.txt, v.e from characters c,
(values
  ('greeting',  'میو! من پشمکم! بیا با صداها بازی کنیم! بَ... بِ... بُ!', 'excited'),
  ('praise',    'میو میو! عالی بود!', 'excited'),
  ('retry',     'گوش کن... دوباره! گوش‌هات رو تیز کن!', 'encouraging'),
  ('encourage', 'گوش‌های من تیزه — تو هم می‌تونی!', 'happy'),
  ('game_open', 'بدو بدو! بازی شروع شد! میو!', 'excited'),
  ('bye',       'میو! فردا بیا پیشم!', 'happy')
) as v(t, txt, e)
where c.slug = 'pashmak'
  and not exists (select 1 from character_lines l where l.character_id = c.id);

insert into character_lines (character_id, trigger, text_persian, emotion)
select c.id, v.t, v.txt, v.e from characters c,
(values
  ('greeting',  'سلام! من لاکی‌ام! آهسته و پیوسته با هم می‌شماریم: یک... دو... سه!', 'happy'),
  ('praise',    'آفرین! قدم به قدم داری جلو می‌ری!', 'excited'),
  ('retry',     'عجله نکن! آروم آروم دوباره امتحان کن.', 'encouraging'),
  ('encourage', 'یادت باشه: آهسته و پیوسته برنده می‌شه!', 'encouraging'),
  ('game_open', 'بیا بشماریم! من عاشق عددهام!', 'happy'),
  ('bye',       'خداحافظ! لاک‌پشت‌ها هیچ‌وقت دوست‌هاشون رو فراموش نمی‌کنن.', 'happy')
) as v(t, txt, e)
where c.slug = 'laki'
  and not exists (select 1 from character_lines l where l.character_id = c.id);
