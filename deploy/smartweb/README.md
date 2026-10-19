# Deploying YEGO on SmartWeb

YEGO is a **Node.js application with server-side rendering and PostgreSQL**. It is not a static HTML site. SmartWeb can host it only on a plan that provides:

1. **Node.js 22 or newer** with a long-running process (cPanel “Setup Node.js App” / Passenger), and
2. **PostgreSQL 15+** — either from SmartWeb or a managed provider such as Neon or Supabase.

If the SmartWeb plan only offers PHP/static hosting or MySQL, the full application cannot run there. In that case use SmartWeb’s VPS/Node option, or keep the domain pointed at a Node host such as Netlify and keep SmartWeb for DNS/email. Do not attempt to convert this application to static HTML: authentication, server functions and the database require a running Node process.

## 1. Prepare locally (recommended)

From the project root:

```bash
pnpm install
pnpm db:migrate
pnpm db:seed:demo          # only for local/demo
pnpm build
pnpm start                 # http://localhost:3000
```

Confirm the production server works before uploading:

```bash
NODE_ENV=production DATABASE_URL="postgres://…" \
NIN_ENCRYPTION_KEY="…" COOKIE_SECURE=true PORT=3001 node server.mjs
```

The build produces:

```
dist/client/        static assets served by server.mjs
dist/server/        TanStack Start SSR/server-function handler
server.mjs          standalone Node server
app.js              cPanel/Passenger entry point
```

## 2. Create the production database

Use a managed PostgreSQL 15+ instance. If SmartWeb provides PostgreSQL, create a database and user in cPanel. Otherwise create a free/paid Neon or Supabase project.

Record the connection string. It must be reachable from SmartWeb (allow SmartWeb’s server IP if the provider has an allowlist), for example:

```
postgresql://user:password@host:5432/yego?sslmode=require
```

Run the migrations and reference seed from your local machine against the production database:

```bash
DATABASE_URL="postgres://…" pnpm db:migrate
DATABASE_URL="postgres://…" pnpm db:seed
DATABASE_URL="postgres://…" ADMIN_EMAIL="you@example.com" ADMIN_PASSWORD="a-long-password" ADMIN_NAME="Your Name" pnpm db:create-admin
```

`db:seed` loads only the 37 states and 774 LGAs. Do **not** run `db:seed:demo` against production.

Import the polling-unit register (needed for the polling-unit select):

```bash
DATABASE_URL="postgres://…" pnpm db:import:pus
```

The import downloads the 176,000+ unit dataset and is safe to rerun (duplicate codes are skipped).

## 3. Upload the project

Upload the source to the application root in cPanel, excluding:

```
node_modules/
dist/
.netlify/
.git/
.env
```

Then create `.env` or set the same values in the cPanel Node.js environment panel. At minimum:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | production PostgreSQL connection string |
| `NIN_ENCRYPTION_KEY` | 32 random bytes, base64 (`openssl rand -base64 32`) |
| `SESSION_SECRET` | long random string |
| `COOKIE_SECURE` | `true` on HTTPS |
| `VITE_WHATSAPP_CHANNEL_URL` | official YEGO community/channel URL |
| `VITE_GOOGLE_MAPS_API_KEY` | optional Google Maps Embed API key |

`VITE_*` values are compiled into the browser bundle. Change them **before** `npm run build`, or rebuild after changing them.

## 4. Configure the cPanel Node.js app

In **Setup Node.js App**:

- **Node.js version:** 22.x or 24.x (18 is not supported)
- **Application root:** the folder containing `package.json` and `server.mjs`
- **Application URL:** your domain or subdomain
- **Application startup file:** `app.js` (or `server.mjs`)
- **Environment:** production

Then use the cPanel terminal (or the panel’s run-script actions):

```bash
npm install
npm run build
```

Do **not** use `npm install --omit=dev` before building: Vite and TypeScript are dev dependencies.

Restart the application. Passenger supplies `PORT`; `server.mjs` also defaults to 3000.

## 5. Domain and SSL

1. Point the domain or subdomain to the Node application in cPanel.
2. Enable AutoSSL / Let’s Encrypt.
3. Set `COOKIE_SECURE=true` and restart.
4. Open `https://your-domain/healthz` — it should return `{"ok":true,"service":"yego"}`.

Test: homepage, `/apply`, `/news`, `/erart`, `/training`, `/partners`, `/map`, login, application submission, status lookup, Guard portal and Command Centre.

## 6. Operations

- **Updating code:** upload changed files, run `npm install` (if dependencies changed), `npm run build`, restart.
- **Migrations:** `DATABASE_URL=… npm run db:migrate` before restarting.
- **Backups:** enable automated PostgreSQL backups and test a restore.
- **Logs:** cPanel → Node.js app logs / `stderr.log`; Passenger errors appear there.
- **Health check:** `/healthz`.
- **Demo data:** never seed demo records in production; rotate the demo password if it was ever used.
- **Polling units:** rerun `npm run db:import:pus` after updating the source dataset.

## 7. Common failures

| Symptom | Cause / fix |
| --- | --- |
| 503 from Passenger | Wrong startup file, Node version below 22, or app crashed; check logs. |
| `Cannot find package` | `npm install` was not run in the application root. |
| 404 for `/assets/...` | `dist/client` was not uploaded/built, or the app root is wrong. |
| Database connection refused | `DATABASE_URL` missing, SSL mode wrong, or SmartWeb IP not allowlisted. |
| Login redirects back to `/login` | `COOKIE_SECURE=true` on HTTP, or cookies blocked. Use HTTPS. |
| Google map blank | Browser cannot reach Google Maps, or `VITE_GOOGLE_MAPS_API_KEY` is invalid. |
| Changes to `VITE_*` not visible | Rebuild after changing build-time variables. |
| `ExperimentalWarning: SQLite` | Not used by this app; ignore unrelated host warnings. |

## 8. If SmartWeb cannot run Node

Request a Node.js 22+ plan, or deploy to a Node host/VPS and point the SmartWeb domain’s DNS at it. The application needs a persistent process and PostgreSQL; no static export is provided because that would remove authentication, Command workflows and database persistence.
