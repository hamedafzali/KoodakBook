-- KoodakBook — Migration 048: collapse audio to a single cloud tier (Piper removal)
--
-- Piper/Edge (the free sidecar) are removed. Audio quality was ALREADY served to
-- every account (AUDIO_QUALITY_FOR_ALL) via the premium engine/voice + the
-- audio_url_premium files, so folding the two tiers into one changes nothing a
-- child hears. What it removes is the free/premium SPLIT — so a sidecar ("free")
-- engine can never be configured back in. That makes the old TTS quality
-- inversion STRUCTURALLY impossible to recur; it was a separate, already-fixed
-- bug, and this is a guarantee against regression, not the fix itself.

-- 1. audio_sections: promote the premium engine/voice into the single columns,
--    drop the premium columns, and restrict engine to cloud-only.
update audio_sections
   set engine = coalesce(premium_engine, engine),
       voice  = coalesce(premium_voice, voice)
 where premium_engine is not null;
-- Any section still on a sidecar engine had no premium voice configured; point it
-- at the cloud default so its engine is valid. The operator sets the real voice id
-- in the admin Audio page — an empty/bad voice degrades to browser TTS, never to a
-- worse server voice, which is exactly the guarantee above.
update audio_sections set engine = 'elevenlabs' where engine in ('piper', 'edge');
alter table audio_sections drop constraint if exists audio_sections_engine_check;
alter table audio_sections add constraint audio_sections_engine_check
  check (engine in ('azure', 'openai', 'google', 'elevenlabs'));
alter table audio_sections alter column engine set default 'elevenlabs';
alter table audio_sections drop constraint if exists audio_sections_premium_engine_check;
alter table audio_sections drop column if exists premium_engine;
alter table audio_sections drop column if exists premium_voice;

-- 2. Content tables: fold the premium URL into the single audio_url. The premium
--    files stay on disk under /uploads/premium/… — only the column consolidates.
update words       set audio_url = audio_url_premium where audio_url_premium is not null;
update letters     set audio_url = audio_url_premium where audio_url_premium is not null;
update story_pages set audio_url = audio_url_premium where audio_url_premium is not null;
alter table words       drop column if exists audio_url_premium;
alter table letters     drop column if exists audio_url_premium;
alter table story_pages drop column if exists audio_url_premium;

-- 3. tts_settings: the sidecar (Piper) voice field is gone.
alter table tts_settings drop column if exists piper_voice;

-- 4. Characters: repoint any sidecar-configured character voice to the cloud
--    default ('elevenlabs' was already the column default). A stale voice_id just
--    degrades chat audio to browser TTS until the admin sets a real one.
update characters set voice_engine = 'elevenlabs' where voice_engine in ('piper', 'edge');

-- 5. Month-to-date TTS character metering (runaway-bill visibility). The alarm
--    that reads this is INERT until Phase 0 alerting lands — see lib/tts/meter.ts.
create table if not exists tts_usage_monthly (
  month   text primary key,        -- 'YYYY-MM'
  chars   bigint not null default 0,
  alerted boolean not null default false
);
