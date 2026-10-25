-- KoodakBook — Migration 067: admin-notification throttle + mobile app releases
--
-- admin_notify_log: one row per throttled admin Telegram message key (an error
-- signature, the backend-start ping, the daily summary of a given day). Lives
-- in the database rather than in memory so a crash-looping backend can't page
-- the operator once per restart, and so the 21:00 summary is sent exactly once
-- a day even if the backend restarts after it went out. See lib/adminNotify.ts.
create table if not exists admin_notify_log (
  key          text primary key,
  last_sent_at timestamptz not null default now(),
  -- How many messages with this key were held back since last_sent_at; the
  -- next one that does go out says "+N similar".
  suppressed   int not null default 0
);

-- app_releases: Android builds handed out directly (outside Google Play) from
-- koodakbook.eu.cc/app. The public page and the app's own update check read
-- the newest PUBLISHED row; drafts stay invisible until an admin publishes.
-- download_url is either a /uploads/apps/... path (uploaded through the admin
-- panel) or an external https URL (e.g. a GitHub Release asset).
create table if not exists app_releases (
  id            uuid primary key default gen_random_uuid(),
  platform      text not null default 'android' check (platform in ('android')),
  version_name  text not null,
  version_code  int  not null check (version_code > 0),
  download_url  text not null,
  file_bytes    bigint check (file_bytes is null or file_bytes > 0),
  sha256        text,
  notes         text,
  is_published  boolean not null default false,
  published_at  timestamptz,
  created_by    text,
  created_at    timestamptz not null default now(),
  unique (platform, version_code)
);
create index if not exists idx_app_releases_latest
  on app_releases (platform, is_published, version_code desc);
