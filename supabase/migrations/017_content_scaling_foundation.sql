-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 017: content-scaling foundation
--
-- A typed content spine (content_items) and versioned audio (audio_assets) that
-- the hybrid AI+human production pipeline (project.md §11.2) builds on. Localised
-- TEXT continues to live in content_translations (mig-009); ART/animation in the
-- image_brief / animation_* columns (mig-014). This migration adds the STRUCTURE
-- (difficulty vectors, grapheme tags, prereq DAG) and AUDIO PROVENANCE.
--
-- ADDITIVE / non-breaking, in the discipline of mig-009 and mig-014: nothing
-- reads these tables yet. Readers cut over in a later phase. Backfills are
-- idempotent (guarded by NOT EXISTS) so re-running is safe.
-- ═══════════════════════════════════════════════════════════

-- ── Typed content spine ───────────────────────────────────
-- One row per teachable item, across all strands. legacy_table/legacy_id link
-- back to the current words/letters/stories rows during the dual-write phase.
create table if not exists content_items (
  id                uuid primary key default gen_random_uuid(),
  kind              text not null check (kind in ('word', 'letter', 'phoneme', 'sentence', 'story', 'exercise')),
  strand            char(1) check (strand in ('P', 'D', 'V', 'F', 'C')),
  difficulty        numeric,                  -- IRT-style, calibrated from pilot data
  graphemes         text[],                   -- for the controllable-text invariant
  phonemes          text[],
  frequency_rank    int,                      -- corpus frequency → teach order
  semantic_category text,
  cultural_tags     text[],
  prereq_item_ids   uuid[],                   -- DAG edges for unlock logic
  legacy_table      text,                     -- 'words' | 'letters' | 'stories'
  legacy_id         uuid,
  status            text not null default 'draft' check (status in ('draft', 'review', 'published')),
  created_at        timestamptz default now()
);
create index if not exists idx_content_items_kind   on content_items (kind);
create index if not exists idx_content_items_strand on content_items (strand);
create index if not exists idx_content_items_status on content_items (status);
create unique index if not exists idx_content_items_legacy on content_items (legacy_table, legacy_id);

-- ── Versioned audio with provenance ───────────────────────
-- Replaces the single *.audio_url column with rows that record source
-- (native vs tts) and voice, so a native take can hot-swap a TTS bootstrap.
create table if not exists audio_assets (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('word', 'letter', 'story', 'story_page')),
  entity_id   uuid not null,
  locale      text not null default 'fa' references locales(code),
  url         text not null,
  source      text not null default 'tts' check (source in ('native', 'tts')),
  voice       text,
  is_primary  boolean not null default true,
  created_at  timestamptz default now()
);
create index if not exists idx_audio_assets_entity on audio_assets (entity_type, entity_id);
-- At most one primary take per (entity, locale); a native insert flips the old one off.
create unique index if not exists idx_audio_assets_primary
  on audio_assets (entity_type, entity_id, locale) where is_primary;

-- ── Backfill content_items from existing content ──────────
insert into content_items (kind, strand, semantic_category, legacy_table, legacy_id, status)
  select 'word', 'V', w.category, 'words', w.id, 'published'
  from words w
  where not exists (select 1 from content_items c where c.legacy_table = 'words' and c.legacy_id = w.id);

insert into content_items (kind, strand, graphemes, legacy_table, legacy_id, status)
  select 'letter', 'D', array[l.character], 'letters', l.id, 'published'
  from letters l
  where not exists (select 1 from content_items c where c.legacy_table = 'letters' and c.legacy_id = l.id);

insert into content_items (kind, strand, legacy_table, legacy_id, status)
  select 'story', 'C', 'stories', s.id, 'published'
  from stories s
  where not exists (select 1 from content_items c where c.legacy_table = 'stories' and c.legacy_id = s.id);

-- ── Backfill audio_assets from existing audio_url columns ──
-- Current audio is neural TTS (mig-005/015, voice fa-IR-DilaraNeural); record it
-- as source='tts' so a later native take can supersede it as primary.
insert into audio_assets (entity_type, entity_id, locale, url, source, voice)
  select 'word', w.id, 'fa', w.audio_url, 'tts', 'fa-IR-DilaraNeural'
  from words w
  where w.audio_url is not null and w.audio_url <> ''
    and not exists (select 1 from audio_assets a where a.entity_type = 'word' and a.entity_id = w.id and a.locale = 'fa');

insert into audio_assets (entity_type, entity_id, locale, url, source, voice)
  select 'letter', l.id, 'fa', l.audio_url, 'tts', 'fa-IR-DilaraNeural'
  from letters l
  where l.audio_url is not null and l.audio_url <> ''
    and not exists (select 1 from audio_assets a where a.entity_type = 'letter' and a.entity_id = l.id and a.locale = 'fa');

insert into audio_assets (entity_type, entity_id, locale, url, source, voice)
  select 'story', s.id, 'fa', s.audio_url, 'tts', 'fa-IR-DilaraNeural'
  from stories s
  where s.audio_url is not null and s.audio_url <> ''
    and not exists (select 1 from audio_assets a where a.entity_type = 'story' and a.entity_id = s.id and a.locale = 'fa');

insert into audio_assets (entity_type, entity_id, locale, url, source, voice)
  select 'story_page', p.id, 'fa', p.audio_url, 'tts', 'fa-IR-DilaraNeural'
  from story_pages p
  where p.audio_url is not null and p.audio_url <> ''
    and not exists (select 1 from audio_assets a where a.entity_type = 'story_page' and a.entity_id = p.id and a.locale = 'fa');
