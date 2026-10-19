# AGENTS.md

YEGO electoral-observation platform on TanStack Start + Netlify. **Read [PLAN.md](PLAN.md) first**: it lists what is done and what remains.

## Architecture
- `src/routes/`: `index` (public home), `apply`, `status`, `login`, `portal` (Guard/applicant), `command` (staff, `?view=` selects the panel).
- `src/components/yego/`: shared brand pieces: logo, site shell, `nigeria-map` (Leaflet, client-only dynamic import, Nominatim search, GPS), status badges, application tracker, photo capture, form fields.
- `src/components/portal/`: Election-Day quick report, training centre and certificate.
- `src/components/command/`: overview, incidents (verification + referral), applicants. Coverage, warnings, comms, training-admin and roles still need building.
- `src/lib/nigeria.ts`: states, LGAs and totals. `fixtures.ts`: types, seed data, agencies, roles, training. `demo-store.ts`: localStorage store via `useSyncExternalStore`. `permissions.ts`: role → capability matrix. `config.ts`: WhatsApp channel URL and age limits.

## Conventions & decisions
- All data access goes through `demo-store.ts` functions. Swap their internals for server functions over Netlify Database rather than changing the UI.
- UI-only permission checks today. They must be enforced server-side once Identity is added.
- Native `<select>` is used for long lists (better on low-end phones). Images are served through `/.netlify/images`.
- Agency badges use colour and code only. Official crests must not be used without permission.
- Follow the theme variables in `src/styles.css`, the `@/` import alias, and TypeScript strict mode (no unused vars).
