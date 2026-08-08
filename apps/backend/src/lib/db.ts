import { Pool, type PoolClient } from 'pg'

if (!process.env.DATABASE_URL) throw new Error('Missing DATABASE_URL')

export const db = new Pool({ connectionString: process.env.DATABASE_URL })

/**
 * Run `fn` inside a single transaction on a dedicated pooled client, so a
 * read-then-write sequence (e.g. SELECT ... FOR UPDATE → UPDATE) is atomic and
 * a concurrent writer can't slip a lost update in between. Commits on success,
 * rolls back on throw, always releases the client.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect()
  try {
    await client.query('begin')
    const result = await fn(client)
    await client.query('commit')
    return result
  } catch (err) {
    await client.query('rollback')
    throw err
  } finally {
    client.release()
  }
}

export async function query<T extends object = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await db.query(sql, params)
  return result.rows as T[]
}

export async function queryOne<T extends object = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}
