import bcrypt from 'bcryptjs'
import { query, queryOne } from './db'

export async function seedAdmin() {
  const email    = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) return

  const existing = await queryOne<{ id: string; password_hash: string }>(
    'select id, password_hash from users where email = $1', [email]
  )

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
    return
  }

  const password_hash = await bcrypt.hash(password, 12)
  await query(
    'insert into users (email, password_hash) values ($1, $2)',
    [email, password_hash]
  )
  console.log(`Admin account created: ${email}`)
}
