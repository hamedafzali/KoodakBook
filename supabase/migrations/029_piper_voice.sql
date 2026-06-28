-- KoodakBook — Migration 029: free-baseline (Piper) voice
-- Piper is the always-on, no-key Persian voice for AI stories (every account).
-- The cloud provider in tts_settings stays the premium upgrade (when enabled +
-- TTS_API_KEY is set). This column picks which Piper voice the baseline uses.

alter table tts_settings
  add column if not exists piper_voice text not null default 'fa_IR-amir-medium';
