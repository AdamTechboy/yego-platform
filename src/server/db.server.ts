import pg from 'pg'
import mysql from 'mysql2/promise'

declare global {
  var __yegoPool: pg.Pool | undefined
  var __yegoMysqlPool: mysql.Pool | undefined
}

function usingMysql(): boolean {
  return process.env.DB_ENGINE === 'mysql'
}

function mysqlPool(): mysql.Pool {
  for (const key of ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
    if (!process.env[key]) throw new Error('Missing MySQL setting: ' + key)
  }
  globalThis.__yegoMysqlPool ??= mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    charset: 'utf8mb4',
    connectionLimit: 5,
    waitForConnections: true,
  })
  return globalThis.__yegoMysqlPool
}


async function mysqlQuery<T extends pg.QueryResultRow>(sql: string, params: unknown[] = []): Promise<pg.QueryResult<T>> {
  const { bindMysql } = await import('../../scripts/mysql-adapter.mjs')
  const bound = bindMysql(sql, params)
  const [result] = await mysqlPool().query(bound.sql, bound.params)
  const rows = Array.isArray(result) ? result as T[] : []
  const affected = Array.isArray(result) ? rows.length : (result as mysql.ResultSetHeader).affectedRows
  return { rows, rowCount: affected, command: '', oid: 0, fields: [] }
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
  if (usingMysql()) {
    return mysqlQuery<T>(text, params)
  }
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
  if (usingMysql()) {
    throw new Error('MySQL transactions are not enabled until SQL conversion is complete')
  }
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
    if (usingMysql()) return ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'].every((key) => !!process.env[key])
    connectionString()
    return true
  } catch {
    return false
  }
}
