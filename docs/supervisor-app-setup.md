# Supervisor App — Setup

A standalone Turso (libSQL) database powers the Supervisor Production App (`/floor`,
`/admin`, `/api/floor/*`). It shares nothing with any other project.

## Local dev
- `.env.local`: `TURSO_DATABASE_URL=file:local.db` and empty `TURSO_AUTH_TOKEN`.
- Seed the schema + data (creates `local.db`):
  ```bash
  TURSO_DATABASE_URL=file:local.db SEED_ADMIN_PASSWORD=<pw> npm run db:seed
  ```
  (`tsx` does not auto-load `.env.local`, so pass `TURSO_DATABASE_URL` inline for scripts.)
- `npm run db:migrate` applies the schema only (idempotent).
- `npm test` runs the vitest suite against isolated in-memory DBs.
- Log in at `/floor/login` as `admin` / `<pw>`. `local.db` is gitignored.

## Production (Turso) — run once (MANUAL, needs the owner's Turso account)
1. Install CLI + create the DB (its OWN database, unrelated to any other project):
   `turso db create wild-dash-production`
2. Get the URL: `turso db show wild-dash-production --url`
3. Mint a token: `turso db tokens create wild-dash-production`
4. Set in Vercel (this project only): `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.
5. Apply schema + seed against production once (locally, with prod env vars):
   ```bash
   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... SEED_ADMIN_PASSWORD=<strong> npm run db:seed
   ```
6. Change the admin password after first login (admin UI ships in a later phase).

## Notes
- The `/floor` pages render as a full-screen overlay (`fixed inset-0 z-50`) so they
  cover the dashboard's desktop sidebar on phones. Phase 2 will give `/floor` its own
  root chrome (PWA manifest, install prompt, no dashboard shell).
- Roles: `supervisor` (uses the app), `manager` (views dashboards), `admin` (config).
- Session cookie: `wd_floor_sid` (httpOnly, 30-day TTL, server-side `sessions` table).
