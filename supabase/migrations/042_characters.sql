-- KoodakBook — Migration 042: interactive character system, V1
-- (docs/character-system-plan.md — data-driven characters; adding one must
-- never require code: a row + a voice id + an asset + a regen click.)

create table if not exists characters (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name_persian  text not null,
  type          text not null check (type in ('child', 'animal', 'fantasy')),
  personality   text not null default '',
  age_band      int  not null default 1 check (age_band between 1 and 3),
  level         int  not null default 1 check (level between 1 and 4),
  voice_engine  text not null default 'elevenlabs',
  voice_id      text not null default '',
  animation     jsonb not null default '{}'::jsonb,   -- {engine:'svg'|'rive', asset, states}
  topics        text[] not null default '{}',          -- word categories
  teaching_role text not null default 'vocabulary',
  home_scene    text not null default 'garden',        -- scene-library slug
  system_prompt text not null default '',              -- V2 conversation card (server-only)
  is_active     boolean not null default true,
  sort          int not null default 0
);

create table if not exists character_lines (
  id           uuid primary key default gen_random_uuid(),
  character_id uuid not null references characters(id) on delete cascade,
  trigger      text not null,          -- greeting | praise | retry | encourage | game_open | story_open | bye
  text_persian text not null,
  audio_url    text,                   -- generated with the character's own voice
  emotion      text not null default 'happy'
);
create index if not exists idx_character_lines_char on character_lines (character_id, trigger);

-- ── Character #1: the Simorgh (the existing mascot, formalized) ──
insert into characters (slug, name_persian, type, personality, age_band, level, voice_id, topics, teaching_role, home_scene, sort)
values ('simorgh', 'سیمرغ', 'fantasy', 'مهربان، دانا، آرام — قصه‌گوی پرنده‌های افسانه‌ای', 1, 1,
        'pFZP5JQG7iQjIQuC4Bku', '{}', 'stories', 'sky', 0)
on conflict (slug) do nothing;

-- ── Character #2: Roozi the fox — vocabulary teacher ──
insert into characters (slug, name_persian, type, personality, age_band, level, voice_id, topics, teaching_role, home_scene, sort)
values ('roozi', 'روزی روباهه', 'animal', 'بامزه، کنجکاو، صبور — عاشق کلمه‌های تازه', 1, 1,
        'pFZP5JQG7iQjIQuC4Bku', '{animals,colors,family,food}', 'vocabulary', 'forest', 1)
on conflict (slug) do nothing;

-- ── Scripted lines (audio generates later with each character's voice) ──
insert into character_lines (character_id, trigger, text_persian, emotion)
select c.id, v.t, v.txt, v.e from characters c,
(values
  ('greeting',  'سلام کوچولو! من سیمرغم، پرنده‌ی قصه‌ها! بیا با هم قصه بخوانیم!', 'happy'),
  ('praise',    'آفرین! تو فوق‌العاده‌ای!', 'excited'),
  ('retry',     'اشکالی نداره! یک بار دیگه امتحان کن!', 'encouraging'),
  ('encourage', 'تو می‌تونی! من بهت ایمان دارم!', 'encouraging'),
  ('story_open','گوش کن... قصه‌ی امروز شروع می‌شود!', 'happy'),
  ('bye',       'خداحافظ! فردا منتظرتم!', 'happy')
) as v(t, txt, e)
where c.slug = 'simorgh'
  and not exists (select 1 from character_lines l where l.character_id = c.id);

insert into character_lines (character_id, trigger, text_persian, emotion)
select c.id, v.t, v.txt, v.e from characters c,
(values
  ('greeting',  'سلام! من روزی‌ام، روباه بامزه! می‌خوای با هم کلمه یاد بگیریم؟', 'excited'),
  ('praise',    'ایول! چه باهوشی!', 'excited'),
  ('praise',    'آفرین آفرین! درست گفتی!', 'happy'),
  ('retry',     'نزدیک بود! دوباره بگو!', 'encouraging'),
  ('encourage', 'یالا! تو از من زرنگ‌تری!', 'encouraging'),
  ('game_open', 'بیا بازی کنیم! من عاشق بازی‌ام!', 'excited'),
  ('bye',       'خداحافظ رفیق! بازم بیا پیشم!', 'happy')
) as v(t, txt, e)
where c.slug = 'roozi'
  and not exists (select 1 from character_lines l where l.character_id = c.id);
