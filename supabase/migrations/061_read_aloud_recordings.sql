-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 061: read-aloud recordings
--
-- The north-star event ("child reads a story aloud to a grandparent") has had
-- no data behind it. This is the RECORD-ONLY half: the child records, the
-- parent listens. Delivery to a grandparent, and any reply, is deliberately
-- not in this migration — see docs/read-aloud.md.
--
-- This is the first time the product stores a child's voice, so two things
-- that no other table in this schema has are mandatory here:
--
--   1. CONSENT. `users.read_aloud_consent_at` is null until the parent turns
--      recording on. The API refuses to store audio without it. Consent is
--      per-parent-account rather than per-child because it is a legal act by
--      the account holder, not a per-child preference.
--
--   2. EXPIRY. Every row carries `expires_at`, set by the API, never null.
--      A recording is not kept forever by default; keeping one is an explicit
--      act (`kept = true`) by the parent. The sweeper deletes the row and the
--      file together.
--
-- The audio file itself is NOT under the public /uploads static mount. That
-- mount is unauthenticated and cached `immutable, max-age=30d`, which is right
-- for story art and TTS and completely wrong for a child's voice. `storage_key`
-- is a path relative to a private directory the API streams from after
-- checking ownership.
-- ═══════════════════════════════════════════════════════════

alter table users add column if not exists read_aloud_consent_at timestamptz;

create table if not exists read_aloud_recordings (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references children(id) on delete cascade,
  story_id     uuid references stories(id) on delete set null,
  -- Path relative to READ_ALOUD_DIR. Never a URL: nothing serves this
  -- directory statically, and nothing should.
  storage_key  text not null,
  mime_type    text not null,
  bytes        integer not null check (bytes > 0),
  duration_ms  integer check (duration_ms >= 0),
  -- Set to now() the first time a parent plays it back. Lets the parent app
  -- say "new" honestly instead of guessing from created_at.
  heard_at     timestamptz,
  -- A parent who presses "keep" is opting this one recording out of the
  -- sweeper. Everything else is temporary by default, which is the safer
  -- default for a child's voice.
  kept         boolean not null default false,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_read_aloud_child_created
  on read_aloud_recordings (child_id, created_at desc);
-- Partial: the sweeper only ever scans rows that can actually expire.
create index if not exists idx_read_aloud_expiry
  on read_aloud_recordings (expires_at) where not kept;

comment on table read_aloud_recordings is
  'Child voice recordings of stories read aloud. Requires users.read_aloud_consent_at. Audio lives outside the public /uploads mount and is streamed only after an ownership check.';
