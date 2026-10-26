-- KoodakBook — Migration 070: children's videos («ویدیوها»)
--
-- Short videos children watch from their own menu in the app and on the
-- website (word songs, later story videos …), grouped into categories the
-- admin manages. Files are uploaded through the admin panel to
-- /uploads/videos; nothing is visible until an admin publishes it. All
-- published videos are free for every child (no plan gate).
create table if not exists video_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  title_fa    text not null check (length(title_fa) between 1 and 60),
  emoji       text,
  order_index int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists videos (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references video_categories(id) on delete restrict,
  title_fa      text not null check (length(title_fa) between 1 and 80),
  description_fa text,
  video_url     text not null,
  cover_url     text,
  duration_sec  numeric(7,2) check (duration_sec is null or duration_sec > 0),
  file_bytes    bigint check (file_bytes is null or file_bytes > 0),
  order_index   int  not null default 0,
  is_published  boolean not null default false,
  published_at  timestamptz,
  created_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_videos_published
  on videos (is_published, category_id, order_index);

-- The first category, for the animal word songs made in Google Flow.
insert into video_categories (slug, title_fa, emoji, order_index)
values ('animal-songs', 'ترانه‌های حیوانات', '🐾', 1)
on conflict (slug) do nothing;
