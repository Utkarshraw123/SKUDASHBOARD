# SESSION HANDOFF — Wild Nutrition SKU Dashboard — 2026-07-31

> **This is the LATEST handoff — the current pointer.** Supersedes
> `SESSION_HANDOFF_2026-07-30.md` (procurement fixes + the Supervisor App design/Phase-1 plan),
> which supersedes `SESSION_HANDOFF_2026-07-27.md`, `WILDDASHHANDOFF.md` (2026-07-24), and
> `SESSION_HANDOFF.md` (2026-07-21). All remain valid history. Pair with **`CONTEXT.md`** (evergreen).
>
> Live app: **https://skudashboard.vercel.app** · Repo: `github.com/Utkarshraw123/SKUDASHBOARD`
> (branch `main`, Vercel auto-deploys on push).
>
> **Session commit range:** `5ce6369..3811345` (HEAD **`3811345`**). Tree is **clean**, everything
> pushed. `npm test` (64 tests) + `npx tsc --noEmit` + `npx next build` all **green** at HEAD.
> Latest production deploy is **Ready**.
>
> **THIS SESSION SHIPPED ALL FOUR PHASES of the Supervisor Production App** (Phases 1→4), each
> built with TDD, verified end-to-end, and deployed. **The one thing NOT done — and the single
> most important next action — is provisioning the production Turso database** (§9). Until then
> every `/floor/*` route and the three new `/planning/*` DB tabs error on production; the rest of
> the dashboard is unaffected.

---

## 0. TL;DR — what happened this session

| Phase | What | Status | Verified |
|---|---|---|---|
| **1** | Standalone **Turso (libSQL) DB** + **auth** — schema (10 tables), migrate, seed (SU04 + 15 items + admin + sample machines/operators), bcrypt passwords, server-side sessions + httpOnly cookie, login/logout, route/page guards. | ✅ built + **deployed** | 16 tests + browser login flow |
| **2** | **Supervisor PWA** (`/floor`) — installable, SU04 Start/End checklist flow (gated, cross-checked), per-machine run logging (create/edit/soft-void), server-computed efficiency, full audit trail. | ✅ built + **deployed** | 46 tests + full mobile browser flow |
| **3** | **Dashboard reflection** — three read-only Internal Production tabs reading the DB: **Appraisals** (per-operator/machine), **Runs register**, **SU04 compliance**. | ✅ built + **deployed** | 52 tests + browser against seeded data |
| **4** | **Admin UI** (`/floor/admin`, admins only) — manage users, operators, machines, SU04 checklist items; all audited; non-admins 403. | ✅ built + **deployed** | 64 tests + curl + browser |

**Everything is committed and pushed. Production build is green. The ONLY blocker to real use is
the manual Turso provisioning step (§9) — it needs the user's Turso account, so I could not do it.**

**The design + the four phase plans (all now executed) live at:**
- Spec: `docs/superpowers/specs/2026-07-30-supervisor-production-app-design.md`
- Phase 1: `docs/superpowers/plans/2026-07-30-supervisor-production-app-phase1-foundation.md`
- Phase 2: `docs/superpowers/plans/2026-07-30-supervisor-production-app-phase2-pwa.md`
- Phase 3: `docs/superpowers/plans/2026-07-30-supervisor-production-app-phase3-dashboard.md`
- Phase 4: `docs/superpowers/plans/2026-07-30-supervisor-production-app-phase4-admin.md`
- Setup/ops guide: `docs/supervisor-app-setup.md` (READ THIS for provisioning + local dev)

---

## 1. What the Supervisor Production App IS (the why)

Replaces the manual, inaccurate production spreadsheet (the `INPUT` tab of the production
tracker, `1NnS9fg1mFxnWljbjUUXG9701mUPbvrVyiZ2Lbo2Hplw`) with a secure mobile app where
production **supervisors log in on their phones**, do the **SU04 startup checks**, and **log
production runs** — data flows into a **new standalone SQL database** and surfaces on the
manager dashboard **instead of** the spreadsheet.

**Core design decisions (locked in during the 2026-07-30 brainstorm — do NOT re-litigate):**
- **PWA inside the existing `wild-dash` Next.js repo** — no second codebase, no app stores.
  Routes: `/floor` (supervisor app), `/floor/admin` (admin), `/api/floor/*` (API).
- **NEW STANDALONE Turso (libSQL) DB.** Env vars in THIS project only: `TURSO_DATABASE_URL`,
  `TURSO_AUTH_TOKEN`. Dev/test = `file:local.db` (no token). **Zero sharing with the
  practitioner-portal project** — user was adamant.
- **Server is the source of trust** — phone sends raw numbers; server validates, computes
  efficiency, stamps `logged_by` + timestamps, audits every change. Client cannot fake identity.
- **Output counted ONCE per run, owned by ONE operator** (fixes the sheet's double-counting).
  Per-operator appraisal data comes for free by summing a person's runs.
- **SU04 checklist = the real GMP doc** "SU04 Warehouse Start Up Checks V1"
  (`1Lui6amAqUlnjd2T6e-fbPNgya-et9ltwJPRlIlT6rL8`, tab "AutoPack", Jordan Bain 26/06/2026).
  Once per day: Shift-1 supervisor does **Start-of-Day** (~6am, gates the day's run logging);
  Shift-2 does **End-of-Day** (~10pm). Each item Confirm/Deny; **Deny requires a comment**
  (server-enforced); **cross-check must be a DIFFERENT user** (server-enforced).
- **Deny is recorded + flagged amber, does NOT hard-block** the line (default; switchable).
- **Deletes are soft** (`void` + reason) — never erase GMP/production records.
- **SKUs still come from `ALL SKU DASHBOARD`** via `fetchSkus` (product picker); **machines &
  operators** are DB-managed lists; the `INPUT` sheet is **retired for entry**.
- **Roles:** `supervisor` (uses the app), `manager` (views dashboard), `admin` (manages config).
  The dashboard itself stays **unauthenticated** like the rest of the app — only `/floor` writes.

---

## 2. Stack & tooling changes made this session

- **New deps (runtime):** `@libsql/client`, `bcryptjs`. **New dev deps:** `vitest`, `tsx`,
  `@types/bcryptjs`, `pngjs`, `@types/pngjs` (pngjs only to generate placeholder PWA icons).
- **New scripts** in `package.json`: `test` (`vitest run`), `test:watch`, `db:migrate`
  (`tsx lib/db/migrate.ts`), `db:seed` (`tsx lib/db/seed.ts`).
- **`vitest.config.ts`** added — node env, `include` covers `lib/**/*.test.ts` + `test/**`,
  `fileParallelism:false` (tests share the harness), and a **`@` → repo-root alias** (the plan
  originally omitted this; tests import `@/...`).
- **This is the FIRST real test runner in the repo** (previously pure engines were transpile-and-run).
  64 vitest tests now exist, all under `lib/**/__tests__/*.test.ts`.
- **`.env.local`** (local, uncommitted) has `TURSO_DATABASE_URL=file:local.db` and empty
  `TURSO_AUTH_TOKEN`. **`local.db` is gitignored.**
- **Gotcha:** `tsx` scripts do NOT auto-load `.env.local` (only Next does). For CLI scripts pass
  the env inline, e.g. `TURSO_DATABASE_URL=file:local.db npm run db:seed`.

---

## 3. The database (Phase 1)

**Files:** `lib/db/client.ts` (singleton libSQL client from env; `getClient()` +
`resetClientForTest()`), `lib/db/schema.sql` (full DDL, all `CREATE TABLE IF NOT EXISTS`),
`lib/db/migrate.ts` (`applySchema(client)`; `npm run db:migrate`), `lib/db/seed.ts`
(`seed(client, {adminPassword})`; `npm run db:seed`), `test/setup-db.ts` (`freshTestDb()` test
harness).

**10 tables:** `users` · `operators` · `machines` · `checklist_templates` (versioned SU04) ·
`checklist_items` · `readiness_days` (one per date: start/end signers + cross-checks + status) ·
`readiness_checks` (one per item per phase: confirm/deny + comment + checked_by + time) ·
`runs` (the core; output once, one operator, void-able, `logged_by` + timestamps) · `audit_log`
(field-level `entity`/`entity_id`/`action`/`field`/`old_value`/`new_value`/`changed_by`) ·
`sessions` (id = random token, user_id, expires_at).

**Seed loads:** SU04 template `code='SU04' version='V1'`, **15 checklist items** (see §7 note),
one **admin** user (`username='admin'`, password = `SEED_ADMIN_PASSWORD` env or `change-me`),
sample machines (`Packing DE, Batching Boxes, Boxing, AutoPack`) and operators
(`Priyanka, Omar, Anna, Zehni, Rishi`). Seed is **idempotent**.

**GOTCHAS baked into the code (do not "fix" naively):**
- **`migrate.ts` strips full-line `--` comments BEFORE splitting on `;`.** The plan's original
  splitter discarded any statement whose chunk began with a comment line, silently dropping the
  `users`, `readiness_days`, and `audit_log` tables. Keep the comment-strip.
- **`freshTestDb()` uses plain `:memory:` (NOT `file::memory:?cache=shared`).** Shared-cache
  persists rows across resets → the session suite hit a `UNIQUE(username)` violation. Plain
  `:memory:` gives each reset a private DB.
- **`audit_log.changed_by` has a FOREIGN KEY to `users(id)` and libSQL enforces FKs.** Any test
  that writes audit rows must insert a real user first (admin-repo tests learned this the hard way).

---

## 4. Auth (Phase 1)

**Files:** `lib/auth/password.ts` (`hashPassword`/`verifyPassword`, bcryptjs cost 10),
`lib/auth/session.ts` (`createSession`/`getSessionUser`/`destroySession`, `SESSION_COOKIE =
"wd_floor_sid"`, `Role`, `SessionUser = {id,username,name,role}`, 30-day TTL),
`lib/auth/authenticate.ts` (`authenticate(username,password)` → SessionUser|null),
`lib/auth/require.ts` (`getCurrentUser`/`requireUser`/`requireRole(...roles)` — the last two
`redirect("/floor/login")` when unauthorized; `resolveUser(token)` is the pure testable core),
`lib/auth/adminOnly.ts` (`isAdmin(user)`, `adminOnly()` → admin SessionUser|null, for API 403s).

**API/pages:** `app/api/floor/login/route.ts` (POST; sets httpOnly `wd_floor_sid`, `secure` in
prod only), `app/api/floor/logout/route.ts` (POST; **303-redirects** to `/floor/login` so the
Sign-out button works from a plain form), `app/floor/login/page.tsx` (client form),
`app/floor/page.tsx` (guarded day home).

---

## 5. Supervisor PWA (Phase 2) — `/floor`

**Pure logic (all unit-tested):** `lib/floor/types.ts` (Run/RunInput/RunTotals/ChecklistItem/
ReadinessCheck/ReadinessDay/Phase), `metrics.ts` (`efficiency`, `effectiveHours`, `throughput`,
`summarizeRuns`), `checklist.ts` (`checklistProgress`, `validateCheckResult`, `phaseComplete`,
`canLogRuns`), `audit.ts` (`diffFields`), `validate.ts` (`validateRunInput`), `parseRunInput.ts`.

**Repositories (server, DB):** `runsRepo.ts` (`createRun`/`getRun`/`listRuns`/`updateRun`/
`voidRun`, each writing `audit_log`; `listRuns` accepts `{date}` OR `{from,to}` — the range form
added in Phase 3), `readinessRepo.ts` (`getOrCreateDay`/`getDayChecks`/`saveCheck`/
`completePhase`/`listReadinessDaysInRange`), `catalog.ts` (`listMachines`/`listOperators`/
`listSkuOptions` + pure `skuOptionsFrom`).

**API:** `/api/floor/runs` (GET list / POST create), `/api/floor/runs/[id]` (PATCH edit),
`/api/floor/runs/[id]/void` (POST), `/api/floor/readiness` (GET day+items+checks),
`/api/floor/readiness/check` (POST save one item), `/api/floor/readiness/complete` (POST complete
a phase with cross-check), `/api/floor/catalog` (GET machines+operators+skus+supervisors). All
guarded via `getCurrentUser()`; errors (deny-needs-comment, cross-check-differs, unanswered
items, bad input) return 400 with a message.

**UI:** `app/floor/layout.tsx` (installable PWA shell — `fixed inset-0 z-50` overlay that covers
the dashboard sidebar on phones; manifest + theme-color metadata), `app/floor/page.tsx` (day
home: SU04 status + gated "Log runs" + admin link for admins), `app/floor/checklist/[phase]/
page.tsx` + `components/floor/ChecklistForm.tsx` (SU04 flow), `app/floor/runs/page.tsx` +
`components/floor/RunLogger.tsx` (run list + new/edit/void), `components/floor/LogoutButton.tsx`.

**PWA:** `public/manifest.webmanifest` (start_url `/floor`, `standalone`, copper theme) +
`public/icons/icon-{192,512}.png` — **placeholder solid-copper squares generated with pngjs;
replace with branded art later.**

**Behaviour verified live on a 375×812 viewport:** `/floor` → redirect to login → admin/admin123
→ day home → Start-of-Day 15/15 (cross-check by a different supervisor) → run logging unlocked →
created a run showing 92% server-computed efficiency → edited it (field-level audit) → voided it
(stays present, excluded from totals).

**Plan gotchas fixed while executing Phase 2:**
- `catalog.ts` importing `fetchSkus` from `lib/sheets.ts` broke vitest (`cache is not a function`
  — React/Next `cache` runs at module load). Fixed with a **dynamic `import()` inside
  `listSkuOptions`** so `lib/sheets.ts` stays out of the vitest import graph.
- `metrics.ts` used a Map-iterator spread that failed `tsc` under the project's TS target →
  switched to `Array.from(...)` (no downlevelIteration needed).

---

## 6. Dashboard reflection (Phase 3) — read the DB

**Pure logic:** `lib/floor/appraisals.ts` (`aggregateByOperator`/`aggregateByMachine` — output,
efficiency, throughput, downtime, days worked; **voids excluded**), `lib/floor/compliance.ts`
(`summarizeCompliance(bundles)` — per-day signers/cross-checks/answered-counts/denies, newest
first). **Read-only DB queries:** `runsRepo.listRuns({from,to})` (inclusive date range),
`readinessRepo.listReadinessDaysInRange(from,to)` (does NOT create missing days, unlike
`getOrCreateDay`).

**Pages + views (server reads DB → client view; reuse existing `FilterBar` + `ExportCsvButton`):**
- `app/planning/appraisals/page.tsx` + `components/AppraisalsView.tsx`
- `app/planning/runs/page.tsx` + `components/RunsRegisterView.tsx`
- `app/planning/compliance/page.tsx` + `components/ComplianceView.tsx`

**Nav:** `components/InternalProductionTabs.tsx` now shows **Schedule · Performance · Appraisals ·
Runs · SU04 · Yield · Readiness · Reports** (the 3 new tabs are DB-backed; the legacy sheet-based
**Performance** tab was kept intentionally — retire once the DB views are trusted).

**Verified against seeded data:** appraisals excluded the 1 void run (Omar 105%, Anna 88%); runs
register showed "2 active · 1 void" with the void struck-through + reason; SU04 showed 2026-07-30
Started, Administrator / Second Supervisor, 15/15, 0 denials. Date-range filter defaults to the
current calendar month.

**⚠️ Consequence:** these three tabs are **linked in the dashboard nav**, so on production they
error when clicked until Turso is provisioned (§9). The existing tabs are unaffected.

---

## 7. Admin UI (Phase 4) — `/floor/admin`

**Guard:** page uses `requireRole("admin")`; every `/api/floor/admin/*` route calls `adminOnly()`
and returns **403** for non-admins (verified: a supervisor gets 403 on GET and POST).

**Pure validation:** `lib/floor/adminValidate.ts` (`validateNewUser`, `validateName`).
**Repo:** `lib/floor/adminRepo.ts` — users (`listUsers`/`createUser`/`setUserActive`/
`setUserRole`/`resetUserPassword`), operators (`listAllOperators`/`createOperator`/
`renameOperator`/`setOperatorActive`), machines (same four), checklist
(`getActiveTemplateWithItems`/`addChecklistItem`/`updateChecklistItem`/`setChecklistItemActive`).
**Every mutation writes `audit_log` with `changed_by=admin`.**

**API:** `/api/floor/admin/users` (GET/POST) + `/users/[id]` (PATCH active|role|password),
same shape for `/operators` and `/machines`, and `/checklist` (GET active template+items / POST
add) + `/checklist/[id]` (PATCH label|critical|active).

**UI:** `app/floor/admin/page.tsx` + `components/floor/AdminApp.tsx` (tabbed: Users · Operators ·
Machines · Checklist). Admins reach it via an **"Admin" link on the `/floor` day home** (shown
only when `role === "admin"`).

**Safety rails built in:**
- **Password never logged** — reset/create hash via `hashPassword`; the audit row records field
  `password_hash` with old/new = `"***"`.
- **Self-lockout guarded** — an admin cannot deactivate their own account or remove their own
  admin role (API returns 400).
- **Soft-delete only** — users/operators/machines/checklist items are **deactivated** (`active=0`),
  never deleted; reactivation flips it back. Removed checklist items stay so historical checks
  still resolve their label.
- **Duplicate username** → friendly 400 ("A user named ... already exists.").

**Verified:** create supervisor → id; dup rejected; add machine/operator/checklist-item; self
-lockout blocked; non-admin 403; audit rows correct; browser showed Users tab (Administrator +
Omar with role dropdown / Deactivate / Reset password) and Checklist tab ("SU04 V1 · 16 active
items" after adding one).

**Deferred (documented):** full SU04 **template versioning** (clone-to-new-version so historical
`readiness_days` keep referencing the version they were signed against). Phase 4 edits the active
template **in place** (additive + soft-remove), which is safe for this internal tool. This is the
natural **Phase 5** if the user wants it.

**★ SU04 item-count — RESOLVED 2026-07-31:** the user **confirmed keeping 15 items** (the SU04
document's 14 plus "Personnel are fit for work"). No change — the seed and the `toBe(15)` test are
correct as-is. Comment added at `SU04_ITEMS` in `lib/db/seed.ts` recording the decision. Do NOT
re-ask or drop the 15th item.

---

## 8. The 15 seeded SU04 items (by category)

- **Environment:** Area is clear from debris · Ventilation units are working · There are no signs
  of pest activity *(critical)* · The yard is clear from debris · The waste bins are empty
- **Product:** No finished goods left out of boxes on pallets · No concern of over-hanging pallets
  on racking *(critical)* · Pallets are clean to an acceptable level
- **Site Security:** Shutter doors locked on arrival/leaving *(critical)* · Fire exit door
  functional and shut *(critical)* · Product/pallets not left outside
- **Equipment:** Scales working and in good condition · Safety knives sharp and free from damage *(critical)*
- **Personnel:** Correct PPE is being worn *(critical)* · Personnel are fit for work *(the 15th — see §7)*

---

## 9. ★★★ THE ONE BLOCKER — provision the production Turso DB (MANUAL, needs the user)

Everything is deployed, but the **production database does not exist yet**. Because it needs the
user's own Turso account, I could not create it. **Until this is done, on production: all
`/floor/*` routes AND the Phase-3 `/planning/{appraisals,runs,compliance}` tabs throw
"TURSO_DATABASE_URL is not set". The rest of the dashboard (Sheets-based) is completely fine.**

**Run once (from `docs/supervisor-app-setup.md`):**
```bash
turso db create wild-dash-production
turso db show wild-dash-production --url        # → TURSO_DATABASE_URL
turso db tokens create wild-dash-production      # → TURSO_AUTH_TOKEN
```
Set both in the **skudashboard** Vercel project env (Production), then seed the prod DB once
locally with the prod env:
```bash
TURSO_DATABASE_URL=<url> TURSO_AUTH_TOKEN=<token> SEED_ADMIN_PASSWORD=<strong-pw> npm run db:seed
```
Then **redeploy** (any push, or `vercel --prod`) so the running app picks up the env, and
**change the admin password after first login** (via `/floor/admin` → Users → Reset password, or
by logging in as `admin` and creating a new admin then deactivating the seeded one).

**Cross-check needs ≥2 active supervisor/admin users** — create a second supervisor in the admin
UI (or the seed already provides `admin`; add at least one more so SU04 phases can be completed).

---

## 10. How to run / test / verify locally (for the next session)

```bash
# from repo root: Wild Dash/wild-dash
rm -f local.db && TURSO_DATABASE_URL=file:local.db SEED_ADMIN_PASSWORD=admin123 npm run db:seed
npm test                      # 64 vitest tests
npx tsc --noEmit && npx next build   # both clean at HEAD
```
- Dev server: use the Browser-pane `preview_start` with name `wild-dash` (port 3000). **Never use
  Bash to run the dev server.** `.claude/launch.json` already defines `wild-dash`.
- Login: `admin` / `admin123` (whatever `SEED_ADMIN_PASSWORD` you used). For cross-check testing
  add a second supervisor via `/floor/admin`.
- **Browser-automation note (important):** in the in-app Browser pane, coordinate clicks on
  buttons were **unreliable** (form submits often didn't fire). Driving via `javascript_tool`
  `.click()` on the element worked every time; `form_input` reliably sets React-controlled inputs.
  The httpOnly session cookie works once a submit actually fires. For rigorous end-to-end checks,
  **authenticated `curl` with a cookie jar** exercises the real API routes cleanly.
- **Deploy check:** `npx vercel ls skudashboard | sed 's/\x1b\[[0-9;]*m//g'` (Vercel CLI is authed:
  account `utkarshrawatofficial-2811`, scope `utkarsh-projects12`, project `skudashboard`). Deploy
  = `git push origin main`.
- **Build artifact quirk:** `npx next build` dirties the tracked `tsconfig.tsbuildinfo`. Restore it
  before committing so the tree stays clean: `git checkout -- tsconfig.tsbuildinfo`.

---

## 11. Interfaces the code exposes (stable contract for future phases)

- **DB:** `getClient()`, `applySchema(client)`, `seed(client,{adminPassword})`.
- **Auth:** `hashPassword`/`verifyPassword`; `createSession`/`getSessionUser`/`destroySession` +
  `SessionUser`/`Role` + `SESSION_COOKIE="wd_floor_sid"`; `getCurrentUser`/`requireUser`/
  `requireRole`; `authenticate`; `isAdmin`/`adminOnly`.
- **Runs:** `createRun`/`getRun`/`listRuns({date}|{from,to})`/`updateRun`/`voidRun`;
  `efficiency`/`throughput`/`summarizeRuns`; `aggregateByOperator`/`aggregateByMachine`.
- **Readiness:** `getOrCreateDay`/`getDayChecks`/`saveCheck`/`completePhase`/
  `listReadinessDaysInRange`; `checklistProgress`/`validateCheckResult`/`phaseComplete`/
  `canLogRuns`; `summarizeCompliance`.
- **Catalog:** `listMachines`/`listOperators`/`listSkuOptions`.
- **Admin:** all `adminRepo` functions in §7.

---

## 12. Everything else about the dashboard (unchanged this session — orientation)

The Supervisor App is an **isolated addition**. The rest of the dashboard is exactly as the
2026-07-30 handoff describes:

- **Framework:** Next.js **14.2.5** (App Router, TS, Tailwind), React 18. Vercel auto-deploy on
  push to `main` (no PR flow).
- **"Database" for everything else is Google Sheets** via `googleapis` + a service account
  (`GOOGLE_SERVICE_ACCOUNT_JSON`). Shapes = `lib/types.ts`; fetchers/writers = `lib/sheets.ts`.
- **Procurement / MRP** (from the prior session, still live): opening stock now includes planned
  **Packing Schedule**; cover = 16 global / 20 collagen+magnesium; per-SKU cover Apply button;
  demand/cover from the **WoW Demand** sheet. See `SESSION_HANDOFF_2026-07-30.md` §1–3.
- **Key spreadsheet IDs, env vars, market-mode cookie, the "never test against the 5 real reports"
  rule, the 60 reads/min quota, Drive-API-disabled note** — all in `SESSION_HANDOFF_2026-07-30.md`
  §7–8. Still current.
- **Sidebar groups** (`components/Sidebar.tsx`): ① Demand & stock · ② Production & supply (Internal
  Production = `/planning/*`, now with the 3 new DB tabs) · ③ Formulation.

### Env vars
Existing: `SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `PRODUCTION_REPORTS_SHEET_ID`,
`PRODUCTION_REPORT_PASSWORD` (default `12345`), `GROQ_API_KEY`, `GOODS_IN_PASSWORD` (optional),
`BLOB_READ_WRITE_TOKEN` (still not provisioned).
**New this session (Supervisor App):** `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (dev = `file:local.db`).

---

## 13. Left open / next steps (priority order)

1. **★ Provision the production Turso DB (§9)** — the single blocker to real-world use. Needs the
   user's Turso account. Then redeploy + change the admin password.
2. ~~**Confirm SU04 item count**~~ — ✅ RESOLVED 2026-07-31: user confirmed keeping 15 (§7). No action.
3. **Onboard real users** via `/floor/admin` — create the actual supervisors; deactivate the
   seeded sample operators/machines that don't match reality and add the real ones.
4. **Replace the placeholder PWA icons** (`public/icons/icon-{192,512}.png`) with branded art.
5. **Optional Phase 5 — SU04 template versioning** (clone-to-new-version); per-area templates.
6. **Optional cleanups:** retire the legacy sheet-based **Performance** tab once the DB Appraisals
   view is trusted; one-time import of historical `INPUT` rows into `runs`; derive `planned_qty`
   from a machine×product standard run-rate for tamper-proof efficiency (design §11).
7. **Carried-over, pre-existing (not this project):** Goods In uploads need `BLOB_READ_WRITE_TOKEN`;
   WNT in-transit column not captured; MRP per-SKU targets are URL-only; Procurement Actions
   raised/received tracker; expiry/BBD alerts. See `SESSION_HANDOFF_2026-07-30.md` §9.

---

## 14. Read order for the next session

1. **This file** (§9 is the action item).
2. `docs/supervisor-app-setup.md` — provisioning + local dev + per-phase notes.
3. `docs/superpowers/specs/2026-07-30-supervisor-production-app-design.md` — the design.
4. The four phase plans in `docs/superpowers/plans/2026-07-30-supervisor-production-app-phase{1..4}-*.md`.
5. `SESSION_HANDOFF_2026-07-30.md` — procurement/MRP work + the original design brainstorm.
6. `CONTEXT.md` (evergreen) + `lib/types.ts` + `lib/sheets.ts` (the Sheets data layer).

**Golden rules:** Sheets is the source for everything EXCEPT production entry (Turso, standalone,
nothing shared with practitioner-portal); server is the source of trust; deletes are soft; every
mutation is audited; the dashboard is read-only over the DB; verify in the browser (drive via
`javascript_tool`, not coordinate clicks) or authenticated curl, then `git push` to deploy;
restore `tsconfig.tsbuildinfo` before committing; **never test against the 5 real production reports.**
