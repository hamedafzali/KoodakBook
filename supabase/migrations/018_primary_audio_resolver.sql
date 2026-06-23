-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 018: primary-audio resolver
--
-- Reader-side cutover for audio_assets (mig-017). Curriculum endpoints now
-- override each entity's legacy *.audio_url with the PRIMARY audio_asset, so a
-- later native recording (inserted with is_primary=true, flipping the TTS row
-- off) is served automatically with no code change — the TTS→native hot-swap.
--
-- Today audio_assets mirrors the legacy *.audio_url (backfilled as source='tts'),
-- so this is a no-op until a native take exists. The partial unique index
-- idx_audio_assets_primary guarantees at most one primary per (entity, locale).
-- ═══════════════════════════════════════════════════════════

create or replace function primary_audio(_entity_type text, _entity_id uuid, _locale text default 'fa')
returns text
language sql
stable
as $$
  select url from audio_assets
  where entity_type = _entity_type and entity_id = _entity_id and locale = _locale and is_primary
  limit 1
$$;
