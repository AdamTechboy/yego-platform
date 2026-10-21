import pg from 'pg'

declare global {
  var __yegoPool: pg.Pool | undefined
}

function connectionString(): string {
  const fromEnv = process.env.DATABASE_URL
  if (fromEnv) return fromEnv

  throw new Error(
    'Database is not configured. Set DATABASE_URL on the server. See deploy/smartweb/vps/README.md.',
  )
}

function createPool(): pg.Pool {
  const url = connectionString()
  const local = /localhost|127\.0\.0\.1/.test(url)
  return new pg.Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: local ? undefined : { rejectUnauthorized: false },
  })
}

export function pool(): pg.Pool {
  globalThis.__yegoPool ??= createPool()
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
