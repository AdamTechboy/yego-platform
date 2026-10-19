// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { mapAuthUser } from '@/server/auth.server'
import { query } from '@/server/db.server'
import {
  assignPollingUnit,
  bootstrap,
  createApplication,
  lookupApplication,
  referIncident,
  setApplicationStatus,
  setIncidentStatus,
  submitIncident,
  submitTrainingQuiz,
} from '@/server/repo.server'
import type { AuthUser } from '@/server/scope.server'

const PHOTO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const stamp = Date.now().toString(36)
let counter = 0
const createdApplications: string[] = []
const createdIncidents: string[] = []
const createdUsers: string[] = []

function nextPhone() {
  counter += 1
  return `0803${String(1000000 + counter).slice(-7)}`
}

async function makeApplication(overrides: Record<string, unknown> = {}) {
  counter += 1
  const application = await createApplication({
    fullName: `Test Applicant ${stamp}${counter}`,
    gender: 'Female',
    dateOfBirth: '1998-05-10',
    phone: nextPhone(),
    whatsapp: nextPhone(),
    nin: String(10000000000 + counter).slice(-11),
    email: `test-${stamp}-${counter}@example.ng`,
    stateOfOrigin: 'Kano',
    stateOfResidence: 'Kano',
    lga: 'Nasarawa',
    ward: 'Gwagwarwa',
    pollingUnit: 'PU 012 – Gwagwarwa Pri. Sch.',
    background: 'Student (tertiary)',
    experience: 'Campus voter education volunteer.',
    photo: PHOTO,
    nonPartisan: true,
    codeOfConduct: true,
    dataConsent: true,
    ...overrides,
  })
  createdApplications.push(application.id)
  return application
}

async function applicationRow(publicId: string) {
  return (
    await query<{ id: string; phone: string; state_of_residence: string; lga: string }>(
      'select id, phone, state_of_residence, lga from applications where public_id = $1',
      [publicId],
    )
  ).rows[0]
}

async function makeGuard(applicationId: string, state: string, lga: string): Promise<AuthUser> {
  const row = await query<Record<string, unknown>>(
    `insert into users (email, password_hash, name, role, kind, scope_kind, scope_state, scope_lga, application_id)
     values ($1,'test-only','Test Guard','YEGO Guard','guard','self',$2,$3,$4) returning *`,
    [`guard-${stamp}-${counter}-${Math.random().toString(36).slice(2, 6)}@test.local`, state, lga, applicationId],
  )
  createdUsers.push(String(row.rows[0].id))
  return mapAuthUser(row.rows[0])
}

let national: AuthUser
let verification: AuthUser
let lagosCoordinator: AuthUser

beforeAll(async () => {
  const healthy = await query<{ ok: number }>('select 1 as ok')
  expect(healthy.rows[0].ok).toBe(1)

  const nationalRow = await query<Record<string, unknown>>("select * from users where email = 'command@yego.ng'")
  const verificationRow = await query<Record<string, unknown>>("select * from users where email = 'verify@yego.ng'")
  const lagosRow = await query<Record<string, unknown>>("select * from users where email = 'lagos@yego.ng'")
  if (!nationalRow.rows[0] || !verificationRow.rows[0] || !lagosRow.rows[0]) {
    throw new Error('Seed accounts are missing. Run `pnpm db:seed --demo --reset` before integration tests.')
  }
  national = mapAuthUser(nationalRow.rows[0])
  verification = mapAuthUser(verificationRow.rows[0])
  lagosCoordinator = mapAuthUser(lagosRow.rows[0])
})

afterAll(async () => {
  if (createdApplications.length) {
    await query(
      'delete from notifications where entity_id = any($1::text[])',
      [createdApplications],
    )
    await query('delete from audit_log where entity_id = any($1::text[])', [createdApplications])
    await query('delete from applications where public_id = any($1::text[])', [createdApplications])
  }
  if (createdIncidents.length) {
    await query('delete from notifications where entity_id = any($1::text[])', [createdIncidents])
    await query('delete from audit_log where entity_id = any($1::text[])', [createdIncidents])
    await query('delete from incidents where public_id = any($1::text[])', [createdIncidents])
  }
  if (createdUsers.length) {
    await query('delete from users where id = any($1::uuid[])', [createdUsers])
  }
})

describe('applications', () => {
  it('persists an application and returns it in a new connection', async () => {
    const application = await makeApplication()
    const stored = await applicationRow(application.id)
    expect(stored).toBeTruthy()
    expect(stored.id).toBeTruthy()

    const fetched = await lookupApplication(application.id, (await query<{ phone: string }>(
      'select phone from applications where public_id = $1',
      [application.id],
    )).rows[0].phone, 'test-integration')
    expect(fetched.id).toBe(application.id)
    expect(fetched.status).toBe('Application Submitted')
    expect(fetched.history.length).toBeGreaterThan(0)
  })

  it('generates unique application IDs under concurrent submissions', async () => {
    const submissions = await Promise.all(Array.from({ length: 6 }, (_, index) => makeApplication({ phone: nextPhone(), email: `concurrent-${stamp}-${index}@example.ng` })))
    const ids = new Set(submissions.map((item) => item.id))
    expect(ids.size).toBe(submissions.length)
    const rows = await query<{ n: number }>('select count(*)::int as n from applications where public_id = any($1::text[])', [
      [...ids],
    ])
    expect(rows.rows[0].n).toBe(submissions.length)
  })

  it('does not expose NIN, phone or email in a status lookup', async () => {
    const application = await makeApplication()
    const stored = await applicationRow(application.id)
    const safe = await lookupApplication(application.id, stored.phone, 'test-integration')
    expect(safe.phone).toBe('')
    expect(safe.email).toBe('')
    expect(safe.nin).not.toMatch(/\d{7}/)
    expect(safe.fullName).toContain('Test Applicant')
  })

  it('rejects a status lookup with the wrong phone number', async () => {
    const application = await makeApplication()
    await expect(lookupApplication(application.id, '08030000000', 'test-integration')).rejects.toThrow(
      /No application matches/,
    )
  })

  it('enforces the application workflow and role capabilities', async () => {
    const application = await makeApplication()
    await expect(
      setApplicationStatus(verification, { applicationId: application.id, status: 'Approved' }),
    ).rejects.toThrow(/cannot perform this action/)

    await setApplicationStatus(national, { applicationId: application.id, status: 'Under Review', note: 'Checked by test' })
    const row = await query<{ status: string }>('select status from applications where public_id = $1', [application.id])
    expect(row.rows[0].status).toBe('Under Review')

    await expect(
      setApplicationStatus(national, { applicationId: application.id, status: 'Certified/Active' }),
    ).rejects.toThrow(/cannot jump|cannot move/)
  })

  it('refuses certification before training is complete', async () => {
    const application = await makeApplication()
    await query("update applications set status = 'Training Completed', training_progress = 0 where public_id = $1", [
      application.id,
    ])
    await expect(
      setApplicationStatus(national, { applicationId: application.id, status: 'Certified/Active' }),
    ).rejects.toThrow(/Training must be completed/)
  })

  it('records training attempts and updates progress from validated answers', async () => {
    const application = await makeApplication()
    const stored = await applicationRow(application.id)
    await query("update applications set status = 'Training Required' where id = $1", [stored.id])
    const guard = await makeGuard(stored.id, 'Kano', 'Nasarawa')

    const wrong = await submitTrainingQuiz(guard, { moduleId: 'm1', answers: [0, 0] })
    expect(wrong.passed).toBe(false)

    const correct = await submitTrainingQuiz(guard, { moduleId: 'm1', answers: [1, 1] })
    expect(correct.passed).toBe(true)
    expect(correct.progress).toBe(11)
  })
})

describe('geographic scope', () => {
  it('limits a State Coordinator to their own state', async () => {
    const kanoApp = await makeApplication()
    expect(kanoApp.id).toBeTruthy()
    const data = await bootstrap(lagosCoordinator)
    expect(data.applications.length).toBeGreaterThan(0)
    expect(data.applications.every((application) => application.stateOfResidence === 'Lagos')).toBe(true)
    expect(data.incidents.every((incident) => incident.state === 'Lagos')).toBe(true)
    expect(data.applications.some((application) => application.id === kanoApp.id)).toBe(false)
  })

  it('limits a Guard to their own application and reports', async () => {
    const application = await makeApplication()
    const stored = await applicationRow(application.id)
    const guard = await makeGuard(stored.id, 'Kano', 'Nasarawa')
    const data = await bootstrap(guard)
    expect(data.applications.map((item) => item.id)).toEqual([application.id])
    expect(data.incidents.length).toBe(0)
  })

  it('blocks out-of-scope application decisions', async () => {
    const application = await makeApplication() // Kano
    await expect(
      setApplicationStatus(lagosCoordinator, { applicationId: application.id, status: 'Under Review' }),
    ).rejects.toThrow(/outside your assigned area/)
  })
})

describe('incident workflow', () => {
  it('persists a report, its verification history and a truthful referral', async () => {
    const application = await makeApplication()
    const stored = await applicationRow(application.id)
    await query("update applications set status = 'Certified/Active', training_progress = 100 where id = $1", [stored.id])
    const guard = await makeGuard(stored.id, 'Kano', 'Nasarawa')

    const incident = await submitIncident(guard, {
      type: 'Voter intimidation',
      description: 'Test incident created by the integration suite.',
      severity: 'High',
      lat: 12.0131,
      lng: 8.5541,
      occurredAt: new Date().toISOString(),
      evidence: [{ kind: 'photo', name: 'test.jpg' }],
      electionDay: true,
    })
    createdIncidents.push(incident.id)
    expect(incident.status).toBe('Reported')

    const received = await setIncidentStatus(verification, {
      incidentId: incident.id,
      status: 'Received',
      note: 'Acknowledged by test',
    })
    expect(received.status).toBe('Received')

    const verified = await setIncidentStatus(verification, {
      incidentId: incident.id,
      status: 'Verified',
      note: 'Evidence reviewed by test',
      category: 'Electoral offence',
    })
    expect(verified.audit.length).toBeGreaterThanOrEqual(3)

    const referred = await referIncident(verification, {
      incidentId: incident.id,
      agencies: ['NPF', 'ICCES'],
      note: 'Integration test referral',
    })
    expect(referred.status).toBe('Referred/Actioned')

    const referrals = await query<{ status: string }>(
      'select status from incident_referrals where incident_id = (select id from incidents where public_id = $1)',
      [incident.id],
    )
    expect(referrals.rows.length).toBe(2)
    expect(referrals.rows.every((row) => row.status === 'pending_manual')).toBe(true)

    const notifications = await query<{ n: number }>(
      "select count(*)::int as n from notifications where entity_id = $1 and kind = 'incident'",
      [incident.id],
    )
    expect(notifications.rows[0].n).toBeGreaterThan(0)
  })

  it('rejects an invalid status jump', async () => {
    const application = await makeApplication()
    const stored = await applicationRow(application.id)
    await query("update applications set status = 'Certified/Active', training_progress = 100 where id = $1", [stored.id])
    const guard = await makeGuard(stored.id, 'Kano', 'Nasarawa')
    const incident = await submitIncident(guard, {
      type: 'BVAS / technology failure',
      description: 'Transition test.',
      severity: 'Medium',
      lat: 12.01,
      lng: 8.55,
      occurredAt: new Date().toISOString(),
      evidence: [],
      electionDay: true,
    })
    createdIncidents.push(incident.id)
    await expect(
      setIncidentStatus(verification, { incidentId: incident.id, status: 'Closed' }),
    ).rejects.toThrow(/cannot move/)
  })

  it('requires the assignment capability and persists an assignment', async () => {
    const application = await makeApplication()
    await expect(
      assignPollingUnit(verification, {
        applicationId: application.id,
        ward: 'Ward D',
        pollingUnit: 'PU 027 – Randle Ave. Open Space',
      }),
    ).rejects.toThrow(/cannot perform this action/)

    await assignPollingUnit(national, {
      applicationId: application.id,
      ward: 'Ward D',
      pollingUnit: 'PU 027 – Randle Ave. Open Space',
    })
    const row = await query<{ ward: string; polling_unit: string }>(
      'select ward, polling_unit from applications where public_id = $1',
      [application.id],
    )
    expect(row.rows[0].polling_unit).toContain('PU 027')
  })
})
