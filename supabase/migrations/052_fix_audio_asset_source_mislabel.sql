-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 052: fix audio_assets.source mislabeling
--
-- Bug: trg_sync_audio_* (mig-019) always inserts new primary audio_assets rows
-- with source='native', regardless of whether the write came from a genuine
-- admin-entered recording URL or from the bulk TTS regen pipeline
-- (regenerate.ts, adminAudio.ts /audio/word/:id). Both write paths touch
-- *.audio_url the same way, so the trigger can't tell them apart — only the
-- calling code knows. Result: content-readiness's "word_native" metric
-- (words_native 295/295) was reading as "100% human-recorded" when in fact
-- every single primary audio_assets row in production right now was created
-- by bulk/migration TTS writes (048_collapse_audio_single_tier + the AI story
-- synthesis pipeline) — zero genuine recordings exist.
--
-- Fix, two parts:
--  1. This migration backfills every existing 'native' row to 'tts', since we
--     have verified none of them are actually recordings.
--  2. regenerate.ts and adminAudio.ts now explicitly set source='tts' on the
--     row the trigger just created/promoted, instead of deleting it. Genuine
--     admin CRUD edits (admin.ts) still fall through to the trigger's
--     'native' default, since that's the only remaining write path — an
--     admin manually setting an audio_url is the closest available proxy for
--     "this is a real recording."
-- ═══════════════════════════════════════════════════════════

update audio_assets set source = 'tts'
  where source = 'native' and is_primary
    and entity_type in ('word', 'letter', 'story', 'story_page');
