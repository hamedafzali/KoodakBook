-- KoodakBook — Migration 038: two-tier audio (free + premium variants)
--
-- Each audio section may define an optional PREMIUM engine+voice (e.g.
-- ElevenLabs) besides its free one. The regen job then produces two files per
-- item: the free variant where it always lived, and the premium variant under
-- /uploads/premium/… . Content routes serve the premium URL to premium
-- accounts; free accounts never see it. AI stories keep choosing voice at
-- generation time (per family plan) — only curated content gets both files.
alter table audio_sections add column if not exists premium_engine text;
alter table audio_sections drop constraint if exists audio_sections_premium_engine_check;
alter table audio_sections add constraint audio_sections_premium_engine_check
  check (premium_engine is null or premium_engine in ('azure', 'openai', 'google', 'elevenlabs'));
alter table audio_sections add column if not exists premium_voice text;

alter table words       add column if not exists audio_url_premium text;
alter table letters     add column if not exists audio_url_premium text;
alter table story_pages add column if not exists audio_url_premium text;
