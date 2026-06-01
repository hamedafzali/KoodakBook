import { Pool } from 'pg'

if (!process.env.DATABASE_URL) throw new Error('Missing DATABASE_URL')

export const db = new Pool({ connectionString: process.env.DATABASE_URL })

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
