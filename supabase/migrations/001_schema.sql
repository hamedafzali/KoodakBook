-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ── Users ─────────────────────────────────────────────────

create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- ── Content tables ────────────────────────────────────────

create table words (
  id            uuid primary key default gen_random_uuid(),
  persian       text not null,
  english       text not null,
  finglish      text,
  category      text not null check (category in ('animals','colors','family','food','body','nature','objects')),
  stage         int not null default 1,
  audio_url     text,
  image_url     text
);

create table letters (
  id              uuid primary key default gen_random_uuid(),
  character       text not null,
  name_persian    text not null,
  name_english    text not null,
  "group"         int not null,
  order_in_group  int not null,
  audio_url       text,
  example_word_id uuid references words(id)
);

create table lessons (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  type          text not null check (type in ('vocabulary','alphabet','phonics')),
  stage         int not null,
  order_index   int not null,
  description   text,
  thumbnail_url text
);

create table lesson_items (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references lessons(id) on delete cascade,
  item_type   text not null check (item_type in ('word','letter')),
  word_id     uuid references words(id),
  letter_id   uuid references letters(id),
  order_index int not null
);

create table stories (
  id              uuid primary key default gen_random_uuid(),
  title_persian   text not null,
  title_english   text not null,
  stage           int not null,
  age_min         int,
  age_max         int,
  cover_url       text,
  pdf_url         text,
  audio_url       text,
  created_at      timestamptz not null default now()
);

create table story_pages (
  id            uuid primary key default gen_random_uuid(),
  story_id      uuid not null references stories(id) on delete cascade,
  page_number   int not null,
  text_persian  text not null,
  text_english  text,
  image_url     text,
  audio_url     text
);

create table story_page_words (
  id        uuid primary key default gen_random_uuid(),
  page_id   uuid not null references story_pages(id) on delete cascade,
  word_id   uuid not null references words(id),
  position  int not null
);

create table badges (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  title       text not null,
  description text,
  image_url   text
);

-- ── Child tables ──────────────────────────────────────────

create table children (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid not null references users(id) on delete cascade,
  name        text not null,
  birth_year  int,
  level       int not null default 1 check (level between 1 and 4),
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- ── Progress tables ───────────────────────────────────────

create table child_sessions (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references children(id) on delete cascade,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  duration_sec int
);

create table child_word_progress (
  id             uuid primary key default gen_random_uuid(),
  child_id       uuid not null references children(id) on delete cascade,
  word_id        uuid not null references words(id),
  status         text not null default 'introduced' check (status in ('introduced','practiced','mastered')),
  introduced_at  timestamptz not null default now(),
  mastered_at    timestamptz,
  replay_count   int not null default 0,
  unique (child_id, word_id)
);

create table child_lesson_progress (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references children(id) on delete cascade,
  lesson_id    uuid not null references lessons(id),
  completed    boolean not null default false,
  score        int,
  completed_at timestamptz,
  unique (child_id, lesson_id)
);

create table child_story_progress (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references children(id) on delete cascade,
  story_id     uuid not null references stories(id),
  last_page    int not null default 0,
  completed    boolean not null default false,
  replay_count int not null default 0,
  last_read_at timestamptz not null default now(),
  unique (child_id, story_id)
);

create table child_badges (
  id         uuid primary key default gen_random_uuid(),
  child_id   uuid not null references children(id) on delete cascade,
  badge_id   uuid not null references badges(id),
  earned_at  timestamptz not null default now(),
  unique (child_id, badge_id)
);

-- ── Indexes ───────────────────────────────────────────────

create index on users (email);
create index on children (parent_id);
create index on child_sessions (child_id);
create index on child_word_progress (child_id);
create index on child_lesson_progress (child_id);
create index on child_story_progress (child_id);
create index on child_badges (child_id);
create index on story_pages (story_id);
create index on lesson_items (lesson_id);
