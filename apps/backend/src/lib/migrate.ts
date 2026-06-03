import fs from 'fs'
import path from 'path'
import { db } from './db'

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations')

/** Split a SQL file into individual statements, ignoring blank lines and comments. */
function splitStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let dollarDepth = 0   // track $$ ... $$ blocks (not used here but safe to carry)

  for (const line of sql.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('--')) {
      current += line + '\n'
      continue
    }

    // Track dollar-quoting so semicolons inside $$ blocks are not treated as terminators
    const dollarMatches = trimmed.match(/\$\$/g)
    if (dollarMatches) dollarDepth = (dollarDepth + dollarMatches.length) % 2

    current += line + '\n'

    if (dollarDepth === 0 && trimmed.endsWith(';')) {
      const stmt = current.trim()
      if (stmt && stmt !== ';') statements.push(stmt)
      current = ''
    }
  }
  const remaining = current.trim()
  if (remaining && remaining !== ';') statements.push(remaining)
  return statements
}

export async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT now()
    )
  `)

  let files: string[]
  try {
    files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort()
  } catch {
    console.log('No migrations directory — skipping')
    return
  }

  for (const file of files) {
    const { rows } = await db.query('SELECT 1 FROM _migrations WHERE filename = $1', [file])
    if (rows.length > 0) continue

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    const statements = splitStatements(sql).filter(s => s.length > 0)
    console.log(`Applying migration: ${file} (${statements.length} statements)`)

    const client = await db.connect()
    try {
      await client.query('BEGIN')
      for (const stmt of statements) {
        await client.query(stmt)
      }
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
