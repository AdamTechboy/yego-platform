// Client-side demo store backed by localStorage. It lets the preview behave
// like the real system across screens (apply → screen → guard portal →
// report → verify → refer). Milestone 2 replaces these functions with
// server functions over Netlify Database; keep the function names stable.
import { useSyncExternalStore } from 'react'
import {
  SEED_ANNOUNCEMENTS,
  SEED_APPLICATIONS,
  SEED_INCIDENTS,
  SEED_WARNINGS,
  DEMO_ACCOUNTS,
  type Announcement,
  type Application,
  type ApplicationStatus,
  type DemoAccount,
  type EarlyWarning,
  type Incident,
  type IncidentStatus,
} from './fixtures'
import { getState } from './nigeria'

export interface Session {
  name: string
  email: string
  role: string
  scope: string
  kind: 'command' | 'guard'
  applicationId?: string
}

interface DB {
  applications: Application[]
  incidents: Incident[]
  warnings: EarlyWarning[]
  announcements: Announcement[]
  session: Session | null
}

const KEY = 'yego-preview-v1'

const SEED: DB = {
  applications: SEED_APPLICATIONS,
  incidents: SEED_INCIDENTS,
  warnings: SEED_WARNINGS,
  announcements: SEED_ANNOUNCEMENTS,
  session: null,
}

let db: DB = SEED
let loaded = false
const listeners = new Set<() => void>()

function load() {
  if (loaded || typeof window === 'undefined') return
  loaded = true
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw) db = { ...SEED, ...(JSON.parse(raw) as Partial<DB>) }
  } catch {
    db = SEED
  }
}

function commit(next: DB) {
  db = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    // Storage full (large photos) — keep in memory for this session.
  }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  load()
  listeners.add(l)
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      loaded = false
      load()
      listeners.forEach((fn) => fn())
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(l)
    window.removeEventListener('storage', onStorage)
  }
}

export function useDB(): DB {
  return useSyncExternalStore(
    subscribe,
    () => {
      load()
      return db
    },
    () => SEED,
  )
}

export function resetPreviewData() {
  commit({ ...SEED, session: db.session })
}

const now = () => new Date().toISOString()
const rand = (n: number) =>
  Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('')

/* ---------------------------- Session ---------------------------- */

export function signIn(account: DemoAccount | Session) {
  commit({ ...db, session: { ...account } })
}

export function signInApplicant(id: string, phone: string): Session | null {
  load()
  const app = db.applications.find(
    (a) =>
      a.id.toUpperCase() === id.trim().toUpperCase() &&
      a.phone.replace(/\D/g, '').endsWith(phone.replace(/\D/g, '').slice(-6)),
  )
  if (!app) return null
  const active = app.status === 'Certified/Active'
  const session: Session = {
    name: app.fullName,
    email: app.email,
    role: active ? 'YEGO Guard' : 'Applicant',
    scope: `${app.lga}, ${app.stateOfResidence}`,
    kind: 'guard',
    applicationId: app.id,
  }
  signIn(session)
  return session
}

export function findAccount(email: string) {
  return DEMO_ACCOUNTS.find(
    (a) => a.email.toLowerCase() === email.trim().toLowerCase(),
  )
}

export function signOut() {
  commit({ ...db, session: null })
}

/* -------------------------- Applications -------------------------- */

export type NewApplication = Omit<
  Application,
  | 'id'
  | 'status'
  | 'submittedAt'
  | 'confirmedWhatsApp'
  | 'trainingProgress'
  | 'history'
  | 'yegoId'
>

export function submitApplication(input: NewApplication): Application {
  load()
  const app: Application = {
    ...input,
    nin: `•••••••${input.nin.slice(-4)}`,
    id: `YG-APP-${rand(6)}`,
    status: 'Application Submitted',
    submittedAt: now(),
    confirmedWhatsApp: false,
    trainingProgress: 0,
    history: [{ at: now(), by: 'Applicant', action: 'Application Submitted' }],
  }
  commit({ ...db, applications: [app, ...db.applications] })
  return app
}

export function confirmWhatsApp(id: string) {
  commit({
    ...db,
    applications: db.applications.map((a) =>
      a.id === id ? { ...a, confirmedWhatsApp: true } : a,
    ),
  })
}

export function setApplicationStatus(
  id: string,
  status: ApplicationStatus,
  by: string,
  note?: string,
) {
  commit({
    ...db,
    applications: db.applications.map((a) => {
      if (a.id !== id) return a
      const code = getState(a.stateOfResidence)?.code ?? 'NG'
      return {
        ...a,
        status,
        trainingProgress:
          status === 'Training Completed' || status === 'Certified/Active'
            ? 100
            : a.trainingProgress,
        yegoId:
          status === 'Certified/Active'
            ? (a.yegoId ?? `YEGO/${code}/${rand(4)}`)
            : a.yegoId,
        history: [...a.history, { at: now(), by, action: status, note }],
      }
    }),
  })
}

export function setTrainingProgress(id: string, progress: number) {
  commit({
    ...db,
    applications: db.applications.map((a) => {
      if (a.id !== id) return a
      const done = progress >= 100 && a.status === 'Training Required'
      return {
        ...a,
        trainingProgress: progress,
        status: done ? 'Training Completed' : a.status,
        history: done
          ? [
              ...a.history,
              { at: now(), by: 'Training Centre', action: 'Training Completed' },
            ]
          : a.history,
      }
    }),
  })
}

export function assignPollingUnit(
  id: string,
  ward: string,
  pollingUnit: string,
  by: string,
) {
  commit({
    ...db,
    applications: db.applications.map((a) =>
      a.id === id
        ? {
            ...a,
            ward,
            pollingUnit,
            history: [
              ...a.history,
              {
                at: now(),
                by,
                action: 'Polling unit assigned',
                note: pollingUnit,
              },
            ],
          }
        : a,
    ),
  })
}

/* ---------------------------- Incidents ---------------------------- */

export type NewIncident = Omit<
  Incident,
  'id' | 'reportedAt' | 'status' | 'referrals' | 'audit'
>

export function submitIncident(input: NewIncident): Incident {
  load()
  const inc: Incident = {
    ...input,
    id: `INC-26-${rand(6)}`,
    reportedAt: now(),
    status: 'Reported',
    referrals: [],
    audit: [{ at: now(), by: input.reporter, action: 'Reported' }],
  }
  commit({ ...db, incidents: [inc, ...db.incidents] })
  return inc
}

export function setIncidentStatus(
  id: string,
  status: IncidentStatus,
  by: string,
  note?: string,
  category?: string,
) {
  commit({
    ...db,
    incidents: db.incidents.map((i) =>
      i.id === id
        ? {
            ...i,
            status,
            category: category ?? i.category,
            audit: [...i.audit, { at: now(), by, action: status, note }],
          }
        : i,
    ),
  })
}

export function addIncidentNote(id: string, by: string, action: string, note: string) {
  commit({
    ...db,
    incidents: db.incidents.map((i) =>
      i.id === id
        ? { ...i, audit: [...i.audit, { at: now(), by, action, note }] }
        : i,
    ),
  })
}

export function referIncident(id: string, agencies: string[], by: string, note?: string) {
  commit({
    ...db,
    incidents: db.incidents.map((i) =>
      i.id === id
        ? {
            ...i,
            status: 'Referred/Actioned',
            referrals: [
              ...i.referrals,
              ...agencies.map((agency) => ({ agency, at: now(), by })),
            ],
            audit: [
              ...i.audit,
              {
                at: now(),
                by,
                action: 'Referred/Actioned',
                note: `Forwarded to ${agencies.join(', ')}${note ? ` — ${note}` : ''}`,
              },
            ],
          }
        : i,
    ),
  })
}

/* ------------------------ Warnings & comms ------------------------ */

export function raiseWarning(w: Omit<EarlyWarning, 'id' | 'raisedAt'>) {
  commit({
    ...db,
    warnings: [{ ...w, id: `EW-26-${rand(4)}`, raisedAt: now() }, ...db.warnings],
  })
}

export function postAnnouncement(a: Omit<Announcement, 'id' | 'at'>) {
  commit({
    ...db,
    announcements: [{ ...a, id: `a${rand(6)}`, at: now() }, ...db.announcements],
  })
}
