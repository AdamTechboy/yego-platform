import { randomBytes, scryptSync } from 'node:crypto'
import { loadEnv, withClient } from './db.mjs'

loadEnv()

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD
const name = process.env.ADMIN_NAME?.trim() || 'Super Administrator'

if (!email || !password) {
  console.error('Set ADMIN_EMAIL, ADMIN_PASSWORD and optionally ADMIN_NAME, then rerun.')
  process.exit(1)
}
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('ADMIN_EMAIL must be a valid email address.')
  process.exit(1)
}
if (password.length < 12) {
  console.error('ADMIN_PASSWORD must be at least 12 characters.')
  process.exit(1)
}

function hashPassword(value) {
  const salt = randomBytes(16)
  const hash = scryptSync(value, salt, 64, { N: 16384, r: 8, p: 1 })
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${hash.toString('base64url')}`
}

await withClient(async (client) => {
  const hash = hashPassword(password)
  const updated = await client.query(
    `update users
     set password_hash = $2, name = $3, role = 'Super Administrator',
         kind = 'command', scope_kind = 'national', active = true
     where lower(email) = $1`,
    [email, hash, name],
  )
  if (!updated.rowCount) {
    await client.query(
      `insert into users (email, password_hash, name, role, kind, scope_kind, active)
       values ($1,$2,$3,'Super Administrator','command','national',true)`,
      [email, hash, name],
    )
  }
  console.log(`Super Administrator ready: ${email}`)
})
