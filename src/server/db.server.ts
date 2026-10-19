import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'

declare global {
  var __yegoPool: pg.Pool | undefined
}

function connectionString(): string {
  const fromEnv = process.env.DATABASE_URL ?? process.env.NETLIFY_DATABASE_URL
  if (fromEnv) return fromEnv

  if (process.env.NODE_ENV !== 'production') {
    const statePath = resolve('.netlify/state.json')
    if (existsSync(statePath)) {
      const state = JSON.parse(readFileSync(statePath, 'utf8')) as { dbConnectionString?: string }
      if (state.dbConnectionString) return state.dbConnectionString
    }
  }

  throw new Error(
    'Database is not configured. Set DATABASE_URL (or NETLIFY_DATABASE_URL) and run the migrations. See docs/BACKEND_ARCHITECTURE.md.',
  )
}

export function pool(): pg.Pool {
  if (!globalThis.__yegoPool) {
    const url = connectionString()
    const local = /localhost|127\.0\.0\.1/.test(url)
    globalThis.__yegoPool = new pg.Pool({
      connectionString: url,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      ssl: local ? undefined : { rejectUnauthorized: false },
    })
  }
  return globalThis.__yegoPool
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  return pool().query<T>(text, params)
}

export async function one<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const result = await query<T>(text, params)
  return result.rows[0] ?? null
}

export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect()
  try {
    await client.query('begin')
    const value = await fn(client)
    await client.query('commit')
    return value
  } catch (error) {
    try {
      await client.query('rollback')
    } catch {
      // connection already failed
    }
    throw error
  } finally {
    client.release()
  }
}

export function isDatabaseConfigured(): boolean {
  try {
    connectionString()
    return true
  } catch {
    return false
  }
}
