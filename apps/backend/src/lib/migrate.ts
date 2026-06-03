import fs from 'fs'
import path from 'path'
import { db } from './db'

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations')

export async function migrate() {
  // Create tracking table if it doesn't exist
  await db.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT now()
    )
  `)

  // Read and sort migration files
  let files: string[]
  try {
    files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort()
  } catch {
    console.log('No migrations directory found — skipping')
    return
  }

  for (const file of files) {
    const { rows } = await db.query(
      'SELECT 1 FROM _migrations WHERE filename = $1',
      [file]
    )
    if (rows.length > 0) continue

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    console.log(`Applying migration: ${file}`)

    const client = await db.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file])
      await client.query('COMMIT')
      console.log(`Migration applied: ${file}`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw new Error(`Migration failed (${file}): ${(err as Error).message}`)
    } finally {
      client.release()
    }
  }
}
