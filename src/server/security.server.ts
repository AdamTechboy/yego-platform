import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 } as const

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, SCRYPT.keylen, SCRYPT)
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64url')}$${hash.toString('base64url')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, n, r, p, saltB64, hashB64] = stored.split('$')
  if (algo !== 'scrypt' || !saltB64 || !hashB64) return false
  const salt = Buffer.from(saltB64, 'base64url')
  const expected = Buffer.from(hashB64, 'base64url')
  const actual = scryptSync(password, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  })
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function encryptionKey(): Buffer {
  const configured = process.env.NIN_ENCRYPTION_KEY
  if (configured) {
    const key = Buffer.from(configured, 'base64')
    if (key.length !== 32) throw new Error('NIN_ENCRYPTION_KEY must be 32 bytes, base64 encoded')
    return key
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NIN_ENCRYPTION_KEY is required in production')
  }
  return createHash('sha256').update(process.env.SESSION_SECRET ?? 'yego-development-only').digest()
}

export function encryptNin(nin: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(nin, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`
}

export function decryptNin(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(':')
  if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) throw new Error('Malformed NIN payload')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivB64, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]).toString('utf8')
}

export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (digits.startsWith('234')) return `0${digits.slice(3)}`
  if (digits.startsWith('0')) return digits
  return digits
}

export function validNigerianPhone(input: string): boolean {
  return /^0[789][01]\d{8}$/.test(normalizePhone(input))
}

export function ageFromDateOfBirth(dob: string): number {
  const birth = new Date(dob)
  if (Number.isNaN(birth.getTime())) return -1
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age -= 1
  return age
}

export class AppError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'AppError'
    this.status = status
  }
}
