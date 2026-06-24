-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 022: admin audit log
--
-- Foundation for the operator console (docs/admin-plan.md). Every admin action
-- that touches a user/child record is recorded here: who did it, what, to whom,
-- and a small JSON detail. Non-negotiable for handling minors' data and for
-- support accountability. Append-only; readers are admin-only.
-- ═══════════════════════════════════════════════════════════

create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  admin_email text not null,
  action      text not null,              -- e.g. 'user.plan_change', 'user.reset_password', 'user.delete'
  target_type text,                       -- 'user' | 'child' | ...
  target_id   uuid,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_log_created on audit_log (created_at desc);
create index if not exists idx_audit_log_target  on audit_log (target_type, target_id);
