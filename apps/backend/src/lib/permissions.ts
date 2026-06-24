import { query } from './db'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@koodakbook.com'

/** The env-configured owner is always a full superadmin. */
export function isOwner(email: string): boolean {
  return !!email && email === ADMIN_EMAIL
}

/** True if the user is an admin at all (owner, or holds ≥1 role). */
export async function isAdminUser(userId: string, email: string): Promise<boolean> {
  if (isOwner(email)) return true
  const rows = await query('select 1 from user_roles where user_id = $1 limit 1', [userId])
  return rows.length > 0
}

/** The user's effective permission keys. Owner gets the wildcard '*'. */
export async function loadPermissions(userId: string, email: string): Promise<string[]> {
  if (isOwner(email)) return ['*']
  const rows = await query<{ permission_key: string }>(
    `select distinct rp.permission_key
     from user_roles ur
     join role_permissions rp on rp.role_id = ur.role_id
     where ur.user_id = $1`,
    [userId],
  )
  return rows.map(r => r.permission_key)
}

export function hasPermission(perms: string[] | undefined, perm: string): boolean {
  return !!perms && (perms.includes('*') || perms.includes(perm))
}
