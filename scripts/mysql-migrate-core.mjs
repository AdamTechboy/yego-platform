import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import mysql from 'mysql2/promise'

const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']
const missing = required.filter((key) => !process.env[key])
if (missing.length) throw new Error('Missing MySQL environment variables: ' + missing.join(', '))

const file = 'deploy/smartweb/mysql/0001_core_schema.sql'
const sql = await readFile(file, 'utf8')
const checksum = createHash('sha256').update(sql).digest('hex')
const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
  multipleStatements: true,
  connectTimeout: 10_000,
})
try {
  await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(190) PRIMARY KEY,
    checksum CHAR(64) NOT NULL,
    applied_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
  const [applied] = await connection.execute(
    'SELECT checksum FROM schema_migrations WHERE version = ?', [file],
  )
  if (applied.length) {
    if (applied[0].checksum !== checksum) throw new Error('Migration changed since application: ' + file)
    console.log('MySQL core migration already applied; checksum matches')
  } else {
    // MySQL DDL auto-commits. CREATE TABLE IF NOT EXISTS makes this
    // resumable, but the database should be backed up before execution.
    await connection.query(sql)
    await connection.execute(
      'INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)',
      [file, checksum],
    )
    console.log('MySQL core migration applied:', file)
  }
} finally {
  await connection.end()
}
