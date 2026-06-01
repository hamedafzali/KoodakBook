import bcrypt from 'bcryptjs'
import { query, queryOne } from './db'

export async function seedAdmin() {
  const email    = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) return

  const existing = await queryOne('select id from users where email = $1', [email])
  if (existing) return

  const password_hash = await bcrypt.hash(password, 12)
  await query(
    'insert into users (email, password_hash) values ($1, $2)',
    [email, password_hash]
  )
  console.log(`Admin account created: ${email}`)
}
