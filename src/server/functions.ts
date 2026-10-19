import { createServerFn } from '@tanstack/react-start'
import { getRequestIP } from '@tanstack/react-start/server'

import { assertSameOrigin, currentUser, loginCommand, loginGuard, logout } from './auth.server'
import {
  addIncidentNote,
  assignPollingUnit,
  bootstrap,
  checkIn,
  confirmWhatsApp,
  createApplication,
  getNotifications,
  listPollingUnits,
  lookupApplication,
  markNotificationsRead,
  postAnnouncement,
  raiseWarning,
  referIncident,
  setApplicationStatus,
  setIncidentStatus,
  submitIncident,
  submitTrainingQuiz,
} from './repo.server'
import * as v from './validation.server'

export const getBootstrapFn = createServerFn({ method: 'GET' }).handler(async () => {
  return bootstrap(await currentUser())
})

export const loginCommandFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => v.parse(v.loginCommandInput, input))
  .handler(async ({ data }) => {
    assertSameOrigin()
    return loginCommand(data)
  })

export const loginGuardFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => v.parse(v.loginGuardInput, input))
  .handler(async ({ data }) => {
    assertSameOrigin()
    return loginGuard(data)
  })

export const logoutFn = createServerFn({ method: 'POST' }).handler(async () => {
  assertSameOrigin()
  await logout()
  return { ok: true }
})

export const submitApplicationFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => v.parse(v.applicationInput, input))
  .handler(async ({ data }) => {
    assertSameOrigin()
    return createApplication(data as unknown as Record<string, unknown>)
  })

export const lookupApplicationFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => v.parse(v.lookupInput, input))
  .handler(async ({ data }) => {
    assertSameOrigin()
    const ip = (() => {
      try {
        return getRequestIP() ?? null
      } catch {
        return null
      }
    })()
    return lookupApplication(data.applicationId, data.phone, ip)
  })

export const confirmWhatsAppFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => v.parse(v.confirmWhatsAppInput, input))
  .handler(async ({ data }) => {
    assertSameOrigin()
    return confirmWhatsApp(data.applicationId, data.phone)
  })

export const submitIncidentFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => v.parse(v.incidentInput, input))
  .handler(async ({ data }) => {
    assertSameOrigin()
    const user = await currentUser()
    if (!user) throw new Error('Sign in to continue.')
    return submitIncident(user, data as unknown as Record<string, unknown>)
  })

export const setIncidentStatusFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => v.parse(v.incidentStatusInput, input))
  .handler(async ({ data }) => {
    assertSameOrigin()
    const user = await currentUser()
    if (!user) throw new Error('Sign in to continue.')
    return setIncidentStatus(user, data)
  })

export const addIncidentNoteFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => v.parse(v.incidentNoteInput, input))
  .handler(async ({ data }) => {
    assertSameOrigin()
    const user = await currentUser()
    if (!user) throw new Error('Sign in to continue.')
    return addIncidentNote(user, data)
  })

export const referIncidentFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => v.parse(v.referralInput, input))
  .handler(async ({ data }) => {
    assertSameOrigin()
    const user = await currentUser()
    if (!user) throw new Error('Sign in to continue.')
    return referIncident(user, data)
  })

export const setApplicationStatusFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => v.parse(v.applicationStatusInput, input))
  .handler(async ({ data }) => {
    assertSameOrigin()
    const user = await currentUser()
    if (!user) throw new Error('Sign in to continue.')
    return setApplicationStatus(user, data)
  })

export const assignPollingUnitFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => v.parse(v.assignPollingUnitInput, input))
  .handler(async ({ data }) => {
    assertSameOrigin()
    const user = await currentUser()
    if (!user) throw new Error('Sign in to continue.')
    return assignPollingUnit(user, data)
  })

export const submitTrainingQuizFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => v.parse(v.trainingQuizInput, input))
  .handler(async ({ data }) => {
    assertSameOrigin()
    const user = await currentUser()
    if (!user) throw new Error('Sign in to continue.')
    return submitTrainingQuiz(user, data)
  })

export const raiseWarningFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => v.parse(v.warningInput, input))
  .handler(async ({ data }) => {
    assertSameOrigin()
    const user = await currentUser()
    if (!user) throw new Error('Sign in to continue.')
    return raiseWarning(user, data)
  })

export const postAnnouncementFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => v.parse(v.announcementInput, input))
  .handler(async ({ data }) => {
    assertSameOrigin()
    const user = await currentUser()
    if (!user) throw new Error('Sign in to continue.')
    return postAnnouncement(user, data as { kind: string; title: string; body: string; audience?: string })
  })

export const listPollingUnitsFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => v.parse(v.pollingUnitsQuery, input))
  .handler(async ({ data }) => {
    return listPollingUnits(data.state, data.lga, data.ward)
  })

export const getNotificationsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await currentUser()
  if (!user) return []
  return getNotifications(user)
})

export const markNotificationsReadFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => v.parse(v.notificationsReadInput, input))
  .handler(async ({ data }) => {
    assertSameOrigin()
    const user = await currentUser()
    if (!user) throw new Error('Sign in to continue.')
    return markNotificationsRead(user, data.ids)
  })

export const checkInFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => v.parse(v.checkInInput, input))
  .handler(async ({ data }) => {
    assertSameOrigin()
    const user = await currentUser()
    if (!user) throw new Error('Sign in to continue.')
    return checkIn(user, data.lat, data.lng)
  })
