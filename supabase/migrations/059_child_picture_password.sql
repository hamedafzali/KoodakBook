-- KoodakBook — Migration 059: picture password + device binding for kid login
--
-- Kid login (mig 039) is a bare username — trivially guessed/replayed by a
-- sibling, and worse, until the token-scope fix, indistinguishable from the
-- parent's own session. This adds two independent defenses, designed for a
-- 4-7-year-old who can't type or read reliably:
--
--   picture_password: a 3-character tap sequence (character slugs from the
--   existing catalog) the parent sets. Stops a sibling who only knows a
--   USERNAME from logging in as another child — but not one who watches the
--   sequence get tapped on an already-bound device (inherent to any code a
--   small child enters alone).
--
--   device_tokens: a per-child, per-device long-lived credential. The
--   picture password alone is only accepted on a device already bound for
--   that child; an unbound device (a lost/found/stolen tablet, or the
--   child's first time on a new one) falls back to requiring a PARENT PIN
--   verify (existing /api/auth/pin/verify, deliberately open to a
--   scope:'child' session — see middleware/auth.ts's requireParent comment)
--   before binding. This is the part that answers "device was stolen", not
--   the picture password.
alter table children add column if not exists picture_password text[];
-- Lockout is per-child (siblings must not lock each other out), mirroring
-- users.pin_failed_attempts / pin_locked_until for the parent PIN.
alter table children add column if not exists picture_failed_attempts int not null default 0;
alter table children add column if not exists picture_locked_until timestamptz;

create table if not exists device_tokens (
  id                    uuid primary key default gen_random_uuid(),
  child_id              uuid not null references children(id) on delete cascade,
  -- sha256 of the raw device credential; the raw value lives only on the
  -- device (keychain/localStorage) and is never stored server-side, same
  -- principle as a password hash.
  token_hash            text not null,
  created_at            timestamptz not null default now(),
  last_used_at          timestamptz not null default now(),
  revoked_at            timestamptz
);

create unique index if not exists idx_device_tokens_hash on device_tokens (token_hash);
create index if not exists idx_device_tokens_child_id on device_tokens (child_id) where revoked_at is null;
