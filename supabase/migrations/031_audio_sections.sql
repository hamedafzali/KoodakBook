-- KoodakBook — Migration 031: per-section audio voices
--
-- Each content section (stories, letters, words, phonics) picks its own TTS
-- engine + voice. Persian TTS quality differs sharply by engine AND by content:
-- an engine that reads stories well can butcher isolated letter names, so one
-- global voice (tts_settings.piper_voice) is not enough.
create table if not exists audio_sections (
  section    text primary key check (section in ('story', 'letter', 'word', 'phonics')),
  engine     text not null default 'piper'
               check (engine in ('piper', 'edge', 'azure', 'openai', 'google', 'elevenlabs')),
  voice      text not null default 'fa_IR-amir-medium',
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into audio_sections (section) values ('story'), ('letter'), ('word'), ('phonics')
on conflict (section) do nothing;

-- Adopt the currently configured free voice so nothing changes at migration
-- time (Edge ids use "fa-IR-", Piper ids "fa_IR-").
update audio_sections
   set engine = case when t.piper_voice like 'fa-IR-%' then 'edge' else 'piper' end,
       voice  = t.piper_voice
  from tts_settings t
 where t.id = 1;
