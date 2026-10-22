import mysql from 'mysql2/promise'

/**
 * MySQL 8 adapter for the YeGo database port.
 *
 * This module is deliberately not wired into the existing PostgreSQL
 * application yet: repository SQL and schema still require conversion.
 */
let sharedPool

export function mysqlConfig(env = process.env) {
  for (const key of ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
    if (!env[key]) throw new Error(`Missing required MySQL configuration: ${key}`)
  }
  const port = Number(env.DB_PORT || 3306)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid DB_PORT')
  }
  return {
    host: env.DB_HOST,
    port,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    charset: 'utf8mb4',
    connectionLimit: 5,
    waitForConnections: true,
    queueLimit: 20,
    decimalNumbers: false,
    timezone: 'Z',
    supportBigNumbers: true,
    bigNumberStrings: true,
  }
}

export function mysqlPool() {
  sharedPool ??= mysql.createPool(mysqlConfig())
  return sharedPool
}

/**
 * Translate numbered PostgreSQL parameter markers to mysql2 placeholders.
 * Duplicated parameters are expanded in positional order. This is only a
 * placeholder translator, NOT a PostgreSQL SQL dialect converter.
 * Use it only with SQL already audited and converted to MySQL syntax.
 */
export function bindMysql(sql, params = []) {
  const bound = []
  let inSingle = false
  let inDouble = false
  let inBacktick = false
  let inLineComment = false
  let inBlockComment = false
  let result = ''

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]
    const next = sql[i + 1]
    if (inLineComment) {
      result += ch
      if (ch === '\n') inLineComment = false
      continue
    }
    if (inBlockComment) {
      result += ch
      if (ch === '*' && next === '/') { result += '/'; i++; inBlockComment = false }
      continue
    }
    if (!inSingle && !inDouble && !inBacktick) {
      if (ch === '-' && next === '-') { result += '--'; i++; inLineComment = true; continue }
      if (ch === '/' && next === '*') { result += '/*'; i++; inBlockComment = true; continue }
    }
    if (ch === "'" && !inDouble && !inBacktick) {
      result += ch
      if (inSingle && next === "'") { result += next; i++; continue }
      if (i === 0 || sql[i - 1] !== '\\') inSingle = !inSingle
      continue
    }
    if (ch === '"' && !inSingle && !inBacktick) { inDouble = !inDouble; result += ch; continue }
    if (ch === '`' && !inSingle && !inDouble) { inBacktick = !inBacktick; result += ch; continue }
    if (!inSingle && !inDouble && !inBacktick && ch === '$' && /[0-9]/.test(next || '')) {
      let end = i + 1
      while (/[0-9]/.test(sql[end] || '')) end++
      const index = Number(sql.slice(i + 1, end)) - 1
      if (index < 0 || index >= params.length) throw new Error('SQL parameter index out of bounds')
      bound.push(params[index])
      result += '?'
      i = end - 1
      continue
    }
    result += ch
  }
  return { sql: result, params: bound }
}

function normalizeResult(rows) {
  if (Array.isArray(rows)) return { rows, rowCount: rows.length }
  return { rows: [], rowCount: rows.affectedRows ?? 0, insertId: rows.insertId }
}

export async function mysqlQuery(sql, params = [], connection = mysqlPool()) {
  const statement = bindMysql(sql, params)
  const [rows] = await connection.query(statement.sql, statement.params)
  return normalizeResult(rows)
}

export async function mysqlTransaction(fn) {
  const connection = await mysqlPool().getConnection()
  try {
    await connection.beginTransaction()
    const client = { query: (sql, params = []) => mysqlQuery(sql, params, connection) }
    const value = await fn(client)
    await connection.commit()
    return value
  } catch (error) {
    try { await connection.rollback() } catch { /* preserve original error */ }
    throw error
  } finally {
    connection.release()
  }
}
