-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ── Users ─────────────────────────────────────────────────

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- ── Content tables ────────────────────────────────────────

create table if not exists words (
  id            uuid primary key default gen_random_uuid(),
  persian       text not null,
  english       text not null,
  finglish      text,
  category      text not null check (category in ('animals','colors','family','food','body','nature','objects')),
  stage         int not null default 1,
  audio_url     text,
  image_url     text
);

create table if not exists letters (
  id              uuid primary key default gen_random_uuid(),
  character       text not null,
  name_persian    text not null,
  name_english    text not null,
  "group"         int not null,
  order_in_group  int not null,
  audio_url       text,
  example_word_id uuid references words(id)
);

create table if not exists lessons (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  type          text not null check (type in ('vocabulary','alphabet','phonics')),
  stage         int not null,
  order_index   int not null unique,
  description   text,
  thumbnail_url text
);

create table if not exists lesson_items (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references lessons(id) on delete cascade,
  item_type   text not null check (item_type in ('word','letter')),
  word_id     uuid references words(id),
  letter_id   uuid references letters(id),
  order_index int not null
);

create table if not exists stories (
  id              uuid primary key default gen_random_uuid(),
  title_persian   text not null,
  title_english   text not null unique,
  stage           int not null,
  age_min         int,
  age_max         int,
  cover_url       text,
  pdf_url         text,
  audio_url       text,
  created_at      timestamptz not null default now()
);

create table if not exists story_pages (
  id            uuid primary key default gen_random_uuid(),
  story_id      uuid not null references stories(id) on delete cascade,
  page_number   int not null,
  text_persian  text not null,
  text_english  text,
  image_url     text,
  audio_url     text
);

create table if not exists story_page_words (
  id        uuid primary key default gen_random_uuid(),
  page_id   uuid not null references story_pages(id) on delete cascade,
  word_id   uuid not null references words(id),
  position  int not null
);

create table if not exists badges (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  title       text not null,
  description text,
  image_url   text
);

-- ── Child tables ──────────────────────────────────────────

create table if not exists children (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid not null references users(id) on delete cascade,
  name        text not null,
  birth_year  int,
  level       int not null default 1 check (level between 1 and 4),
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- ── Progress tables ───────────────────────────────────────

create table if not exists child_sessions (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references children(id) on delete cascade,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  duration_sec int
);

create table if not exists child_word_progress (
  id             uuid primary key default gen_random_uuid(),
  child_id       uuid not null references children(id) on delete cascade,
  word_id        uuid not null references words(id),
  status         text not null default 'introduced' check (status in ('introduced','practiced','mastered')),
  introduced_at  timestamptz not null default now(),
  mastered_at    timestamptz,
  replay_count   int not null default 0,
  unique (child_id, word_id)
);

create table if not exists child_lesson_progress (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references children(id) on delete cascade,
  lesson_id    uuid not null references lessons(id),
  completed    boolean not null default false,
  score        int,
  completed_at timestamptz,
  unique (child_id, lesson_id)
);

create table if not exists child_story_progress (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references children(id) on delete cascade,
  story_id     uuid not null references stories(id),
  last_page    int not null default 0,
  completed    boolean not null default false,
  replay_count int not null default 0,
  last_read_at timestamptz not null default now(),
  unique (child_id, story_id)
);

create table if not exists child_badges (
  id         uuid primary key default gen_random_uuid(),
  child_id   uuid not null references children(id) on delete cascade,
  badge_id   uuid not null references badges(id),
  earned_at  timestamptz not null default now(),
  unique (child_id, badge_id)
);

-- ── Indexes ───────────────────────────────────────────────

create index if not exists idx_users_email                 on users (email);
create index if not exists idx_children_parent_id          on children (parent_id);
create index if not exists idx_child_sessions_child_id     on child_sessions (child_id);
create index if not exists idx_child_word_prog_child_id    on child_word_progress (child_id);
create index if not exists idx_child_lesson_prog_child_id  on child_lesson_progress (child_id);
create index if not exists idx_child_story_prog_child_id   on child_story_progress (child_id);
create index if not exists idx_child_badges_child_id       on child_badges (child_id);
create index if not exists idx_story_pages_story_id        on story_pages (story_id);
create index if not exists idx_lesson_items_lesson_id      on lesson_items (lesson_id);
