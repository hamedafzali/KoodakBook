-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 019: keep audio_assets in sync with *.audio_url
--
-- The curriculum/review readers now resolve audio via the PRIMARY audio_asset
-- (mig-018). Because mig-017 backfilled a primary 'tts' asset for every entity,
-- an admin edit to the legacy *.audio_url column would otherwise be ignored by
-- the resolver. This trigger mirrors any audio_url write (insert or update, on
-- words/letters/stories/story_pages) into audio_assets as the new primary, so
-- admin edits flow through with no per-handler code and the TTS→native hot-swap
-- works through the existing admin upload UI.
--
-- Note: `source` is informational only — the resolver picks by is_primary, not
-- source. Trigger-created rows default to 'native' (admin uploads are the
-- human-voice path). Bulk TTS-regeneration migrations should write audio_assets
-- directly if accurate provenance matters.
-- ═══════════════════════════════════════════════════════════

create or replace function sync_audio_asset() returns trigger
language plpgsql as $$
declare
  _etype text := TG_ARGV[0];
begin
  if NEW.audio_url is null or NEW.audio_url = '' then
    return NEW;
  end if;

  -- Demote any current primary that points at a different file.
  update audio_assets set is_primary = false
    where entity_type = _etype and entity_id = NEW.id and locale = 'fa'
      and is_primary and url is distinct from NEW.audio_url;

  -- Promote the row for this url, or insert it as the new primary.
  if exists (
    select 1 from audio_assets
    where entity_type = _etype and entity_id = NEW.id and locale = 'fa' and url = NEW.audio_url
  ) then
    update audio_assets set is_primary = true
      where entity_type = _etype and entity_id = NEW.id and locale = 'fa' and url = NEW.audio_url;
  else
    insert into audio_assets (entity_type, entity_id, locale, url, source, is_primary)
      values (_etype, NEW.id, 'fa', NEW.audio_url, 'native', true);
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_sync_audio_words       on words;
drop trigger if exists trg_sync_audio_letters     on letters;
drop trigger if exists trg_sync_audio_stories     on stories;
drop trigger if exists trg_sync_audio_story_pages on story_pages;

create trigger trg_sync_audio_words
  after insert or update of audio_url on words
  for each row execute function sync_audio_asset('word');

create trigger trg_sync_audio_letters
  after insert or update of audio_url on letters
  for each row execute function sync_audio_asset('letter');

create trigger trg_sync_audio_stories
  after insert or update of audio_url on stories
  for each row execute function sync_audio_asset('story');

create trigger trg_sync_audio_story_pages
  after insert or update of audio_url on story_pages
  for each row execute function sync_audio_asset('story_page');
