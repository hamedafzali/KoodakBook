-- KoodakBook — Migration 032: website leads
--
-- The public marketing site collects three kinds of interest:
--   tablet       — pre-order request for a tablet shipped with KoodakBook
--   app_waitlist — "tell me when the Android/iOS app is out"
--   contact      — general question from the contact section
create table if not exists leads (
  id         uuid primary key default gen_random_uuid(),
  type       text not null check (type in ('tablet', 'app_waitlist', 'contact')),
  name       text,
  email      text not null,
  phone      text,
  country    text,
  quantity   int,
  message    text,
  status     text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_leads_status on leads (status, created_at desc);
