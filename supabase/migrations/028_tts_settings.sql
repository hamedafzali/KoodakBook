-- KoodakBook — Migration 028: configurable text-to-speech (story audio)
-- Mirrors ai_settings: one config row, provider/voice selectable from the admin
-- panel. Used to synthesize audio for AI-generated story pages so بشنو plays a
-- real voice. The key is a separate env var, TTS_API_KEY.

create table if not exists tts_settings (
  id          int primary key default 1 check (id = 1),
  enabled     boolean not null default false,
  provider    text not null default 'openai'
                check (provider in ('openai', 'google', 'azure', 'elevenlabs')),
  base_url    text,                          -- openai-compatible endpoint
  model       text not null default 'tts-1', -- openai/elevenlabs model id
  voice       text not null default 'alloy', -- provider voice id/name
  language    text not null default 'fa-IR', -- google/azure language code
  region      text,                          -- azure region (e.g. westeurope)
  format      text not null default 'mp3',
  updated_at  timestamptz not null default now(),
  updated_by  text
);

insert into tts_settings (id) values (1) on conflict (id) do nothing;
