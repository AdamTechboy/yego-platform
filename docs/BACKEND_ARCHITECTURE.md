# YEGO Backend Architecture

**Status:** Phase 1 implemented and verified against a provisioned local PostgreSQL database. Production provisioning requires the repository owner’s Netlify site and credentials (see “Owner actions”).

## 1. Repository audit (19 October 2026)

### What existed before this work

- No database dependency, connection string, schema, migration, ORM model or SQL file existed in `package.json`, `netlify.toml`, `vite.config.ts` or `src/`.
- Every operational screen read and wrote `src/lib/demo-store.ts`, which persisted a single JSON blob in `localStorage` under `yego-preview-v1`.
- Seed records came from `src/lib/fixtures.ts` (14 applications, 6 incidents, 4 warnings, 4 announcements, 6 demo accounts).
- Netlify Identity, Blobs, server functions and authentication did not exist. The “Command staff” password was a shared constant, and the login page printed all preview credentials.
- `PLAN.md` listed the backend, real authentication, evidence storage and the INEC import as remaining work.

### Environment facts found

- Netlify CLI 26.0.2 is installed; the project was **not linked** to a site, and `netlify database status` reported production Netlify Database as **not enabled**.
- The Netlify Vite dev plugin had already provisioned a **real local PostgreSQL 17.5 cluster** in `.netlify/db`, with its connection string in `.netlify/state.json` (`postgres://postgres@localhost:50456/postgres` at audit). The cluster contained no application tables.
- `pg` was not installed; `@electric-sql/pglite` was present only as a transitive dependency.
- npm/Netlify network access was intermittent during the audit; access was restored before dependency installation.

### Decision

Reuse the provisioned local PostgreSQL cluster for development and tests, and target standard PostgreSQL in production so the same code works with **Netlify Database (Neon)** or any managed provider.

- Runtime driver: `pg` (connection pool, transactions).
- Production connection: `NETLIFY_DATABASE_URL` (injected by Netlify Database) or `DATABASE_URL`.
- Development connection: `DATABASE_URL` if set; otherwise `.netlify/state.json`.
- `@netlify/database` is installed so a Netlify deployment can provision the managed database automatically.

## 2. Architecture

```
Browser (React 19 / TanStack Start)
        │  server function calls (validated JSON)
        ▼
src/server/functions.ts              authenticated entry points
        │
        ├── auth.server.ts          sessions, scrypt, login rate limits, origin checks
        ├── scope.server.ts         role + geographic predicates
        ├── validation.server.ts    Zod schemas and readable errors
        └── repo.server.ts          workflows, transactions, notifications, audit
                │
                ├── dto.server.ts   row → UI DTO mapping
                └── db.server.ts    pg Pool, transaction helper
                        │
                        ▼
                PostgreSQL (Netlify Database / managed Postgres)
```

The client keeps a read cache in `src/lib/demo-store.ts`, hydrated by a single `getBootstrapFn` server function. Mutations call server functions and refresh the cache. There is no localStorage authority and no demo fallback.

### Server functions

`src/server/functions.ts` exposes:

- `getBootstrapFn`, `getNotificationsFn`
- `loginCommandFn`, `loginGuardFn`, `logoutFn`
- `submitApplicationFn`, `lookupApplicationFn`, `confirmWhatsAppFn`
- `listPollingUnitsFn`
- `submitIncidentFn`, `setIncidentStatusFn`, `addIncidentNoteFn`, `referIncidentFn`
- `setApplicationStatusFn`, `assignPollingUnitFn`
- `submitTrainingQuizFn`, `raiseWarningFn`, `checkInFn`
- `postAnnouncementFn`, `markNotificationsReadFn`

All mutating functions validate input with Zod, check the same-origin header, resolve the session user and delegate to the repository. Reads are scoped in SQL.

## 3. Database schema

Migrations live in `db/migrations/`:

| Migration | Contents |
| --- | --- |
| `0001_init.sql` | All application tables, constraints, indexes, triggers |
| `0002_sequences.sql` | Human-readable reference sequences and lookup audit index |

### Reference

| Table | Purpose |
| --- | --- |
| `states` | 36 states + FCT, capital, zone, centroid, PU/ward totals |
| `lgas` | 774 LGAs, foreign key to `states` |
| `polling_units` | INEC polling units imported with `pnpm db:import:pus` (176,834 rows locally) |

### Applications and onboarding

| Table | Purpose |
| --- | --- |
| `applications` | Applicant identity, location, background, photo, status, progress, timestamps |
| `application_history` | Append-only workflow history with actor and note |
| `consent_records` | Non-partisanship, code of conduct and NDPA consent records |

### Identity and access

| Table | Purpose |
| --- | --- |
| `users` | Staff and Guard accounts, role, scope, linked application |
| `sessions` | SHA-256-hashed session tokens, expiry, IP and user agent |
| `login_attempts` | Database-backed sign-in throttling |

### Incidents

| Table | Purpose |
| --- | --- |
| `incidents` | Report, severity, location, reporter, status, category |
| `incident_evidence` | Evidence metadata and storage references only |
| `incident_history` | Append-only verification and decision history |
| `incident_referrals` | Agency, approval actor, delivery status (`pending_manual` by default) |
| `referral_events` | Referral lifecycle events |

### Field operations and curriculum

| Table | Purpose |
| --- | --- |
| `early_warnings` | Guard/Command risk tips, level, access and location |
| `training_attempts` | Quiz answers, score and pass state for the nine-module Electoral Accountability Academy |
| `certificates` | Certification record and certificate number |
| `check_ins` | Guard arrival at an assigned polling unit |
| `announcements` | National, state and LGA messages (shared updates) |
| `notifications` | Per-user unread alerts for incidents, warnings and application updates |
| `audit_log` | Security-relevant actions with actor, target, outcome, IP and JSON detail |
| `settings` | Seed markers and configuration |

### Integrity and conventions

- UUID primary keys for internal references; public references use sequences (`YG-APP-######`, `INC-YYYY-######`, `EW-YYYY-####`, `YEGO-CERT-####`).
- Foreign keys with cascade on dependent history, so deleting a test record cleans its children.
- Status columns use `CHECK` constraints matching the domain values.
- `updated_at` triggers on applications, users, incidents and referrals.
- Indexes on status, geography, submission/report time, reporter and notifications.

## 4. Data flows

### Application

1. `submitApplicationFn` validates age (18–35), Nigerian phone, 11-digit NIN, valid state/LGA combination, photo size and the three declarations.
2. `createApplication` runs in a transaction: next `application_ref_seq`, encrypt NIN (AES-256-GCM), store last four digits, insert application, initial history and consent records.
3. Audit entry `application.submitted` is written; the public response contains the public ID and safe record.
4. Status lookup requires the public ID **and** phone. It is rate-limited through failed lookup audit entries and returns a masked record (`phone`, `email`, `experience`, `background` blank; NIN masked).
5. Workflow transitions are validated server-side. Approval-class transitions require `approve:verification`; earlier stages require `screen:applicants`.
6. Certification requires `training_progress = 100`; it issues a YEGO ID and a certificate record.

### Guard reporting

1. Only a `YEGO Guard` linked to a `Certified/Active` application can submit.
2. The incident is inserted with a server-generated reference, application location and reporter identity.
3. Evidence arrays are stored as metadata only (`storage_key` null) until private storage is configured.
4. `incident_history` records “Reported”.
5. Notifications are inserted for every active Command user whose role can view incidents and whose geographic scope covers the incident.
6. A Guard check-in writes `check_ins`; quiz answers are validated against the server-side training definitions, then `training_attempts` and application progress are updated.

### Verification and referral

1. Incident transitions are restricted to `Reported → Received → Under Review → Verified | Unverified → Referred/Actioned → Closed`.
2. Every action records the actor, timestamp and note.
3. Referral requires a verified incident, at least one known agency and `refer:incidents`.
4. Referral rows are created with status `pending_manual`; a `created` event states that no external integration is configured. The system never claims delivery or acknowledgement.
5. Notifications are returned to the reporter’s linked user when one exists.

### Notifications

- The Command layout polls `getNotificationsFn` every 20 seconds.
- A new unread incident or warning opens a dialog listing recent alerts.
- Dismissing marks the visible notifications read; the bell badge reflects unread count.
- Scope is applied when notifications are created, so a Lagos coordinator does not receive a Rivers alert.

### Shared updates

- National roles post to the whole network or a named audience.
- Regional Coordinators post to their zone; State Coordinators to their state; LGA Coordinators to their LGA.
- All Command roles can read the board; Guards receive relevant messages in their portal.

## 5. Authentication and authorization

### Authentication

- Passwords: scrypt (`N=16384, r=8, p=1`), 16-byte salt, 64-byte hash.
- Sessions: 32-byte random token in an HttpOnly, SameSite=Lax cookie; only a SHA-256 hash is stored; seven-day expiry; `Secure` when `NODE_ENV=production`.
- Login throttling: eight failures in fifteen minutes per email/IP.
- Every mutation checks the `Origin` header against the request host, in addition to SameSite cookies.
- Logout deletes the session row and clears the cookie.

### Roles and scope

| Role | Scope |
| --- | --- |
| Super Administrator | Entire platform, users and roles |
| National YEGO Administrator | National operations, incident reporting to any agency, no role management |
| Regional Coordinator | Geopolitical zone |
| State Coordinator | One state, full operational capabilities (no role management) |
| LGA Coordinator | One LGA |
| Verification Officer | Applicant screening/approval and messaging, plus incidents |
| Training Officer | Training roster, progress updates, applicant messaging and CSV reports |
| YEGO Guard | Own application, reports and area messages |
| Partner/Observer | Defined but no UI in Phase 1 |

Capabilities are defined in `src/lib/permissions.ts`. Geographic predicates are in `src/server/scope.server.ts` and are applied in SQL for applications, incidents and warnings, and when notifications are fanned out. Front-end navigation is derived from the same matrix, but the server check is authoritative.

### What changed for roles

- Verification Officer no longer screens or approves applicants; the role is limited to viewing and verifying incidents.
- Training Officer no longer receives the incident queue.
- Incidents now have a dedicated `view:incidents` capability.
- State and LGA scopes are enforced in queries and mutations, not just in filters.
- Shared updates provide the cross-role information channel.

## 6. Privacy and security controls

Implemented:

- NIN encrypted at the application layer; only last four digits retained for display.
- NIN, phone and email excluded from public status lookups.
- Rate limits for login and status lookup.
- HttpOnly session cookies, SameSite, Secure in production, hashed session tokens.
- Same-origin checks on mutations.
- Role and geographic authorization in the data layer.
- Append-only application and incident histories; audit log for sensitive actions.
- Referral delivery is truthful (`pending_manual`).
- Demo seed refuses production unless explicitly overridden.
- No production credentials committed; `.env.example` contains names only.

Not yet implemented (documented limitations):

- MFA and privileged-account recovery flows.
- Netlify Identity or an external identity provider; first-party sessions are the interim compatible implementation.
- Private binary evidence storage, malware scanning and short-lived signed URLs. Evidence collection is metadata-only for now.
- Application photo is stored as a size-limited data URL in the database; it should move to Blobs.
- Field-level read auditing and data-retention automation.
- Serverless-edge distributed rate limiting; the current limits are database-backed and per-instance safe but not a full WAF.
- Lawful-basis approval for real NIN collection. Production must not collect real NIN until this is signed off.

## 7. Setup

### Local

```bash
pnpm install
pnpm dev            # starts the Netlify dev DB if needed
pnpm db:migrate
pnpm db:seed:demo
```

If `DATABASE_URL` is set, it takes precedence over the local Netlify DB. Otherwise the app reads `.netlify/state.json`.

### Production

1. `netlify link` to the YEGO site.
2. Deploy with `@netlify/database` installed so Netlify provisions the database and injects `NETLIFY_DATABASE_URL`.
3. Run `pnpm db:migrate` against the production URL.
4. Run `pnpm db:seed` (reference geography only).
5. Create the Super Administrator with `pnpm db:create-admin`.
6. Set `NIN_ENCRYPTION_KEY`, `SESSION_SECRET` and `VITE_GOOGLE_MAPS_API_KEY`.
7. Remove or rotate every demo account before opening access.

## 8. Owner actions still required

- Provision/confirm the production Netlify Database (site link and credentials were unavailable in this environment).
- Set production secrets and rotate the development password.
- Approve the lawful basis and retention policy for NIN before collecting real values.
- Provide/approve private object storage and malware scanning for evidence.
- Import the official INEC polling-unit register; do not fabricate polling units.
- Configure the official WhatsApp channel and SMS/agency integrations; until then referrals remain manual.
- Confirm partner names, marks and descriptions from the partnership brief.
- Decide on MFA and a production identity provider.
- Keep the platform in closed beta until these are complete.
