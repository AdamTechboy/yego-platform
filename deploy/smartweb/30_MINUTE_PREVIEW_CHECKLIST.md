# YeGo 30-minute Smartweb preview checklist

**Status: PREVIEW ONLY.** MySQL port is incomplete and not verified. Do not collect real NINs, phone numbers, or applicant records until tested.

## 1. Prepare hosting
- In Smartweb cPanel Node.js App, use Node 22, production, application root `Yego-app`, and startup `app.js`.
- Upload the project from branch `smartweb-mysql` to the configured application root (not the public web root).
- Ensure `app.js` and `server.mjs` exist.
- Install dependencies with the package manager matching the lockfile. The current pnpm lockfile still requires regeneration for mysql2; **do not run frozen-lockfile installs** until it is updated.
- Build with `npm run build`; stop if it fails.
- Set the application environment variables via cPanel, never in source control.

## 2. Database
- MySQL configuration keys: `DB_ENGINE=mysql`, `DB_HOST=localhost`, `DB_PORT=3306`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.
- Test connectivity with `npm run db:mysql:check`.
- On a NEW EMPTY TEST database only, run `npm run db:mysql:migrate:core`, then `npm run db:mysql:migrate:operations`. These schemas are still under review.
- Do not migrate an existing production database or insert actual applicant data.

## 3. Smoke test before claiming readiness
1. `npm run typecheck` must pass.
2. `npm test` must pass.
3. `npm run build` must pass.
4. Restart the Node.js application from cPanel.
5. Verify `https://yego.ng` has a valid trusted TLS certificate (not self-signed).
6. With fictitious test records only: submit an application, retrieve its status, confirm WhatsApp, sign in as a command user, sign in as a guard, report an incident, and verify access controls.
7. Check cPanel application logs and database rows for errors.

## Release gate
If ANY test fails, keep the public intake disabled and present the interface as a preview. The MySQL SQL conversion is incomplete and this branch must not be merged or treated as production-ready without validation.
