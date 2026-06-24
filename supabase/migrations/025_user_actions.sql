-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 025: account status + support notes
-- (Admin Phase 3 — expanded user actions.) Suspend keeps the record but denies
-- login (best practice over delete). Support notes give per-family context.
-- ═══════════════════════════════════════════════════════════

alter table users add column if not exists status text not null default 'active'
  check (status in ('active', 'suspended'));

create table if not exists support_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  admin_email text not null,
  note        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_support_notes_user on support_notes (user_id, created_at desc);
