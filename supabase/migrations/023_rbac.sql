-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 023: admin RBAC (roles / groups / permissions)
--
-- Access control for the operator console (docs/admin-capabilities-plan.md,
-- Phase 1). Roles are the "groups"; each grants granular permissions. Admins
-- are users.id linked to roles via user_roles. The ADMIN_EMAIL owner is granted
-- 'superadmin' at backend startup (env-derived, so not seeded here).
--
-- Best practice (oso/WorkOS): least privilege, roles modeled on business
-- functions, audited changes. Permission checks live in requirePermission().
-- ═══════════════════════════════════════════════════════════

create table if not exists roles (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  name        text not null,
  description text
);

create table if not exists permissions (
  key         text primary key,
  description text
);

create table if not exists role_permissions (
  role_id        uuid references roles(id) on delete cascade,
  permission_key text references permissions(key) on delete cascade,
  primary key (role_id, permission_key)
);

create table if not exists user_roles (
  user_id    uuid references users(id) on delete cascade,
  role_id    uuid references roles(id) on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (user_id, role_id)
);
create index if not exists idx_user_roles_user on user_roles (user_id);

-- ── Seed permissions ──────────────────────────────────────
insert into permissions (key, description) values
  ('users.read',           'View families and children'),
  ('users.suspend',        'Suspend / reactivate accounts'),
  ('users.delete',         'Delete a family'),
  ('users.plan',           'Change a family''s plan'),
  ('users.reset_password', 'Reset a parent''s password'),
  ('users.export',         'Export a family''s data'),
  ('content.read',         'View content'),
  ('content.edit',         'Create / edit / delete content'),
  ('plans.manage',         'Define and manage plans'),
  ('analytics.view',       'View analytics and pilot metrics'),
  ('audit.read',           'View the audit log'),
  ('admin.manage',         'Manage admin team, roles and access')
on conflict (key) do nothing;

-- ── Seed roles (business-function groups) ─────────────────
insert into roles (key, name, description) values
  ('superadmin',     'مدیر کل',        'Full access to everything'),
  ('support',        'پشتیبانی',       'Help families: view, suspend, reset, export'),
  ('content_editor', 'ویرایشگر محتوا', 'Manage curriculum content'),
  ('analyst',        'تحلیل‌گر',        'Read-only analytics and family data')
on conflict (key) do nothing;

-- ── Seed role → permission grants ─────────────────────────
-- superadmin = every permission
insert into role_permissions (role_id, permission_key)
  select r.id, p.key from roles r cross join permissions p where r.key = 'superadmin'
on conflict do nothing;

insert into role_permissions (role_id, permission_key)
  select r.id, t.k from roles r
  cross join (values ('users.read'),('users.suspend'),('users.reset_password'),('users.export'),('analytics.view'),('audit.read')) as t(k)
  where r.key = 'support'
on conflict do nothing;

insert into role_permissions (role_id, permission_key)
  select r.id, t.k from roles r
  cross join (values ('content.read'),('content.edit')) as t(k)
  where r.key = 'content_editor'
on conflict do nothing;

insert into role_permissions (role_id, permission_key)
  select r.id, t.k from roles r
  cross join (values ('analytics.view'),('users.read')) as t(k)
  where r.key = 'analyst'
on conflict do nothing;
