# YEGO — Youth Electoral Guards Observers

Public website and operational platform for YEGO, Nigeria's youth-led election observation, early-warning and incident-reporting mission. Guards apply, train, get deployed and report. Command screens applicants, verifies incidents and refers them to response agencies.

**Stack:** TanStack Start (React 19), Vite, Tailwind CSS 4, shadcn/ui, Leaflet + OpenStreetMap, deployed on Netlify.

## Run locally
```bash
pnpm install
netlify dev --port 8889   # or: pnpm dev
```
Preview logins are listed on `/login` (staff password `yego-preview`).

## Status
Data is currently kept in the browser (preview mode). See [PLAN.md](PLAN.md) for the roadmap: the remaining Command views, the database and secure file storage, real authentication, the INEC polling-unit import and notifications.
