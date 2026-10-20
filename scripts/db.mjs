import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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
  if (process.env.NETLIFY_DB_URL) return process.env.NETLIFY_DB_URL
  if (process.env.NETLIFY_DATABASE_URL) return process.env.NETLIFY_DATABASE_URL
  const statePath = resolve('.netlify/state.json')
  if (existsSync(statePath)) {
    const state = JSON.parse(readFileSync(statePath, 'utf8'))
    if (state.dbConnectionString) return state.dbConnectionString
  }
  throw new Error(
    'No database configured. Set DATABASE_URL (see .env.example) or run `pnpm dev` so the Netlify dev plugin provisions the local database.',
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
