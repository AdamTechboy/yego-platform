# YEGO — Youth Electoral Guards Observers

Public website and operational platform for YEGO, Nigeria’s youth-led election observation, early-warning and incident-reporting mission. Guards apply, train, get deployed and report. Command screens applicants, verifies incidents and refers them to response agencies.

**Stack:** TanStack Start (React 19), Vite 8, Tailwind CSS 4, shadcn/ui, Leaflet + OpenStreetMap, Google Maps embeds, PostgreSQL, Netlify.

## What is persistent

Applications, applicants, guards, incidents, evidence metadata, verification history, referrals, early warnings, training attempts, certificates, check-ins, announcements, notifications and audit logs are stored in PostgreSQL. The browser no longer holds the authoritative copy of any operational record.

The only browser storage used by the application is TanStack Router’s in-memory routing state; there is no localStorage fallback.

## Quick start

```bash
pnpm install
pnpm db:migrate          # create/upgrade the schema
pnpm db:seed:demo        # reference data + development demo records
pnpm dev                 # http://localhost:3000
```

`pnpm dev` starts the Netlify Vite plugin, which provisions a local PostgreSQL cluster under `.netlify/db` and writes its connection string to `.netlify/state.json`. The app and scripts read that file automatically in development. If you prefer an external database, set `DATABASE_URL` (or `NETLIFY_DATABASE_URL`) and the fallback is ignored.

### Development demo accounts

These exist only when `db:seed:demo` has been run. They are not created in production.

| Door | Credential |
| --- | --- |
| Command | `command@yego.ng`, `verify@yego.ng`, `lagos@yego.ng`, `superadmin@yego.ng`, `training@yego.ng` |
| Command password | `yego-preview` |
| Guard / Applicant | `YG-APP-242858` / `08031250405` (certified Guard) |
| Guard / Applicant | `YG-APP-245604` / `08031266243` (applicant in training) |

The login page no longer prints these credentials. Rotate them before any real deployment.

## Database

- Engine: PostgreSQL 15+ (local cluster is PostgreSQL 17.5 via the Netlify dev plugin; production uses Netlify Database/Neon).
- Migrations: `db/migrations/*.sql`, applied in filename order and recorded in `schema_migrations` with checksums.
- Schema reference: [docs/BACKEND_ARCHITECTURE.md](docs/BACKEND_ARCHITECTURE.md).
- Sequences generate public references: `YG-APP-######`, `INC-YYYY-######`, `EW-YYYY-####`, `YEGO-CERT-####`.

Commands:

```bash
pnpm db:migrate           # apply pending migrations (idempotent, advisory-locked)
pnpm db:seed              # reference states/LGAs only — safe for production
pnpm db:seed:demo         # reference + demo records (refuses NODE_ENV=production)
pnpm db:seed:reset        # wipe demo tables and reseed demo records
pnpm db:create-admin      # create/update a Super Administrator from ADMIN_* env vars
```

`db:seed:demo` refuses to run with `NODE_ENV=production` unless `ALLOW_DEMO_SEED=1`. Never enable that flag against production data.

### Production database

1. Link the project to a Netlify site: `netlify link`.
2. Enable Netlify Database by deploying with `@netlify/database` installed. Netlify provisions PostgreSQL and injects `NETLIFY_DATABASE_URL` into functions.
3. Run `pnpm db:migrate` with the production `DATABASE_URL` in the environment (or leave it to the deploy job).
4. Run `pnpm db:seed` once to load the 37 states and 774 LGAs.
5. Create the first administrator:

```bash
ADMIN_EMAIL=... ADMIN_PASSWORD='...' ADMIN_NAME='...' pnpm db:create-admin
```

Alternatively, any managed PostgreSQL provider that exposes `DATABASE_URL` works; the app uses the standard `pg` driver and does not depend on provider-specific APIs.

## Authentication and roles

- First-party session authentication: scrypt password hashes, random session tokens stored as SHA-256 hashes, HttpOnly/SameSite=Lax cookies (`Secure` in production), seven-day expiry, database-backed rate limiting.
- Two entry points: Command staff (email + password) and Guard/Applicant (Application ID + phone).
- Authorization is enforced in the server repository, not only in the UI. Roles and geographic scope are defined in `src/lib/permissions.ts` and `src/server/scope.server.ts`.
- Super Administrator manages everything; every other role is limited to its remit and area. State Coordinators are locked to their state; LGA Coordinators to their LGA.
- Shared updates give Command roles a common, scoped information board.
- Incident alerts are written to the database and polled by the Command UI every 20 seconds; the pop-up shows only records inside the user’s scope.

## Privacy and security

- NIN is encrypted with AES-256-GCM before storage and only the last four digits are retained for display.
- Status lookup requires Application ID **and** phone, is rate-limited, and returns a masked record without NIN, phone, email or internal notes.
- Evidence is currently stored as metadata only; binary evidence is deliberately disabled until private object storage, malware scanning and short-lived download URLs are configured.
- Every consequential workflow action writes an audit entry with actor, timestamp and note.
- Referrals default to `pending_manual`; the system does not claim delivery or acknowledgement without a configured integration.
- Read [docs/BACKEND_ARCHITECTURE.md](docs/BACKEND_ARCHITECTURE.md) and [docs/BACKEND_IMPLEMENTATION_REPORT.md](docs/BACKEND_IMPLEMENTATION_REPORT.md) before deployment. The application should stay in closed beta until the remaining owner actions are complete.

## Environment variables

Copy `.env.example` to `.env` for local overrides. Names only:

- `DATABASE_URL`, `NETLIFY_DATABASE_URL`
- `NIN_ENCRYPTION_KEY` (32 bytes, base64)
- `SESSION_SECRET`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`
- `VITE_GOOGLE_MAPS_API_KEY`
- `ALLOW_DEMO_SEED`

Never commit `.env` or production credentials.

## Google Maps

`/map` uses Google Maps embeds. With `VITE_GOOGLE_MAPS_API_KEY` set, it uses the official Embed API; without a key it uses the keyless Google Maps embed. “Open in Google Maps” links are available for every state, and incident records link to their coordinates.

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Vite + Netlify dev server on port 3000 |
| `pnpm build` | Production build |
| `pnpm typecheck` | TypeScript, strict mode |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit/component tests |
| `pnpm test:integration` | PostgreSQL integration tests |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | Reference geography only |
| `pnpm db:seed:demo` | Development demo data |
| `pnpm db:seed:reset` | Reset and reseed demo data |
| `pnpm db:create-admin` | Bootstrap a Super Administrator |

## Project structure

```
db/migrations/          versioned SQL migrations
scripts/                migration, seed and admin bootstrap scripts
src/routes/             public pages, application, status, login, portal, command
src/components/         brand, portal, Command and UI components
src/lib/                domain types, permissions, reference data, server-backed store
src/server/             db, auth, scope, validation, repository and server functions
docs/                   architecture, implementation report and existing notes
```

## Status

Production-shaped backend is implemented and verified against a provisioned local PostgreSQL database. Production Netlify Database provisioning, private evidence storage, Netlify Identity/MFA, the INEC polling-unit import, SMS/WhatsApp delivery and the remaining Command views are tracked in the implementation report. The public site, applicant status tracking and authorized Command workflows now read and write database records.
