import bcrypt from 'bcryptjs'
import { query, queryOne } from './db'

export async function seedAdmin() {
  const email    = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) return

  const existing = await queryOne<{ id: string; password_hash: string }>(
    'select id, password_hash from users where email = $1', [email]
  )

  let ownerId = existing?.id
  if (existing) {
    // ADMIN_PASSWORD is the source of truth — re-sync it if it changed so that
    // updating the env actually takes effect (was create-only before, which
    // silently kept a stale password and caused "incorrect password").
    const matches = await bcrypt.compare(password, existing.password_hash)
    if (!matches) {
      const password_hash = await bcrypt.hash(password, 12)
      await query('update users set password_hash = $1 where id = $2', [password_hash, existing.id])
      console.log(`Admin password re-synced from env: ${email}`)
    }
  } else {
    const password_hash = await bcrypt.hash(password, 12)
    const [created] = await query<{ id: string }>(
      'insert into users (email, password_hash) values ($1, $2) returning id',
      [email, password_hash]
    )
    ownerId = created?.id
    console.log(`Admin account created: ${email}`)
  }

  // Grant the owner the superadmin role (RBAC, mig-023). Idempotent.
  if (ownerId) {
    await query(
      `insert into user_roles (user_id, role_id)
       select $1, r.id from roles r where r.key = 'superadmin'
       on conflict do nothing`,
      [ownerId]
    ).catch(() => { /* roles table may not exist yet on very first boot before mig-023 */ })
  }
}
