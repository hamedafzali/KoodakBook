-- KoodakBook — Migration 046: roster expansion (3 new friends)
--
-- Same data-driven pattern as 042/043: a new character is a row + lines + one
-- SVG (added to CharacterAvatar, web + admin mirrors). voice_id reuses the
-- shared ElevenLabs voice; admin can retune per character later.

-- تندپا — the hare from «خرگوش و لاک‌پشت», the colors teacher (fast & playful,
-- the counterpart to لاکی's «آهسته و پیوسته»).
insert into characters (slug, name_persian, type, personality, age_band, level, voice_id, topics, teaching_role, home_scene, sort)
values ('tondpa', 'تندپا خرگوشه', 'animal', 'تندوتیز، شیطون، پرشور — عاشق دویدن و رنگ‌های روشن', 1, 1,
        'pFZP5JQG7iQjIQuC4Bku', '{colors,food}', 'colors', 'park', 5)
on conflict (slug) do nothing;

-- بومی — the wise owl, the letters/alphabet teacher (sees every letter clearly).
insert into characters (slug, name_persian, type, personality, age_band, level, voice_id, topics, teaching_role, home_scene, sort)
values ('boomi', 'بومی جغده', 'animal', 'دانا، آرام، صبور — حرف‌ها و صداها را از همه بهتر می‌شناسد', 2, 1,
        'pFZP5JQG7iQjIQuC4Bku', '{}', 'letters', 'forest', 6)
on conflict (slug) do nothing;

-- خرسی — the cuddly bear, the feelings teacher (warm, gentle, big hugs).
insert into characters (slug, name_persian, type, personality, age_band, level, voice_id, topics, teaching_role, home_scene, sort)
values ('khersi', 'خرسی', 'animal', 'مهربان، بغلی، آرام — به بچه‌ها کمک می‌کند حس‌هایشان را بشناسند', 1, 1,
        'pFZP5JQG7iQjIQuC4Bku', '{feelings,family}', 'feelings', 'mountain', 7)
on conflict (slug) do nothing;

insert into character_lines (character_id, trigger, text_persian, emotion)
select c.id, v.t, v.txt, v.e from characters c,
(values
  ('greeting',  'سلام! من تندپام، خرگوش تندوتیز! بیا رنگ‌ها رو یاد بگیریم: قرمز، آبی، زرد!', 'excited'),
  ('praise',    'وای چه سریع! آفرین!', 'excited'),
  ('retry',     'اشکالی نداره! یک کم آروم‌تر، دوباره امتحان کن!', 'encouraging'),
  ('encourage', 'تو هم مثل من تندوتیزی! ادامه بده!', 'happy'),
  ('game_open', 'بدو بریم بازی! کی زودتر می‌رسه؟', 'excited'),
  ('bye',       'خداحافظ! فردا مسابقه‌ی رنگ‌ها داریم!', 'happy')
) as v(t, txt, e)
where c.slug = 'tondpa'
  and not exists (select 1 from character_lines l where l.character_id = c.id);

insert into character_lines (character_id, trigger, text_persian, emotion)
select c.id, v.t, v.txt, v.e from characters c,
(values
  ('greeting',  'هو‌هو! من بومی‌ام، جغد دانا. بیا با هم حرف‌ها رو بشناسیم: الف، ب، پ...', 'happy'),
  ('praise',    'آفرین! خیلی باهوشی!', 'excited'),
  ('retry',     'اشکالی نداره! دوباره خوب گوش کن و بگو.', 'encouraging'),
  ('encourage', 'کم‌کم یاد می‌گیری — من مطمئنم!', 'encouraging'),
  ('game_open', 'بیا حرف‌ها رو پیدا کنیم! چشم‌هام تیزه!', 'happy'),
  ('bye',       'شب‌به‌خیر کوچولو! فردا باز هم حرف یاد می‌گیریم.', 'happy')
) as v(t, txt, e)
where c.slug = 'boomi'
  and not exists (select 1 from character_lines l where l.character_id = c.id);

insert into character_lines (character_id, trigger, text_persian, emotion)
select c.id, v.t, v.txt, v.e from characters c,
(values
  ('greeting',  'سلام! من خرسی‌ام، بغلی و مهربون. امروز چه حسی داری؟ خوشحالی یا ناراحت؟', 'happy'),
  ('praise',    'آفرین عزیزم! بهت افتخار می‌کنم!', 'excited'),
  ('retry',     'اشکالی نداره، من پیشتم. دوباره با هم بگیم.', 'encouraging'),
  ('encourage', 'هر حسی داشته باشی، من دوستت دارم!', 'encouraging'),
  ('game_open', 'بیا بازی کنیم! یه بغل بزرگ هم بهت بدهکارم!', 'happy'),
  ('bye',       'خداحافظ! یه بغل گرم تا فردا.', 'happy')
) as v(t, txt, e)
where c.slug = 'khersi'
  and not exists (select 1 from character_lines l where l.character_id = c.id);
