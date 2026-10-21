import { existsSync } from 'node:fs'
import pg from 'pg'

export function loadEnv() {
  try {
    if (existsSync('.env')) process.loadEnvFile('.env')
  } catch {
    // .env is optional
  }
}

export function connectionString() {
  loadEnv()
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  throw new Error(
    'No database configured. Set DATABASE_URL (see .env.example).',
  )
}

export function client() {
  const url = connectionString()
  const local = /localhost|127\.0\.0\.1/.test(url)
  return new pg.Client({
    connectionString: url,
    ssl: local ? undefined : { rejectUnauthorized: false },
  })
}

export async function withClient(fn) {
  const c = client()
  await c.connect()
  try {
    return await fn(c)
  } finally {
    await c.end()
  }
}
