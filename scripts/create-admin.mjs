import { randomBytes, scryptSync } from 'node:crypto'
import { createInterface } from 'node:readline'
import { loadEnv, withClient } from './db.mjs'

loadEnv()

// Reads a line without echoing it, so the password never lands in shell
// history, process listings or an env file.
function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl._writeToOutput = (text) => {
      if (text.includes(question)) process.stdout.write(text)
    }
    rl.question(question, (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer)
    })
  })
}

async function readPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD
  if (!process.stdin.isTTY) return undefined
  const first = await promptHidden('New Super Administrator password: ')
  const second = await promptHidden('Repeat password: ')
  if (first !== second) {
    console.error('Passwords do not match.')
    process.exit(1)
  }
  return first
}

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const name = process.env.ADMIN_NAME?.trim() || 'Super Administrator'

if (!email) {
  console.error('Set ADMIN_EMAIL (and optionally ADMIN_NAME), then rerun. You will be prompted for the password.')
  process.exit(1)
}

const password = await readPassword()
if (!password) {
  console.error('Set ADMIN_PASSWORD or run in an interactive terminal to be prompted for it.')
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
