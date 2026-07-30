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

## Phase 2 — Supervisor PWA
- Install: open `/floor` on a phone → browser "Add to Home Screen" → launches full-screen
  (a `/floor` layout supplies the manifest + `standalone` display).
- Daily flow: Start-of-Day SU04 (Shift-1, gates run logging) → log per-machine runs →
  End-of-Day SU04 (Shift-2). Deny needs a comment; each phase needs a different
  supervisor as cross-check. Runs are voided (never deleted); every change is in `audit_log`.
- Cross-check needs ≥2 active supervisor/admin users — add more via the (future) admin UI
  or a seed insert. For local testing add one:
  `TURSO_DATABASE_URL=file:local.db npx tsx -e "..."` (insert a supervisor row with a bcrypt hash).
- Placeholder PWA icons live at `public/icons/icon-{192,512}.png` (solid copper) — replace
  with branded art later.

## Notes
- The `/floor` layout renders a full-screen overlay (`fixed inset-0 z-50`) so it covers the
  dashboard's desktop sidebar on phones. A future phase can extract `/floor` into a route
  group with its own root layout (no dashboard shell at all).
- Roles: `supervisor` (uses the app), `manager` (views dashboards), `admin` (config).
- Session cookie: `wd_floor_sid` (httpOnly, 30-day TTL, server-side `sessions` table).
