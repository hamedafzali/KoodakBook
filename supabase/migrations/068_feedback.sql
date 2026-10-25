-- KoodakBook — Migration 068: family feedback
--
-- One inbox for everything families tell us: the public contact form on the
-- website (no account needed) and the «پیشنهاد، مشکل یا سؤال» screen in the
-- parent area (web and mobile, linked to the account). Admins work it in the
-- admin panel (status, internal note) and can reply; a reply to a signed-in
-- family is shown to them in the parent area, so answering needs no email
-- service. routes/feedback.ts.
create table if not exists feedback (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references users(id) on delete set null,
  source         text not null check (source in ('site', 'parent_web', 'parent_mobile')),
  kind           text not null check (kind in ('idea', 'problem', 'question', 'other')),
  name           text,
  email          text,
  message        text not null,
  -- Where it was sent from (page / screen, platform, app version, browser).
  -- Never anything about the child.
  context        jsonb not null default '{}'::jsonb,
  status         text not null default 'new' check (status in ('new', 'in_progress', 'answered', 'closed')),
  admin_note     text,          -- internal, never shown to the family
  reply          text,          -- shown to the family in the parent area
  replied_at     timestamptz,
  replied_by     text,
  reply_seen_at  timestamptz,   -- when the family opened the reply
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_feedback_status on feedback (status, created_at desc);
create index if not exists idx_feedback_user on feedback (user_id, created_at desc);
