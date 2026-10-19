import { randomBytes, scryptSync } from 'node:crypto'
import { unlinkSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { withClient } from './db.mjs'
import { STATES } from '../src/lib/nigeria.ts'

const DEMO_VERSION = 1

function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${hash.toString('base64url')}`
}

// fixtures.ts imports './nigeria' without an extension. Type stripping needs
// the extension, so import a temporary copy that points at the real file.
async function loadFixtures() {
  writeFileSync(
    'src/lib/.fixtures.seed.ts',
    (await import('node:fs')).readFileSync('src/lib/fixtures.ts', 'utf8').replace("from './nigeria'", "from './nigeria.ts'"),
  )
  try {
    return await import(pathToFileURL(`${process.cwd()}/src/lib/.fixtures.seed.ts`).href)
  } finally {
    unlinkSync('src/lib/.fixtures.seed.ts')
  }
}

async function seedReference(client) {
  for (const state of STATES) {
    await client.query(
      `insert into states (code, name, capital, zone, lat, lng, polling_units, wards)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (code) do update set name = excluded.name, capital = excluded.capital,
         zone = excluded.zone, lat = excluded.lat, lng = excluded.lng,
         polling_units = excluded.polling_units, wards = excluded.wards`,
      [state.code, state.name, state.capital, state.zone, state.lat, state.lng, state.pollingUnits, state.wards],
    )
    for (const lga of state.lgas) {
      await client.query(
        `insert into lgas (state_code, name) values ($1,$2)
         on conflict (state_code, name) do nothing`,
        [state.code, lga],
      )
    }
  }
  console.log(`reference: ${STATES.length} states, ${STATES.reduce((n, s) => n + s.lgas.length, 0)} LGAs`)
}

async function resetDemo(client) {
  await client.query(`
    truncate table
      notifications, sessions, login_attempts, audit_log,
      training_attempts, certificates, check_ins,
      referral_events, incident_referrals, incident_history, incident_evidence, incidents,
      early_warnings, announcements,
      application_history, consent_records, users, applications
    restart identity cascade
  `)
}

function appState(account, applications) {
  const app = applications.find((item) => item.id === account.applicationId)
  return app?.stateOfResidence ?? null
}

function appLga(account, applications) {
  const app = applications.find((item) => item.id === account.applicationId)
  return app?.lga ?? null
}

async function seedDemo(client) {
  const fixtures = await loadFixtures()
  const { SEED_APPLICATIONS, SEED_INCIDENTS, SEED_WARNINGS, SEED_ANNOUNCEMENTS, DEMO_ACCOUNTS, AGENCIES, TRAINING_MODULES } = fixtures

  const appIds = new Map()
  const userIds = new Map()

  for (const app of SEED_APPLICATIONS) {
    const row = await client.query(
      `insert into applications
        (public_id, yego_id, full_name, gender, date_of_birth, phone, whatsapp, email,
         nin_ciphertext, nin_last4, state_of_origin, state_of_residence, lga, ward,
         preferred_polling_unit, polling_unit, background, experience, photo_data,
         status, whatsapp_confirmed_at, training_progress, submitted_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$23)
       returning id`,
      [
        app.id,
        app.yegoId ?? null,
        app.fullName,
        app.gender,
        app.dateOfBirth,
        app.phone,
        app.whatsapp,
        app.email,
        null,
        app.nin ? app.nin.slice(-4) : null,
        app.stateOfOrigin,
        app.stateOfResidence,
        app.lga,
        app.ward,
        app.pollingUnit,
        app.pollingUnit,
        app.background,
        app.experience,
        app.photo ?? null,
        app.status,
        app.confirmedWhatsApp ? app.submittedAt : null,
        app.trainingProgress,
        app.submittedAt,
      ],
    )
    const dbId = row.rows[0].id
    appIds.set(app.id, dbId)

    for (const h of app.history) {
      await client.query(
        `insert into application_history (application_id, action, note, actor_label, created_at)
         values ($1,$2,$3,$4,$5)`,
        [dbId, h.action, h.note ?? null, h.by, h.at],
      )
    }
    await client.query(
      `insert into consent_records (application_id, kind, version, accepted_at) values
        ($1,'non_partisanship','2026-10',$2),
        ($1,'code_of_conduct','2026-10',$2),
        ($1,'data_use','2026-10',$2)`,
      [dbId, app.submittedAt],
    )
  }

  const demoGuardId = appIds.get('YG-APP-242858')
  if (demoGuardId) {
    for (const module of TRAINING_MODULES) {
      await client.query(
        `insert into training_attempts (application_id, module_id, answers, score, passed)
         values ($1,$2,'[]',85,true)`,
        [demoGuardId, module.id],
      )
    }
  }

  const password = 'yego-preview'
  for (const account of DEMO_ACCOUNTS) {
    const scope =
      account.kind === 'guard'
        ? { kind: 'self', state: appState(account, SEED_APPLICATIONS), zone: null, lga: appLga(account, SEED_APPLICATIONS) }
        : account.role === 'State Coordinator'
          ? { kind: 'state', state: 'Lagos', zone: 'South West', lga: null }
          : account.scope === 'Training Centre'
            ? { kind: 'training', state: null, zone: null, lga: null }
            : { kind: 'national', state: null, zone: null, lga: null }

    const appDbId = account.applicationId ? appIds.get(account.applicationId) : null
    const row = await client.query(
      `insert into users
        (email, password_hash, name, role, kind, scope_kind, scope_zone, scope_state, scope_lga, application_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       returning id`,
      [
        account.email,
        hashPassword(password),
        account.name,
        account.role,
        account.kind,
        scope.kind,
        scope.zone,
        scope.state,
        scope.lga,
        appDbId,
      ],
    )
    userIds.set(account.email, row.rows[0].id)
  }

  for (const inc of SEED_INCIDENTS) {
    const row = await client.query(
      `insert into incidents
        (public_id, type, description, severity, state, lga, ward, polling_unit, lat, lng,
         occurred_at, reported_at, reporter_name, reporter_id, reporter_user_id, status,
         category, election_day, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$12,$12)
       returning id`,
      [
        inc.id,
        inc.type,
        inc.description,
        inc.severity,
        inc.state,
        inc.lga,
        inc.ward,
        inc.pollingUnit,
        inc.lat,
        inc.lng,
        inc.occurredAt,
        inc.reportedAt,
        inc.reporter,
        inc.reporterId,
        userIds.get('funmi@example.ng') ?? null,
        inc.status,
        inc.category ?? null,
        inc.electionDay,
      ],
    )
    const incidentId = row.rows[0].id

    for (const e of inc.evidence) {
      await client.query(
        `insert into incident_evidence (incident_id, kind, file_name, storage_key) values ($1,$2,$3,$4)`,
        [incidentId, e.kind, e.name, null],
      )
    }
    for (const a of inc.audit) {
      await client.query(
        `insert into incident_history (incident_id, action, note, actor_label, created_at)
         values ($1,$2,$3,$4,$5)`,
        [incidentId, a.action, a.note ?? null, a.by, a.at],
      )
    }
    for (const r of inc.referrals) {
      const agency = AGENCIES.find((x) => x.code === r.agency)
      const ref = await client.query(
        `insert into incident_referrals (incident_id, agency_code, agency_name, status, created_at, updated_at)
         values ($1,$2,$3,'pending_manual',$4,$4) returning id`,
        [incidentId, r.agency, agency?.name ?? r.agency, r.at],
      )
      await client.query(
        `insert into referral_events (referral_id, event, detail, created_at)
         values ($1,'created','Seeded referral — no external delivery attempted',$2)`,
        [ref.rows[0].id, r.at],
      )
    }
  }

  const warningIds = []
  for (const w of SEED_WARNINGS) {
    const row = await client.query(
      `insert into early_warnings
        (public_id, type, title, summary, state, lga, level, access, raised_by_label,
         evidence_count, lat, lng, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
      [w.id, w.type, w.title, w.summary, w.state, w.lga, w.level, w.access, w.raisedBy, w.evidence, w.lat, w.lng, w.raisedAt],
    )
    warningIds.push(row.rows[0].id)
  }

  for (const a of SEED_ANNOUNCEMENTS) {
    await client.query(
      `insert into announcements (from_label, tier, kind, title, body, audience, created_at)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [a.from, a.tier, a.kind, a.title, a.body, a.audience, a.at],
    )
  }

  const commandUsers = ['superadmin@yego.ng', 'command@yego.ng', 'verify@yego.ng', 'lagos@yego.ng']
  for (const email of commandUsers) {
    const uid = userIds.get(email)
    if (!uid) continue
    const lagos = email === 'lagos@yego.ng'
    await client.query(
      `insert into notifications (user_id, kind, title, body, entity_type, entity_id)
       values ($1,'incident',$2,$3,'incident',$4)`,
      lagos
        ? [uid, 'New incident in Lagos', 'BVAS / technology failure at PU 027 – Randle Ave. Open Space, Lagos. Awaiting verification.', 'INC-26-000196']
        : [uid, 'New critical incident reported', 'Violence / physical attack at PU 009 – Rumuokoro Town Hall, Rivers. Awaiting verification.', 'INC-26-000191'],
    )
  }
  await client.query(
    `insert into notifications (user_id, kind, title, body, entity_type, entity_id)
     values ($1,'training','Training refresh available','Module 4 has new examples for results-sheet photography.','announcement',null)`,
    [userIds.get('funmi@example.ng')],
  )

  await client.query(
    `insert into settings (key, value) values ('demo_seed_version', $1)
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [JSON.stringify(DEMO_VERSION)],
  )

  console.log(`demo: ${SEED_APPLICATIONS.length} applications, ${SEED_INCIDENTS.length} incidents, ${SEED_WARNINGS.length} warnings, ${DEMO_ACCOUNTS.length} accounts`)
  console.log('demo password: yego-preview (development only — rotate before production)')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const wantsDemo = process.argv.includes('--demo')
  const wantsReset = process.argv.includes('--reset')

  if (wantsDemo && process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== '1') {
    throw new Error('Refusing to seed demo data with NODE_ENV=production. Set ALLOW_DEMO_SEED=1 to override.')
  }

  await withClient(async (client) => {
    await seedReference(client)
    if (wantsDemo) {
      const existing = await client.query("select value from settings where key = 'demo_seed_version'")
      if (wantsReset || existing.rows[0]?.value !== DEMO_VERSION) {
        await resetDemo(client)
        await seedDemo(client)
      } else {
        console.log('demo seed already present; use --reset to replace it')
      }
    }
  })
  console.log('seed complete')
}
