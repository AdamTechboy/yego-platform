# YEGO production deployment — SmartWeb Linux VPS (Ubuntu 24.04)

This is a **single-server initial deployment**, not a verified 300,000-concurrent-user architecture. Before collecting real applicant NINs, complete privacy/security review, backup restoration testing and access-control testing. Scale only after load testing.

## Prerequisites
- SmartWeb VPS with Ubuntu 24.04, root/SSH access, a static public IPv4 address, and permission to run Docker-free Node.js services.
- Domain DNS access, a named technical administrator, and a backup destination **outside** the VPS.
- Node.js 24 LTS (or compatible 22+), corepack/pnpm, PostgreSQL 16+, nginx, certbot.
- The project's **production** NIN key must be generated once and backed up securely. Losing/changing it makes existing encrypted NIN records unreadable.
- Do not paste server passwords, database URLs, private keys or actual NINs into chats, screenshots or GitHub.

## 1. Initial OS hardening
Log in with the credentials supplied by SmartWeb; create a non-root sudo deploy user and set up SSH keys before disabling password SSH login. Enable security updates, firewall, SSH brute-force protection and monitoring according to provider access instructions. Allow SSH, HTTP (80), HTTPS (443), and no public PostgreSQL port. Keep the old SSH connection open while testing firewall access.

## 2. Database
For a starter deployment, a local PostgreSQL instance can be used; for resilience under heavier demand, migrate to separately managed/high-availability PostgreSQL. Use a distinct limited-permission database account; database must listen locally or on a private network. Establish automated off-server, encrypted backups **and perform a restore test**.

Example commands (replace placeholders locally, never commit credentials):
```bash
sudo apt update
sudo apt install -y postgresql nginx certbot python3-certbot-nginx git
# Install supported Node.js 24 LTS from a verified upstream or OS repository,
# then enable pnpm via corepack.
node --version
corepack enable
```

Create the YEGO database and role securely using the PostgreSQL administrator account. Do not paste a database password into terminal commands recorded in shell history.

## 3. Checkout and install
```bash
sudo mkdir -p /opt/yego
sudo chown "$USER":"$USER" /opt/yego
git clone https://github.com/myruzmah/yego-platform.git /opt/yego
cd /opt/yego
corepack pnpm install --frozen-lockfile
```

Create a root-readable **outside-repo** environment file, e.g. `/etc/yego/yego.env` with mode 0600, containing values for `NODE_ENV=production`, `DATABASE_URL`, `NIN_ENCRYPTION_KEY`, `SESSION_SECRET`, `COOKIE_SECURE=true`, `PORT=3000`, and `HOST=127.0.0.1`. Only set browser-exposed `VITE_*` values if approved. Ensure the application service user can read the file without giving other users access.

Generate random values once on the VPS using `openssl rand -base64 32` for NIN encryption and `openssl rand -hex 32` for SESSION_SECRET; preserve the encryption key in an encrypted recovery vault. Avoid `set -x` when working with secrets. Never enable `ALLOW_DEMO_SEED` in production.

**Important:** The current `pnpm` scripts load `.env` from the working directory; a systemd `EnvironmentFile` exports the values to the app process, so there is no need to place a secret file in Git.

## 4. Initialize the schema
The source of truth for self-hosted migrations is `netlify/database/migrations/*.sql`. Migrate **exactly one production database** after backup / verification; never run development demo or destructive reset against it.
```bash
cd /opt/yego
# In a privileged interactive session, load /etc/yego/yego.env into the
# environment without echoing its values, then:
pnpm db:migrate
pnpm db:seed
pnpm db:import:pus
ADMIN_EMAIL=admin@your-domain.example ADMIN_NAME="YEGO Administrator" pnpm db:create-admin
```
Admin password is prompted for in the terminal; use a strong unique password. Confirm migration counts and correct database target before importing polling units. The import may require downloaded source data; verify dataset provenance before use.

## 5. Build and start
```bash
cd /opt/yego
pnpm typecheck
pnpm lint
pnpm test
pnpm build
NODE_ENV=production PORT=3000 HOST=127.0.0.1 pnpm start
```
Before configuring the service, check local `http://127.0.0.1:3000/healthz` and the public pages. **A successful healthz response only proves the Node server is running; it does not confirm PostgreSQL connectivity.**

Use the sample files at `deploy/smartweb/vps/yego.service.example` and `deploy/smartweb/vps/nginx.conf.example`. Replace usernames, paths and domain placeholders before installing. If using systemd, run the service with the unprivileged deploy user, set `EnvironmentFile=/etc/yego/yego.env`, and configure restart-on-failure; do not run Node as root.

## 6. Domain, HTTPS and reverse proxy
Point the domain's A record to the VPS IPv4 address. If an AAAA record exists, it must also target a configured IPv6 server, otherwise remove it. Once DNS has propagated, configure nginx and:
```bash
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.example -d www.your-domain.example
```
Only include `www` if it has a matching DNS record. Confirm certificate auto-renewal and `https://your-domain.example/healthz`. Use HTTPS on *every* authenticated endpoint. Don't publish the website for real applicant submissions before required security and legal approvals are complete.

## 7. Required acceptance tests
1. Admin logs in and remains signed in over HTTPS, then signs out.
2. A dedicated **fictional** test applicant registers; the record persists after service restart.
3. Status lookup accepts matching ID/phone and rejects incorrect phone.
4. Applicant/Guard portal works without cross-account access.
5. State/LGA role restrictions prevent cross-region reads and changes.
6. Nine-module training and certification workflow.
7. Incident creation, verification, referral logging, alert delivery and audit entries.
8. Polling unit choices reflect the imported official register.
9. Restart, restore from backup, rate limiting, WAF/log monitoring and error handling.
10. Staged load testing to determine maximum safe traffic before expanding capacity.

## 8. Deploy updates
Use a separate staging environment where possible. Take a verified backup; review migration safety before applying changes. Pull a tested commit, `pnpm install --frozen-lockfile`, `pnpm db:migrate`, `pnpm build`, then restart the service. Monitor logs and roll back application code if necessary; never assume database migrations can safely be rolled back.

## Stop/go
Do not claim 300,000 concurrent active users are supported until representative peak load tests pass. Data privacy review, MFA for privileged accounts, safe evidence-object storage, and reliable backup recovery remain release gates.
