# Smartweb MySQL 8.0 deployment prerequisites

Verified from cPanel phpMyAdmin screenshot on 2026-10-22:
- MySQL Community Server **8.0.46** (not MariaDB).
- Server: localhost, port 3306.
- Charset: utf8mb4.
- Node.js cPanel app: 22.23.3, production, startup app.js, root Yego-app.

## Prepare database in cPanel
1. Open **Manage My Databases / MySQL Databases** in cPanel, not phpMyAdmin's system databases.
2. Create a new empty database (e.g. account-prefixed `yego_prod`).
3. Create a unique database user with a strong generated password.
4. Add that user to the new database with the privileges required for schema migration. Remove unnecessary schema-changing privileges after setup where practical.
5. Keep the database name, username and password outside GitHub and screenshots. The full cPanel prefix is significant.
6. Use `127.0.0.1:3306` from Node.js if localhost socket resolution differs; test connectivity first.

## Production safety
- Do not import PostgreSQL .sql migrations into MySQL.
- Do not store actual applicant information before migrations, login, audit, consent, encryption and backups pass tests.
- Enable a valid CA-issued TLS certificate on yego.ng before live traffic.
- Set secrets in cPanel Node.js environment variables, not in the repository.
- MySQL database version alone does not establish Node.js access or production readiness.

## Required MySQL conversion
See `deploy/smartweb/MYSQL_MIGRATION_AUDIT.md`. The original app still uses PostgreSQL; this file is a verified environment configuration note, **not a completed port**.
