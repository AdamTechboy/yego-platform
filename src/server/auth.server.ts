import { randomUUID } from 'node:crypto'

import {
  deleteCookie,
  getCookie,
  getRequestHeaders,
  getRequestIP,
  setCookie,
} from '@tanstack/react-start/server'

import { can, type Capability } from '@/lib/permissions'
import type { ApplicationRow, SessionDto } from './dto.server'
import { one, query, transaction } from './db.server'
import { hashPassword, normalizePhone, randomToken, sha256, verifyPassword, AppError } from './security.server'
import { scopeLabel, type AuthUser, type Role, type ScopeKind } from './scope.server'

const COOKIE = 'yego_session'
const TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_FAILURES = 8
const WINDOW_MINUTES = 15
const isMysql = () => process.env.DB_ENGINE === 'mysql'

function requestIp(): string | null {
  try {
    return getRequestIP() ?? null
  } catch {
    return null
  }
}

function requestAgent(): string | null {
  try {
    return getRequestHeaders().get('user-agent') ?? null
  } catch {
    return null
  }
}

function secureCookies(): boolean {
  if (process.env.COOKIE_SECURE) return process.env.COOKIE_SECURE === 'true'
  if (process.env.NODE_ENV === 'production') return true
  try {
    return getRequestHeaders().get('x-forwarded-proto') === 'https'
  } catch {
    return false
  }
}

function meta() {
  return { ip: requestIp(), userAgent: requestAgent() }
}

export function assertSameOrigin(): void {
  const headers = getRequestHeaders()
  const origin = headers.get('origin')
  if (!origin) return
  const host = headers.get('host')
  try {
    if (!host || new URL(origin).host !== host) {
      throw new AppError('Cross-origin request blocked.', 403)
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError('Invalid request origin.', 403)
  }
}

async function audit(
  actor: AuthUser | null,
  action: string,
  entityType: string,
  entityId: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  const { ip } = meta()
  await query(
    `insert into audit_log (actor_user_id, actor_label, action, entity_type, entity_id, outcome, detail, ip)
     values ($1,$2,$3,$4,$5,'success',$6,$7)`,
    [actor?.id ?? null, actor ? `${actor.name} (${actor.role})` : 'System', action, entityType, entityId, JSON.stringify(detail), ip],
  )
}

export async function recordAuditFailure(
  actor: AuthUser | null,
  action: string,
  entityType: string,
  entityId: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  const { ip } = meta()
  await query(
    `insert into audit_log (actor_user_id, actor_label, action, entity_type, entity_id, outcome, detail, ip)
     values ($1,$2,$3,$4,$5,'failure',$6,$7)`,
    [actor?.id ?? null, actor ? `${actor.name} (${actor.role})` : 'Anonymous', action, entityType, entityId, JSON.stringify(detail), ip],
  )
}

export function mapAuthUser(row: Record<string, unknown>): AuthUser {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    role: String(row.role) as Role,
    kind: row.kind === 'guard' ? 'guard' : 'command',
    scope_kind: String(row.scope_kind) as ScopeKind,
    scope_zone: (row.scope_zone as string | null) ?? null,
    scope_state: (row.scope_state as string | null) ?? null,
    scope_lga: (row.scope_lga as string | null) ?? null,
    application_id: (row.application_id as string | null) ?? null,
  }
}

export async function currentUser(): Promise<AuthUser | null> {
  const token = getCookie(COOKIE)
  if (!token) return null
  const row = await one<Record<string, unknown> & { expires_at: Date }>(
    `select u.*, s.expires_at, s.id as session_id
     from sessions s join users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now() and u.active = true`,
    [sha256(token)],
  )
  if (!row) {
    deleteCookie(COOKIE, { path: '/' })
    return null
  }
  void query('update sessions set last_seen_at = now() where id = $1', [row.session_id]).catch(() => {})
  return mapAuthUser(row)
}

export async function requireUser(): Promise<AuthUser> {
  const user = await currentUser()
  if (!user) throw new AppError('Sign in to continue.', 401)
  return user
}

export async function requireCommand(): Promise<AuthUser> {
  const user = await requireUser()
  if (user.kind !== 'command') throw new AppError('Command access is required.', 403)
  return user
}

export function requireCapability(user: AuthUser, capability: Capability): void {
  if (!can(user.role, capability)) {
    throw new AppError(`Your role cannot perform this action (${capability}).`, 403)
  }
}

export function isGuard(user: AuthUser): boolean {
  return user.kind === 'guard'
}

export function sessionDto(user: AuthUser, applicationPublicId?: string): SessionDto {
  return {
    name: user.name,
    email: user.email,
    role: user.role,
    scope: scopeLabel(user),
    kind: user.kind,
    applicationId: applicationPublicId ?? user.application_id ?? undefined,
  }
}

async function createSession(user: AuthUser): Promise<void> {
  const token = randomToken(32)
  const { ip, userAgent } = meta()
  await query(
    isMysql()
      ? `insert into sessions (id, user_id, token_hash, expires_at, ip, user_agent) values ($1,$2,$3,$4,$5,$6)`
      : `insert into sessions (user_id, token_hash, expires_at, ip, user_agent) values ($1,$2,$3,$4,$5)`,
    isMysql()
      ? [randomUUID(), user.id, sha256(token), new Date(Date.now() + TTL_MS), ip, userAgent]
      : [user.id, sha256(token), new Date(Date.now() + TTL_MS), ip, userAgent],
  )
  setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookies(),
    path: '/',
    maxAge: Math.floor(TTL_MS / 1000),
  })
}

export async function destroySession(): Promise<void> {
  const token = getCookie(COOKIE)
  if (token) {
    await query('delete from sessions where token_hash = $1', [sha256(token)])
  }
  deleteCookie(COOKIE, { path: '/' })
}

async function assertNotRateLimited(email: string, ip: string | null): Promise<void> {
  const row = await one<{ n: number }>(
    isMysql()
      ? `select count(*) as n from login_attempts
         where (lower(email) = lower($1) or ($2 is not null and ip = $2))
         and success = false and created_at > date_sub(now(), interval 15 minute)`
      : `select count(*)::int as n from login_attempts
         where (lower(email) = lower($1) or ($2::text is not null and ip = $2))
         and success = false and created_at > now() - ($3 || ' minutes')::interval`,
    isMysql() ? [email, ip] : [email, ip, WINDOW_MINUTES],
  )
  if ((row?.n ?? 0) >= MAX_FAILURES) {
    throw new AppError('Too many sign-in attempts. Try again in 15 minutes.', 429)
  }
}

async function attempt(email: string, ip: string | null, success: boolean): Promise<void> {
  await query('insert into login_attempts (email, ip, success) values ($1,$2,$3)', [email.toLowerCase(), ip, success])
}

export async function loginCommand(input: { email: string; password: string }): Promise<SessionDto> {
  const { ip } = meta()
  const email = input.email.trim().toLowerCase()
  await assertNotRateLimited(email, ip)

  const row = await one<Record<string, unknown> & { password_hash: string }>(
    'select * from users where lower(email) = $1 and active = true',
    [email],
  )

  if (!row || !verifyPassword(input.password, row.password_hash)) {
    await attempt(email, ip, false)
    await recordAuditFailure(null, 'auth.login.failed', 'user', email)
    throw new AppError('Invalid email or password.', 401)
  }

  const user = mapAuthUser(row)
  if (user.kind !== 'command') {
    await attempt(email, ip, false)
    throw new AppError('Use the Guard / Applicant tab for this account.', 403)
  }

  await attempt(email, ip, true)
  await createSession(user)
  await audit(user, 'auth.login', 'user', user.id, { method: 'password' })
  return sessionDto(user)
}

export async function loginGuard(input: { applicationId: string; phone: string }): Promise<SessionDto> {
  const { ip } = meta()
  const publicId = input.applicationId.trim().toUpperCase()
  const phone = normalizePhone(input.phone)
  await assertNotRateLimited(publicId, ip)

  const app = await one<ApplicationRow & { id: string }>(
    'select * from applications where upper(public_id) = $1',
    [publicId],
  )

  if (!app || normalizePhone(app.phone) !== phone) {
    await attempt(publicId, ip, false)
    await recordAuditFailure(null, 'auth.guard.failed', 'application', publicId)
    throw new AppError('Application ID and phone number do not match our records.', 401)
  }

  const user = await transaction(async (client) => {
    const existing = await client.query('select * from users where application_id = $1', [app.id])
    if (existing.rows[0]) {
      const found = mapAuthUser(existing.rows[0])
      if (found.scope_state !== app.state_of_residence || found.scope_lga !== app.lga) {
        await client.query("update users set scope_kind = 'self', scope_state = $1, scope_lga = $2 where id = $3", [
          app.state_of_residence,
          app.lga,
          found.id,
        ])
        found.scope_kind = 'self'
        found.scope_state = app.state_of_residence
        found.scope_lga = app.lga
      }
      return found
    }

    const email = `guard-${app.public_id.toLowerCase()}@yego.local`
    const userId = randomUUID()
    const inserted = await client.query(
      isMysql()
        ? `insert into users (id, email, password_hash, name, role, kind, scope_kind, scope_state, scope_lga, application_id)
           values ($1,$2,$3,$4,'YEGO Guard','guard','self',$5,$6,$7)`
        : `insert into users (email, password_hash, name, role, kind, scope_kind, scope_state, scope_lga, application_id)
           values ($1,$2,$3,'YEGO Guard','guard','self',$4,$5,$6) returning *`,
      isMysql()
        ? [userId, email, hashPassword(randomToken(24)), app.full_name, app.state_of_residence, app.lga, app.id]
        : [email, hashPassword(randomToken(24)), app.full_name, app.state_of_residence, app.lga, app.id],
    )
    if (isMysql()) {
      const selected = await client.query('select * from users where id = $1', [userId])
      if (!selected.rows[0]) throw new Error('Created guard account could not be loaded')
      return mapAuthUser(selected.rows[0])
    }
    return mapAuthUser(inserted.rows[0])
  })

  await attempt(publicId, ip, true)
  await createSession(user)
  await audit(user, 'auth.login', 'user', user.id, { method: 'application-id' })
  return sessionDto(user, app.public_id)
}

export async function logout(): Promise<void> {
  const user = await currentUser()
  await destroySession()
  if (user) await audit(user, 'auth.logout', 'user', user.id)
}

export async function logAction(
  action: string,
  entityType: string,
  entityId: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  const user = await currentUser()
  await audit(user, action, entityType, entityId, detail)
}

export { audit }
