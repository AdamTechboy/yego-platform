# Smartweb MySQL migration — verified audit (2026-10-22)

## Current status
- Smartweb cPanel Node.js 22.23.3 app exists, startup `app.js`, application root `Yego-app`.
- Repository uses PostgreSQL 15+ and `pg`; MySQL is **not** currently supported.
- This branch is for the conversion. Do not deploy it until migrations, integration tests and security checks pass.

## PostgreSQL dependencies found
- `src/server/db.server.ts`: `pg.Pool`, `pg.PoolClient`, `query().rows`, explicit transactions.
- `src/server/repo.server.ts`: positional `$1` placeholders, `ANY($1::uuid[])`, `RETURNING *`, `nextval`, casts (`::int`, `::text`), interval arithmetic, and PostgreSQL SQL.
- `src/server/auth.server.ts`: PostgreSQL placeholders/casts/interval expressions; authentication and sessions must be regression tested.
- `src/server/scope.server.ts`: dynamic parameter offsets must be adapted carefully.
- `scripts/db.mjs`, `scripts/migrate.mjs`, `scripts/seed.mjs`, `scripts/create-admin.mjs`, `scripts/import-polling-units.mjs`: PostgreSQL client/query API.
- `netlify/database/migrations/*.sql`: PostgreSQL DDL, UUID defaults, `jsonb`, `timestamptz`, partial indexes, PL/pgSQL triggers and sequences.
- `package.json`: `pg` dependency and type package; MySQL driver not installed.

## Safe migration order
1. Implement a MySQL query/transaction adapter with equivalent typed `rows` and `rowCount` semantics. Never use unsafe string interpolation for values.
2. Write fresh MySQL 8-compatible schema and migration tracking (do not run PostgreSQL migrations against MySQL). Account for MySQL/MariaDB version and collation.
3. Convert SQL expressions in server repositories and auth; replace `RETURNING` with explicit reads in the same transaction and sequence-based IDs with concurrency-safe counters.
4. Convert seed, polling-unit import and administrator scripts.
5. Run unit tests, typecheck, build and MySQL-backed integration tests, including concurrent applications, login, sessions, consent, scope restrictions and audit logs.
6. Verify SSL, NIN encryption key, backups, secure cookies and rate limiting before public applicant intake.

## Hosting prerequisites
- Confirm whether cPanel database is **MySQL 8** or **MariaDB**, exact version, and whether Node.js can connect via localhost.
- Create a dedicated database and least-privilege user in cPanel; never commit credentials.
- Existing PostgreSQL data, if any, requires a separate data migration, not just schema conversion.

**No claim of MySQL compatibility or production readiness is made by this audit.**
