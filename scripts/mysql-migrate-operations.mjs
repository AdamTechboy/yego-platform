import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import mysql from 'mysql2/promise'

const file = 'deploy/smartweb/mysql/0002_operational_schema.sql'
const sql = await readFile(file, 'utf8')
const checksum = createHash('sha256').update(sql).digest('hex')
const keys = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']
for (const key of keys) if (!process.env[key]) throw new Error('Missing ' + key)
const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  multipleStatements: true,
  charset: 'utf8mb4',
})
try {
  const [base] = await connection.execute(
    'SELECT checksum FROM schema_migrations WHERE version = ?',
    ['deploy/smartweb/mysql/0001_core_schema.sql'],
  )
  if (!base.length) throw new Error('Run the core schema migration first')
  const [rows] = await connection.execute(
    'SELECT checksum FROM schema_migrations WHERE version = ?', [file],
  )
  if (rows.length) {
    if (rows[0].checksum !== checksum) throw new Error('Migration checksum mismatch')
    console.log('Operational schema already applied')
  } else {
    await connection.query(sql)
    await connection.execute(
      'INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)',
      [file, checksum],
    )
    console.log('Operational schema applied')
  }
} finally {
  await connection.end()
}
