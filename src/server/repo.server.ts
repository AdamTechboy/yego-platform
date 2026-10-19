import type { PoolClient } from 'pg'
import type { Application } from '@/lib/fixtures'

import {
  AGENCIES,
  APPLICATION_STAGES,
  TRAINING_MODULES,
  type ApplicationStatus,
  type IncidentStatus,
} from '@/lib/fixtures'
import { can } from '@/lib/permissions'
import { STATES } from '@/lib/nigeria'
import { audit, mapAuthUser, requireCapability, sessionDto } from './auth.server'
import { one, query, transaction } from './db.server'
import {
  groupBy,
  mapAnnouncement,
  mapApplication,
  mapIncident,
  mapNotification,
  mapWarning,
  type AnnouncementRow,
  type ApplicationRow,
  type HistoryRow,
  type IncidentRow,
  type WarningRow,
} from './dto.server'
import { AppError, encryptNin, normalizePhone } from './security.server'
import { canAccessLga, canAccessState, scopeClause, type AuthUser } from './scope.server'

export interface BootstrapData {
  session: ReturnType<typeof sessionDto> | null
  applications: ReturnType<typeof mapApplication>[]
  incidents: ReturnType<typeof mapIncident>[]
  warnings: ReturnType<typeof mapWarning>[]
  announcements: ReturnType<typeof mapAnnouncement>[]
  notifications: ReturnType<typeof mapNotification>[]
  ready: true
}

const EMPTY: BootstrapData = {
  session: null,
  applications: [],
  incidents: [],
  warnings: [],
  announcements: [],
  notifications: [],
  ready: true,
}

function scopeParams(user: AuthUser, stateColumn: string, lgaColumn: string) {
  return scopeClause(user, stateColumn, lgaColumn, 1)
}

export async function bootstrap(user: AuthUser | null): Promise<BootstrapData> {
  if (!user) return EMPTY

  const isGuardUser = user.kind === 'guard'
  const masked = !isGuardUser && !can(user.role, 'screen:applicants')

  let applicationSql = 'select * from applications'
  let applicationParams: unknown[] = []
  if (isGuardUser) {
    applicationSql += ' where id = $1'
    applicationParams = [user.application_id]
  } else if (!can(user.role, 'view:analytics')) {
    applicationSql += ' where false'
  } else {
    const scope = scopeParams(user, 'state_of_residence', 'lga')
    if (scope.sql !== 'true') {
      applicationSql += ` where ${scope.sql}`
      applicationParams = scope.params
    }
  }
  applicationSql += ' order by submitted_at desc limit 500'

  const applications = (await query<ApplicationRow>(applicationSql, applicationParams)).rows
  const applicationIds = applications.map((row) => row.id)
  const applicationHistory = applicationIds.length
    ? (
        await query<HistoryRow>(
          `select * from application_history where application_id = any($1::uuid[]) order by created_at`,
          [applicationIds],
        )
      ).rows
    : []
  const historyByApplication = groupBy(applicationHistory, (row) => row.application_id ?? null)

  let incidentSql = 'select * from incidents'
  let incidentParams: unknown[] = []
  if (isGuardUser) {
    incidentSql += ' where reporter_user_id = $1'
    incidentParams = [user.id]
  } else if (!can(user.role, 'view:incidents')) {
    incidentSql += ' where false'
  } else {
    const scope = scopeParams(user, 'state', 'lga')
    if (scope.sql !== 'true') {
      incidentSql += ` where ${scope.sql}`
      incidentParams = scope.params
    }
  }
  incidentSql += ' order by reported_at desc limit 500'

  const incidents = (await query<IncidentRow>(incidentSql, incidentParams)).rows
  const incidentIds = incidents.map((row) => row.id)

  const evidence = incidentIds.length
    ? (
        await query<{ incident_id: string; kind: 'photo' | 'video' | 'document'; file_name: string }>(
          'select incident_id, kind, file_name from incident_evidence where incident_id = any($1::uuid[])',
          [incidentIds],
        )
      ).rows
    : []
  const evidenceByIncident = groupBy(evidence, (row) => row.incident_id)

  const incidentHistory = incidentIds.length
    ? (
        await query<HistoryRow>(
          `select * from incident_history where incident_id = any($1::uuid[]) order by created_at`,
          [incidentIds],
        )
      ).rows
    : []
  const historyByIncident = groupBy(incidentHistory, (row) => row.incident_id ?? null)

  const referrals = incidentIds.length
    ? (
        await query<{ incident_id: string; agency_code: string; created_at: Date; actor_name: string | null }>(
          `select r.incident_id, r.agency_code, r.created_at, u.name as actor_name
           from incident_referrals r left join users u on u.id = r.created_by
           where r.incident_id = any($1::uuid[]) order by r.created_at`,
          [incidentIds],
        )
      ).rows
    : []
  const referralsByIncident = groupBy(referrals, (row) => row.incident_id)

  let warningSql = 'select * from early_warnings'
  let warningParams: unknown[] = []
  if (isGuardUser) {
    warningSql += " where state = $1 and access = 'All Guards in area'"
    warningParams = [user.scope_state]
  } else if (!can(user.role, 'view:early-warning')) {
    warningSql += ' where false'
  } else {
    const scope = scopeParams(user, 'state', 'lga')
    if (scope.sql !== 'true') {
      warningSql += ` where ${scope.sql}`
      warningParams = scope.params
    }
  }
  warningSql += ' order by created_at desc limit 200'

  const warnings = (await query<WarningRow>(warningSql, warningParams)).rows
  const announcements = (await query<AnnouncementRow>('select * from announcements order by created_at desc limit 200')).rows
  const notifications = (
    await query<{
      id: string
      kind: string
      title: string
      body: string
      entity_type: string | null
      entity_id: string | null
      read_at: Date | null
      created_at: Date
    }>('select * from notifications where user_id = $1 order by created_at desc limit 50', [user.id])
  ).rows

  const guardPublicId = isGuardUser ? applications[0]?.public_id : undefined

  return {
    session: sessionDto(user, guardPublicId),
    applications: applications.map((row) =>
      mapApplication(row, { history: historyByApplication.get(row.id) ?? [], maskSensitive: masked }),
    ),
    incidents: incidents.map((row) =>
      mapIncident(row, {
        evidence: (evidenceByIncident.get(row.id) ?? []).map((item) => ({ kind: item.kind, name: item.file_name })),
        history: historyByIncident.get(row.id) ?? [],
        referrals: (referralsByIncident.get(row.id) ?? []).map((item) => ({
          agency: item.agency_code,
          at: item.created_at.toISOString(),
          by: item.actor_name ?? 'System',
        })),
      }),
    ),
    warnings: warnings.map(mapWarning),
    announcements: announcements.map(mapAnnouncement),
    notifications: notifications.map(mapNotification),
    ready: true,
  }
}

async function nextRef(client: PoolClient, sequence: string, prefix: (value: string) => string, width: number) {
  const result = await client.query<{ n: string }>(`select nextval('${sequence}')::text as n`)
  return prefix(result.rows[0].n.padStart(width, '0'))
}

export async function createApplication(input: Record<string, unknown>): Promise<Application> {
  const created = await transaction(async (client) => {
    const publicId = await nextRef(client, 'application_ref_seq', (n) => `YG-APP-${n.slice(-6)}`, 6)
    const email = String(input.email).trim()
    const phone = normalizePhone(String(input.phone))
    const whatsapp = normalizePhone(String(input.whatsapp))
    const nin = String(input.nin)
    const photo = String(input.photo)

    const inserted = await client.query<ApplicationRow>(
      `insert into applications
        (public_id, full_name, gender, date_of_birth, phone, whatsapp, email,
         nin_ciphertext, nin_last4, state_of_origin, state_of_residence, lga, ward,
         preferred_polling_unit, polling_unit, background, experience, photo_data)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       returning *`,
      [
        publicId,
        String(input.fullName).trim(),
        input.gender,
        input.dateOfBirth,
        phone,
        whatsapp,
        email,
        encryptNin(nin),
        nin.slice(-4),
        input.stateOfOrigin,
        input.stateOfResidence,
        input.lga,
        String(input.ward).trim(),
        String(input.pollingUnit ?? '').trim() || null,
        String(input.pollingUnit ?? '').trim() || 'To be assigned',
        input.background,
        String(input.experience ?? '').trim(),
        photo,
      ],
    )
    const app = inserted.rows[0]

    await client.query(
      `insert into application_history (application_id, action, to_status, actor_label)
       values ($1,'Application Submitted','Application Submitted','Applicant')`,
      [app.id],
    )
    for (const kind of ['non_partisanship', 'code_of_conduct', 'data_use']) {
      await client.query(
        `insert into consent_records (application_id, kind, version) values ($1,$2,'2026-10')`,
        [app.id, kind],
      )
    }

    return app
  })

  await audit(null, 'application.submitted', 'application', created.public_id)
  return loadApplication(created.public_id)
}

export async function lookupApplication(applicationId: string, phone: string, ip: string | null) {
  const publicId = applicationId.trim().toUpperCase()
  const normalized = normalizePhone(phone)

  const failures = await one<{ n: number }>(
    `select count(*)::int as n from audit_log
     where action = 'application.lookup.failed'
       and ($1::text is null or ip = $1)
       and created_at > now() - interval '15 minutes'`,
    [ip],
  )
  if ((failures?.n ?? 0) >= 10) {
    throw new AppError('Too many status lookups. Try again in 15 minutes.', 429)
  }

  const app = await one<ApplicationRow>(
    'select * from applications where upper(public_id) = $1 and phone = $2',
    [publicId, normalized],
  )

  if (!app) {
    await query(
      `insert into audit_log (actor_label, action, entity_type, entity_id, outcome, ip)
       values ('Anonymous','application.lookup.failed','application',$1,'failure',$2)`,
      [publicId, ip],
    )
    throw new AppError('No application matches that ID and phone number. Check both and try again.', 404)
  }

  const history = (
    await query<HistoryRow>('select * from application_history where application_id = $1 order by created_at', [app.id])
  ).rows

  await query(
    `insert into audit_log (actor_label, action, entity_type, entity_id, outcome, ip)
     values ('Applicant','application.lookup','application',$1,'success',$2)`,
    [publicId, ip],
  )

  return mapApplication(app, { history, maskSensitive: true })
}

export async function confirmWhatsApp(applicationId: string, phone: string) {
  const publicId = applicationId.trim().toUpperCase()
  const normalized = normalizePhone(phone)
  const result = await query(
    `update applications set whatsapp_confirmed_at = coalesce(whatsapp_confirmed_at, now())
     where upper(public_id) = $1 and phone = $2 returning public_id`,
    [publicId, normalized],
  )
  if (!result.rowCount) throw new AppError('Application not found.', 404)
  await audit(null, 'application.whatsapp_confirmed', 'application', publicId)
  return { confirmed: true }
}

function canManageIncident(user: AuthUser, incident: IncidentRow): void {
  if (user.scope_kind === 'lga') {
    if (!canAccessLga(user, incident.state, incident.lga)) {
      throw new AppError('This incident is outside your assigned area.', 403)
    }
    return
  }
  if (!canAccessState(user, incident.state)) {
    throw new AppError('This incident is outside your assigned area.', 403)
  }
}

function adminSeesState(admin: Record<string, unknown>, state: string, lga: string): boolean {
  const user = mapAuthUser(admin)
  if (user.scope_kind === 'national') return true
  if (user.scope_kind === 'zone') return canAccessState(user, state)
  if (user.scope_kind === 'state') return user.scope_state === state
  if (user.scope_kind === 'lga') return user.scope_state === state && user.scope_lga === lga
  return false
}

const INCIDENT_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  Reported: ['Received', 'Under Review', 'Verified', 'Unverified'],
  Received: ['Under Review', 'Verified', 'Unverified'],
  'Under Review': ['Verified', 'Unverified'],
  Verified: ['Referred/Actioned', 'Closed'],
  Unverified: ['Closed'],
  'Referred/Actioned': ['Closed'],
  Closed: [],
}

export async function submitIncident(user: AuthUser, input: Record<string, unknown>) {
  if (user.kind !== 'guard' || !user.application_id) {
    throw new AppError('Only a deployed YEGO Guard can submit an incident.', 403)
  }

  const created = await transaction(async (client) => {
    const appResult = await client.query<ApplicationRow>('select * from applications where id = $1', [user.application_id])
    const app = appResult.rows[0]
    if (!app) throw new AppError('Guard profile not found.', 404)
    if (app.status !== 'Certified/Active') {
      throw new AppError('Election-Day reporting unlocks after certification.', 403)
    }

    const publicId = await nextRef(client, 'incident_ref_seq', (n) => `INC-${new Date().getFullYear()}-${n.slice(-6)}`, 6)
    const inserted = await client.query<IncidentRow>(
      `insert into incidents
        (public_id, type, description, severity, state, lga, ward, polling_unit, lat, lng,
         occurred_at, reporter_name, reporter_id, reporter_user_id, status, category, election_day)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'Reported',$15,$16)
       returning *`,
      [
        publicId,
        input.type,
        input.description,
        input.severity,
        app.state_of_residence,
        app.lga,
        app.ward,
        app.polling_unit,
        input.lat,
        input.lng,
        input.occurredAt,
        app.full_name,
        app.yego_id ?? app.public_id,
        user.id,
        input.category ?? null,
        Boolean(input.electionDay),
      ],
    )
    const incident = inserted.rows[0]

    const evidence = (input.evidence ?? []) as { kind: string; name: string }[]
    for (const item of evidence) {
      await client.query(
        `insert into incident_evidence (incident_id, kind, file_name, storage_key)
         values ($1,$2,$3,null)`,
        [incident.id, item.kind, item.name],
      )
    }

    await client.query(
      `insert into incident_history (incident_id, action, to_status, actor_label)
       values ($1,'Reported','Reported',$2)`,
      [incident.id, `${app.full_name} (YEGO Guard)`],
    )

    const admins = (await client.query<Record<string, unknown>>("select * from users where kind = 'command' and active = true")).rows
    for (const row of admins) {
      const role = String(row.role)
      if (!can(role, 'view:incidents') || !adminSeesState(row, incident.state, incident.lga)) continue
      await client.query(
        `insert into notifications (user_id, kind, title, body, entity_type, entity_id)
         values ($1,'incident',$2,$3,'incident',$4)`,
        [
          row.id,
          `New ${String(input.severity).toLowerCase()} incident reported`,
          `${input.type} · ${app.polling_unit}, ${app.lga}, ${app.state_of_residence}`,
          publicId,
        ],
      )
    }

    return incident
  })

  await audit(user, 'incident.reported', 'incident', created.public_id, { severity: input.severity, type: input.type })
  return loadIncident(created.public_id)
}

export async function loadIncident(publicId: string) {
  const row = await one<IncidentRow>('select * from incidents where public_id = $1', [publicId])
  if (!row) throw new AppError('Incident not found.', 404)
  const evidence = (
    await query<{ kind: 'photo' | 'video' | 'document'; file_name: string }>(
      'select kind, file_name from incident_evidence where incident_id = $1',
      [row.id],
    )
  ).rows
  const history = (
    await query<HistoryRow>('select * from incident_history where incident_id = $1 order by created_at', [row.id])
  ).rows
  const referrals = (
    await query<{ agency_code: string; created_at: Date; actor_name: string | null }>(
      `select r.agency_code, r.created_at, u.name as actor_name
       from incident_referrals r left join users u on u.id = r.created_by
       where r.incident_id = $1 order by r.created_at`,
      [row.id],
    )
  ).rows
  return mapIncident(row, {
    evidence: evidence.map((item) => ({ kind: item.kind, name: item.file_name })),
    history,
    referrals: referrals.map((item) => ({ agency: item.agency_code, at: item.created_at.toISOString(), by: item.actor_name ?? 'System' })),
  })
}

export async function setIncidentStatus(
  user: AuthUser,
  input: { incidentId: string; status: IncidentStatus; note?: string; category?: string },
) {
  requireCapability(user, 'verify:incidents')
  const row = await one<IncidentRow>('select * from incidents where public_id = $1', [input.incidentId.toUpperCase()])
  if (!row) throw new AppError('Incident not found.', 404)
  canManageIncident(user, row)

  if (!INCIDENT_TRANSITIONS[row.status].includes(input.status)) {
    throw new AppError(`An incident cannot move from “${row.status}” to “${input.status}”.`, 409)
  }

  await transaction(async (client) => {
    await client.query('update incidents set status = $1, category = coalesce($2, category) where id = $3', [
      input.status,
      input.category ?? null,
      row.id,
    ])
    await client.query(
      `insert into incident_history (incident_id, action, from_status, to_status, note, actor_user_id, actor_label)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [row.id, input.status, row.status, input.status, input.note ?? null, user.id, `${user.name} (${user.role})`],
    )
    const reporter = await client.query<{ id: string }>('select id from users where application_id in (select id from applications where full_name = $1) limit 1', [row.reporter_name])
    if (reporter.rows[0]) {
      await client.query(
        `insert into notifications (user_id, kind, title, body, entity_type, entity_id)
         values ($1,'incident_update','Incident update',$2,'incident',$3)`,
        [reporter.rows[0].id, `${row.public_id} is now “${input.status}”.`, row.public_id],
      )
    }
  })

  await audit(user, 'incident.status_changed', 'incident', row.public_id, { from: row.status, to: input.status })
  return loadIncident(row.public_id)
}

export async function addIncidentNote(
  user: AuthUser,
  input: { incidentId: string; action: string; note: string },
) {
  requireCapability(user, 'verify:incidents')
  const row = await one<IncidentRow>('select * from incidents where public_id = $1', [input.incidentId.toUpperCase()])
  if (!row) throw new AppError('Incident not found.', 404)
  canManageIncident(user, row)
  await query(
    `insert into incident_history (incident_id, action, note, actor_user_id, actor_label)
     values ($1,$2,$3,$4,$5)`,
    [row.id, input.action, input.note, user.id, `${user.name} (${user.role})`],
  )
  await audit(user, 'incident.note_added', 'incident', row.public_id, { action: input.action })
  return loadIncident(row.public_id)
}

export async function referIncident(
  user: AuthUser,
  input: { incidentId: string; agencies: string[]; note?: string },
) {
  requireCapability(user, 'refer:incidents')
  const row = await one<IncidentRow>('select * from incidents where public_id = $1', [input.incidentId.toUpperCase()])
  if (!row) throw new AppError('Incident not found.', 404)
  canManageIncident(user, row)
  if (!['Verified', 'Referred/Actioned'].includes(row.status)) {
    throw new AppError('Only verified incidents can be referred.', 409)
  }

  const chosen = AGENCIES.filter((agency) => input.agencies.includes(agency.code))
  if (!chosen.length) throw new AppError('Choose at least one agency.', 400)

  await transaction(async (client) => {
    for (const agency of chosen) {
      const referral = await client.query<{ id: string }>(
        `insert into incident_referrals (incident_id, agency_code, agency_name, note, status, created_by)
         values ($1,$2,$3,$4,'pending_manual',$5) returning id`,
        [row.id, agency.code, agency.name, input.note ?? null, user.id],
      )
      await client.query(
        `insert into referral_events (referral_id, event, detail, actor_user_id)
         values ($1,'created','Recorded for manual delivery — no external integration is configured.',$2)`,
        [referral.rows[0].id, user.id],
      )
    }
    if (row.status === 'Verified') {
      await client.query("update incidents set status = 'Referred/Actioned' where id = $1", [row.id])
      await client.query(
        `insert into incident_history (incident_id, action, from_status, to_status, note, actor_user_id, actor_label)
         values ($1,'Referred/Actioned',$2,'Referred/Actioned',$3,$4,$5)`,
        [row.id, row.status, input.note ?? `Referral recorded for ${chosen.map((a) => a.code).join(', ')}`, user.id, `${user.name} (${user.role})`],
      )
    }
  })

  await audit(user, 'incident.referred', 'incident', row.public_id, { agencies: chosen.map((a) => a.code) })
  return loadIncident(row.public_id)
}

export async function setApplicationStatus(
  user: AuthUser,
  input: { applicationId: string; status: ApplicationStatus; note?: string },
) {
  const row = await one<ApplicationRow>('select * from applications where public_id = $1', [input.applicationId.toUpperCase()])
  if (!row) throw new AppError('Application not found.', 404)
  if (!canAccessLga(user, row.state_of_residence, row.lga) && !canAccessState(user, row.state_of_residence)) {
    throw new AppError('This application is outside your assigned area.', 403)
  }

  const targetIndex = APPLICATION_STAGES.indexOf(input.status as (typeof APPLICATION_STAGES)[number])
  const needsApproval = input.status === 'Not Approved' || targetIndex >= APPLICATION_STAGES.indexOf('Approved')
  requireCapability(user, needsApproval ? 'approve:verification' : 'screen:applicants')

  if (row.status === 'Not Approved' || row.status === 'Certified/Active' || input.status === 'Not Approved') {
    if (row.status === input.status) return loadApplication(row.public_id)
    if (row.status === 'Not Approved') throw new AppError('A rejected application cannot be re-opened here.', 409)
    if (row.status === 'Certified/Active') throw new AppError('A certified Guard cannot be moved backwards.', 409)
  } else {
    const currentIndex = APPLICATION_STAGES.indexOf(row.status as (typeof APPLICATION_STAGES)[number])
    if (targetIndex !== currentIndex + 1) {
      throw new AppError(`An application cannot jump from “${row.status}” to “${input.status}”.`, 409)
    }
  }

  await transaction(async (client) => {
    if (input.status === 'Certified/Active') {
      if (row.training_progress < 100) {
        throw new AppError('Training must be completed before certification.', 409)
      }
      const stateCode = STATES.find((state) => state.name === row.state_of_residence)?.code ?? 'NG'
      const yegoId = row.yego_id ?? `YEGO/${stateCode}/${row.public_id.slice(-4)}`
      const certificate = await client.query<{ n: string }>("select nextval('certificate_ref_seq')::text as n")
      const certificateNo = `YEGO-CERT-${certificate.rows[0].n.padStart(4, '0')}`
      await client.query('update applications set status = $1, yego_id = coalesce(yego_id, $2) where id = $3', [
        input.status,
        yegoId,
        row.id,
      ])
      await client.query(
        `insert into certificates (application_id, certificate_no, issued_by) values ($1,$2,$3)
         on conflict (application_id) do nothing`,
        [row.id, certificateNo, user.id],
      )
    } else {
      await client.query('update applications set status = $1 where id = $2', [input.status, row.id])
    }

    await client.query(
      `insert into application_history (application_id, action, from_status, to_status, note, actor_user_id, actor_label)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [row.id, input.status, row.status, input.status, input.note ?? null, user.id, `${user.name} (${user.role})`],
    )

    const guard = await client.query<{ id: string }>('select id from users where application_id = $1', [row.id])
    if (guard.rows[0]) {
      await client.query(
        `insert into notifications (user_id, kind, title, body, entity_type, entity_id)
         values ($1,'application_update','Application update',$2,'application',$3)`,
        [guard.rows[0].id, `Your application is now “${input.status}”.`, row.public_id],
      )
    }
  })

  await audit(user, 'application.status_changed', 'application', row.public_id, { from: row.status, to: input.status })
  return loadApplication(row.public_id)
}

export async function assignPollingUnit(
  user: AuthUser,
  input: { applicationId: string; ward: string; pollingUnit: string },
) {
  requireCapability(user, 'assign:polling-units')
  const row = await one<ApplicationRow>('select * from applications where public_id = $1', [input.applicationId.toUpperCase()])
  if (!row) throw new AppError('Application not found.', 404)
  if (!canAccessLga(user, row.state_of_residence, row.lga)) {
    throw new AppError('This application is outside your assigned area.', 403)
  }
  await query('update applications set ward = $1, polling_unit = $2 where id = $3', [
    input.ward,
    input.pollingUnit,
    row.id,
  ])
  await query(
    `insert into application_history (application_id, action, note, actor_user_id, actor_label)
     values ($1,'Polling unit assigned',$2,$3,$4)`,
    [row.id, `${input.ward} · ${input.pollingUnit}`, user.id, `${user.name} (${user.role})`],
  )
  await audit(user, 'application.polling_unit_assigned', 'application', row.public_id, {
    ward: input.ward,
    pollingUnit: input.pollingUnit,
  })
  return loadApplication(row.public_id)
}

export async function loadApplication(publicId: string) {
  const row = await one<ApplicationRow>('select * from applications where public_id = $1', [publicId])
  if (!row) throw new AppError('Application not found.', 404)
  const history = (
    await query<HistoryRow>('select * from application_history where application_id = $1 order by created_at', [row.id])
  ).rows
  return mapApplication(row, { history })
}

export async function submitTrainingQuiz(
  user: AuthUser,
  input: { moduleId: string; answers: number[] },
) {
  if (user.kind !== 'guard' || !user.application_id) {
    throw new AppError('Only a YEGO Guard can take training assessments.', 403)
  }
  const module = TRAINING_MODULES.find((item) => item.id === input.moduleId)
  if (!module) throw new AppError('Training module not found.', 404)

  const app = await one<ApplicationRow>('select * from applications where id = $1', [user.application_id])
  if (!app) throw new AppError('Guard profile not found.', 404)

  const passedRows = await query<{ module_id: string }>(
    'select distinct module_id from training_attempts where application_id = $1 and passed = true',
    [app.id],
  )
  const passed = new Set(passedRows.rows.map((row) => row.module_id))
  const moduleIndex = TRAINING_MODULES.indexOf(module)
  if (moduleIndex > passed.size) {
    throw new AppError('Complete the earlier modules first.', 409)
  }

  const correct =
    input.answers.length === module.quiz.length && module.quiz.every((question, index) => question.answer === input.answers[index])

  await query(
    `insert into training_attempts (application_id, module_id, answers, score, passed)
     values ($1,$2,$3,$4,$5)`,
    [app.id, module.id, JSON.stringify(input.answers), correct ? 100 : 0, correct],
  )

  if (!correct) {
    return { passed: false, progress: app.training_progress, status: app.status }
  }

  passed.add(module.id)
  const progress = Math.round((passed.size / TRAINING_MODULES.length) * 100)
  const nextStatus: ApplicationStatus =
    passed.size >= TRAINING_MODULES.length ? 'Training Completed' : app.status === 'Certified/Active' ? app.status : 'Training Required'

  await query('update applications set training_progress = $1, status = $2 where id = $3', [progress, nextStatus, app.id])
  if (nextStatus === 'Training Completed' && app.status !== 'Training Completed') {
    await query(
      `insert into application_history (application_id, action, from_status, to_status, actor_user_id, actor_label)
       values ($1,'Training Completed',$2,'Training Completed',$3,$4)`,
      [app.id, app.status, user.id, `${user.name} (YEGO Guard)`],
    )
  }
  await audit(user, 'training.quiz_completed', 'application', app.public_id, { moduleId: module.id, progress })
  return { passed: true, progress, status: nextStatus }
}

export async function raiseWarning(
  user: AuthUser,
  input: { type: string; title: string; summary: string; evidenceCount: number },
) {
  if (user.kind !== 'guard' || !user.application_id) {
    throw new AppError('Only a YEGO Guard can raise an early warning.', 403)
  }
  const app = await one<ApplicationRow>('select * from applications where id = $1', [user.application_id])
  if (!app) throw new AppError('Guard profile not found.', 404)
  const state = STATES.find((item) => item.name === app.state_of_residence)

  const created = await transaction(async (client) => {
    const publicId = await nextRef(client, 'warning_ref_seq', (n) => `EW-${new Date().getFullYear()}-${n.slice(-4)}`, 4)
    const row = await client.query<{ id: string; public_id: string }>(
      `insert into early_warnings
        (public_id, type, title, summary, state, lga, level, access, raised_by_user_id, raised_by_label, evidence_count, lat, lng)
       values ($1,$2,$3,$4,$5,$6,'Watch','Command only',$7,$8,$9,$10,$11)
       returning id, public_id`,
      [
        publicId,
        input.type,
        input.title,
        input.summary,
        app.state_of_residence,
        app.lga,
        user.id,
        `Guard ${app.yego_id ?? app.public_id}`,
        input.evidenceCount,
        (state?.lat ?? 9) + (Math.random() - 0.5) * 0.1,
        (state?.lng ?? 8) + (Math.random() - 0.5) * 0.1,
      ],
    )

    const admins = (await client.query<Record<string, unknown>>("select * from users where kind = 'command' and active = true")).rows
    for (const admin of admins) {
      if (!can(String(admin.role), 'view:early-warning')) continue
      if (!adminSeesState(admin, app.state_of_residence, app.lga)) continue
      await client.query(
        `insert into notifications (user_id, kind, title, body, entity_type, entity_id)
         values ($1,'warning',$2,$3,'warning',$4)`,
        [admin.id, `Early warning: ${input.title}`, `${app.lga}, ${app.state_of_residence}`, publicId],
      )
    }

    return row.rows[0]
  })

  await audit(user, 'warning.raised', 'warning', created.public_id, { type: input.type })
  return { id: created.public_id }
}

export async function postAnnouncement(
  user: AuthUser,
  input: { kind: string; title: string; body: string; audience?: string },
) {
  const canNational = can(user.role, 'send:national')
  const canState = can(user.role, 'send:state')
  if (!canNational && !canState) throw new AppError('Your role cannot send messages.', 403)

  let tier: 'National Command' | 'Regional/State' | 'LGA/Field'
  let fromLabel: string
  let audience: string

  if (canNational && user.scope_kind === 'national') {
    tier = 'National Command'
    fromLabel = 'National Command'
    audience = input.audience ?? 'All Guards'
  } else if (user.scope_kind === 'zone') {
    tier = 'Regional/State'
    fromLabel = `${user.scope_zone ?? 'Regional'} Coordination`
    audience = `${user.scope_zone ?? 'Zone'} Guards`
  } else if (user.scope_kind === 'state') {
    tier = 'Regional/State'
    fromLabel = `${user.scope_state ?? 'State'} State Coordination`
    audience = `${user.scope_state ?? 'State'} Guards`
  } else if (user.scope_kind === 'lga') {
    tier = 'LGA/Field'
    fromLabel = `${user.scope_lga ?? 'LGA'} LGA Desk`
    audience = `${user.scope_lga ?? 'LGA'} Guards`
  } else {
    throw new AppError('Your account has no messaging scope.', 403)
  }

  const inserted = await one<AnnouncementRow>(
    `insert into announcements (from_label, tier, kind, title, body, audience, created_by)
     values ($1,$2,$3,$4,$5,$6,$7) returning *`,
    [fromLabel, tier, input.kind, input.title, input.body, audience, user.id],
  )
  if (!inserted) throw new AppError('Could not save the message.', 500)
  await audit(user, 'announcement.posted', 'announcement', inserted.id, { audience })
  return mapAnnouncement(inserted)
}

export async function getNotifications(user: AuthUser) {
  const rows = (
    await query<{
      id: string
      kind: string
      title: string
      body: string
      entity_type: string | null
      entity_id: string | null
      read_at: Date | null
      created_at: Date
    }>('select * from notifications where user_id = $1 order by created_at desc limit 50', [user.id])
  ).rows
  return rows.map(mapNotification)
}

export async function markNotificationsRead(user: AuthUser, ids: string[]) {
  if (!ids.length) return { updated: 0 }
  const result = await query(
    'update notifications set read_at = now() where user_id = $1 and id = any($2::uuid[]) and read_at is null',
    [user.id, ids],
  )
  return { updated: result.rowCount ?? 0 }
}

export async function checkIn(user: AuthUser, lat?: number, lng?: number) {
  if (user.kind !== 'guard' || !user.application_id) {
    throw new AppError('Only a YEGO Guard can check in.', 403)
  }
  const app = await one<ApplicationRow>('select * from applications where id = $1', [user.application_id])
  if (!app) throw new AppError('Guard profile not found.', 404)
  await query('insert into check_ins (application_id, polling_unit, lat, lng) values ($1,$2,$3,$4)', [
    app.id,
    app.polling_unit,
    lat ?? null,
    lng ?? null,
  ])
  await audit(user, 'guard.checked_in', 'application', app.public_id)
  return { checkedInAt: new Date().toISOString() }
}

export { EMPTY }
