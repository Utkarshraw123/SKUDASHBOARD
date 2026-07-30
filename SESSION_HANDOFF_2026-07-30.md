# SESSION HANDOFF — Wild Nutrition SKU Dashboard — 2026-07-30

> **This is the LATEST handoff — the current pointer.** Supersedes
> `SESSION_HANDOFF_2026-07-27.md` (procurement/consolidation), `WILDDASHHANDOFF.md`
> (2026-07-24), `SESSION_HANDOFF.md` (2026-07-21). All remain valid history —
> read them for anything before this session. Pair with **`CONTEXT.md`** (evergreen).
>
> Live app: **https://skudashboard.vercel.app** · Repo: `github.com/Utkarshraw123/SKUDASHBOARD`
> (branch `main`, Vercel auto-deploys on push).
>
> **Session commit range:** `7235809..be0edbf` (HEAD `be0edbf`). Tree is **clean**,
> everything pushed. `npx tsc --noEmit` + `npx next build` clean at HEAD.
>
> **NEXT SESSION: inline execution of Phase 1 of the Supervisor Production App.**
> Jump to §5 and §6. Read the plan at
> `docs/superpowers/plans/2026-07-30-supervisor-production-app-phase1-foundation.md`.

---

## 0. TL;DR — what happened this session

| # | Work | Status | Commits |
|---|---|---|---|
| A | **Procurement MRP bug**: planner over-stated production (Magnesium 114k vs ~40k forecast). **Root cause: it ignored the Packing Schedule** (planned production) so opening stock was under-counted. Fixed by crediting planned packing into opening stock. | ✅ **Deployed** | `aa1b24e` |
| B | **Per-SKU cover "Apply" button** — change a SKU's target cover in the Finished Goods table → inline Apply → recomputes the whole plan. | ✅ **Deployed** | `548889a` |
| C | **Keep overridden SKUs visible** — lowering a per-SKU target below its cover no longer hides the SKU (so you can raise it back). | ✅ **Deployed** | `f2cf76b` |
| D | **NEW PROJECT — Supervisor Production App**: brainstormed → **design spec** → **Phase 1 implementation plan**. Replaces manual spreadsheet entry with a secure mobile PWA + real database. **Not built yet.** | 📋 **Planned** | `50ed63a`, `be0edbf` |

**A–C are live in production. D is design + plan only — Phase 1 is ready to execute next session.**

---

## 1. Procurement MRP fix (A) — DEPLOYED, full detail

### The complaint
On `/procurement`, cycle **05/10/2026 → 30/11/2026**, the planner said make **114,133**
units of Magnesium Refill (SKU `30000432`) while the forecast sales in the cycle were
only ~40,100. User: "why so high?"

### Investigation (grounded in live sheet data via a throwaway googleapis script)
- Reproduced 114,133 exactly. It decomposed as: **target stock (20-week forward cover = 97,818) + cycle demand (40,015) − opening stock (23,700)**.
- **First (WRONG) hypothesis:** the 20-week cover target was too high vs the ~8-week production cadence. I recalibrated cover 16→12 / 20→12. **This was reverted** — it was treating a symptom.
- **Real root cause:** the planner had **no finished-goods supply source except current stock**. It computed opening stock = `current (66,013) − pre-cycle forecast sales (42,313) = 23,700`, i.e. it assumed **zero production between now and the cycle**. In reality the **Packing Schedule** tab has planned July/Aug/Sept Magnesium packing (10k+10k+10k+5k+10k = **45,000** before 05/10). Real opening = `66,013 + 45,000 − 42,313 = 68,700` (≈ the user's own figure of 68,112; the ~600 gap is week-boundary rounding).

### The fix (`aa1b24e`)
- **Reverted cover to 16 global / 20 collagen+magnesium** (the original; user confirmed 20 is correct for magnesium).
- **`computePlan` now takes `packing: PackingRow[]`** and credits **planned packing landing today→cycle-start** into opening stock. **In-cycle packing is NOT netted** — it's part of the production the planner is sizing (user's model: units-to-produce = target + cycle demand − opening; the in-cycle scheduled batches are part of that total).
- New helpers in `lib/procurement.ts`: `packingFor(part)` and `qtyInWindow(pos, lo, hi)`; new `FgPlanRow.plannedPacking` field; `preCycleSupply` list shown in the row breakdown.
- Wired `fetchPackingSchedule()` into **both** `app/procurement/page.tsx` **and** `app/procurement/actions/page.tsx` (both call `computePlan` — the actions page will break the build if you add a `computePlan` arg and forget it).
- **Verified:** Magnesium 05/10→30/11 → opening 68,700, target 97,818 (20w), cycle demand 40,015, **units to produce 69,133** (matches independent raw-sheet calc + user's ~69,721). Confirmed live on production.

### Files touched (A)
`lib/procurement.ts`, `app/procurement/page.tsx`, `app/procurement/actions/page.tsx`,
`components/ProcurementView.tsx` (row breakdown copy).

### Known nuance / open decision (A)
The **69,133 is the TOTAL to produce in the cycle**; the Packing Schedule already has
in-cycle batches (02/11: 25k, 30/11: 15k = 40k) which are **part of** that total, not extra
supply. User was told: if they'd rather see only the *additional* beyond already-scheduled
in-cycle packing (~29k), it's a one-line change. **Not yet decided.**

### Cover model reference (procurement)
`lib/procurement.ts`: `DEFAULT_TARGET_COVER = 16`, `HIGH_TARGET_COVER = 20` (collagen &
magnesium, matched via `isHighTarget()` on description). URL-driven overrides: `cover`,
`coverCM`, `cov=sku:wks,…`. Resolution per SKU: per-SKU override > collagen/mag > global.

---

## 2. Per-SKU "Apply" button (B) — DEPLOYED

`components/ProcurementView.tsx`:
- Refactored `recalc()` into **`pushPlan(nextTargets = targets)`** + **`applyTarget(sku, value)`**
  (merges one SKU's new cover into `targets`, pushes the URL immediately — avoids racing async setState).
- `FgSection` now receives `onApply`; `FgRow` shows an **Apply** button + copper input border
  when the edited value differs from the applied `r.targetCover` (`dirty` flag). Enter key also applies.
- Because the plan is recomputed **server-side from the URL `cov` param**, applying recomputes
  the entire cascade (FG → bulk → RM → ancillaries) in one pass.

## 3. Keep overridden SKUs visible (C) — DEPLOYED

`lib/procurement.ts`: FG-row inclusion filter changed from
`if (unitsToProduce > 0 || openingCover < N)` to also include
`|| perSku[skuCode] !== undefined` (`hasOverride`). **Why:** lowering a per-SKU target below
its cover made the SKU "covered" → it was filtered out of the Finished Goods table → its input
disappeared → user couldn't raise it back ("shows 1 and won't change"). Now overridden SKUs
stay visible (shown as "Covered") so their target is always editable. Verified live: set
Magnesium to 1 → stays as "Covered" → raise to 16 → Apply → recomputes.

---

## 4. Non-work item: "switch off transcript reading"
User asked twice to "switch off transcript reading." There is **no such mode active** — I do
not use the session-transcript search tool, and the settings.json files are essentially empty
(checked `~/.claude/settings.json` = `{}`, others absent). Nothing to toggle. If it recurs,
ask the user exactly what UI they're seeing; it may be a Claude Code client setting, not
anything in this repo.

---

## 5. ★ NEW PROJECT: Supervisor Production App (D) — DESIGN + PLAN, not built

**The ask:** get rid of the manual production spreadsheet. Build a mobile interface where
production **supervisors log in on their phones**, do the **startup checks**, and **log
production data**; the data flows into this dashboard **instead of** the spreadsheet, visible
to the wider business. User explicitly wants **accuracy** (the current tracker is manual and
inaccurate) and **security/traceability** (who entered what, for accountability). User was
adamant: **keep this ENTIRELY separate from the practitioner-portal project** — no shared DB,
code, or config.

### 5.1 Documents (READ THESE FIRST next session)
- **Spec:** `docs/superpowers/specs/2026-07-30-supervisor-production-app-design.md` (approved).
- **Phase 1 plan:** `docs/superpowers/plans/2026-07-30-supervisor-production-app-phase1-foundation.md`
  (8 TDD tasks, complete code in every step).

### 5.2 Every decision made during brainstorming (locked in)
1. **App type → PWA** (installable web app) built **inside the existing `wild-dash` Next.js
   repo** — no second codebase, no app stores. Route prefix **`/floor`** (supervisor app),
   **`/admin`** (admin), **`/api/floor/*`** (auth API). Add-to-Home-Screen, full-screen,
   remembers login.
2. **Auth → username + password.** bcryptjs (cost 10), server-side **`sessions`** table +
   **httpOnly cookie `wd_floor_sid`**. Roles: **supervisor** (uses app), **manager** (views
   dashboard), **admin** (manages config). Every entry stamped with `logged_by` + timestamp;
   full **`audit_log`** (field-level old→new). **Server is source of trust** — phone sends raw
   numbers, server validates + computes efficiency + stamps identity.
3. **Connectivity → always online.** Save-on-entry. **No offline/sync layer.**
4. **Capture unit → per machine run.** One entry = a machine producing a product during a
   shift (planned target, actual output, start/end, downtime, comments). **Output counted
   ONCE**, owned by **one operator**. (Fixes the sheet's double-counting where a run's output
   was copied onto every operator's row.)
5. **One operator per machine at any moment** (they rotate → separate runs). So **per-operator
   appraisal data comes for free** (sum a person's runs) AND totals stay accurate. **No output
   splitting needed.** (This is why the user wanted per-operator: quantified appraisal data.)
6. **Efficiency computed server-side** (`actual/planned`), never client-typed. Also derive
   **throughput (units/hr)** from run time − downtime (more objective than a subjective plan).
7. **`planned_qty`** entered by supervisor per run (option (a)). **Future upgrade (b):** derive
   from a standard run-rate per machine×product for tamper-proof efficiency. **Out of scope now.**
8. **Startup checks → the real controlled GMP doc "SU04 Warehouse Start Up Checks V1"**
   (Google Sheet `1Lui6amAqUlnjd2T6e-fbPNgya-et9ltwJPRlIlT6rL8`, tab **"AutoPack"**, issued by
   Jordan Bain 26/06/2026). Structure: **each item checked at START OF DAY and END OF DAY**,
   each with **Confirm / Deny · Time · Sign · Comments**, plus a **Cross-check signature** (a
   second person) and a technical sign-off. **"Any Deny must be recorded in comments."**
9. **Checklist cadence → ONCE PER DAY, split across shifts:** the **Shift-1 supervisor does
   the Start-of-Day checks ~6am** (this **gates** the day's production logging); the **Shift-2
   supervisor does the End-of-Day checks ~10pm.** Runs are logged per shift within the day.
10. **Sign = the logged-in user's authenticated identity** (no scribble). **Cross-check must be
    a DIFFERENT user** (app-enforced) — stronger than paper.
11. **Deny requires a comment** (server-enforced). **Gate behaviour: record + flag** Denies on
    the dashboard (amber), **does NOT hard-block** the line. (Default; user can switch to
    hard-block. This exact question was asked twice and **dismissed** — default chosen.)
12. **Editing → supervisors can edit/correct their entries** (they make errors). Every edit is
    stamped + trailed in `audit_log`. **Deletes are soft (`void` + reason)** — never erase GMP
    records. **Default edit scope: any supervisor can correct any run** (fully trailed);
    managers/admin edit anything. (Tightenable to own-entries-only.)
13. **Storage → NEW standalone Turso (libSQL) DB.** Env vars in THIS project only:
    `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`. Dev/test = `file:local.db` (no token).
    **Nothing shared with practitioner-portal.**
14. **SKUs** keep coming from `ALL SKU DASHBOARD` via `fetchSkus` (product picker), snapshotted
    onto the run as `product_desc`. **Machines & operators** are managed lists in the DB
    (seeded). **INPUT sheet retired for entry** (historical data left as-is or imported later).
    **Yield / Production Reports stay on the `Reports` sheet — out of scope.**

### 5.3 The 15 seeded SU04 items (by category)
- **Environment:** Area clear from debris · Ventilation units working · No signs of pest
  activity *(critical)* · Yard clear from debris · Waste bins empty
- **Product:** No finished goods left out of boxes on pallets · No over-hanging pallets on
  racking *(critical)* · Pallets clean to an acceptable level
- **Site Security:** Shutter doors locked on arrival/leaving *(critical)* · Fire exit
  functional and shut *(critical)* · Product/pallets not left outside
- **Equipment:** Scales working and in good condition · Safety knives sharp and undamaged *(critical)*
- **Personnel:** Correct PPE being worn *(critical)* · Personnel are fit for work
- **NOTE:** the SU04 doc lists **14** items; the seed adds a 15th ("Personnel are fit for
  work"). If the user wants **exactly the document's 14**, delete that seed line and change the
  seed test's `toBe(15)` → `toBe(14)`. (Confirm with user during Phase 1 execution.)

### 5.4 Data model (10 tables, Turso/SQLite) — see spec §5 + plan Task 2 for full DDL
`users` · `operators` · `machines` · `checklist_templates` (versioned SU04) ·
`checklist_items` · `readiness_days` (one per date: start/end signers + cross-checks + status) ·
`readiness_checks` (one per item per phase: confirm/deny + comment + checked_by + time) ·
`runs` (the core; output once, one operator, void-able) · `audit_log` · `sessions`.

### 5.5 Dashboard reflection (Phase 3, later)
Internal Production tabs read the DB instead of INPUT: **Performance/Appraisals** (per-operator
+ per-machine, efficiency, throughput, downtime, CSV) · **Runs register** (one row per run,
voids flagged/excluded) · **SU04 compliance** (each day's start/end, signers, Denies flagged
amber, export). Yield/Reports unchanged.

### 5.6 Phasing (each phase = its own plan, independently shippable)
- **Phase 1 (PLAN WRITTEN):** DB foundation + auth (Turso client, schema, migrate, seed,
  bcrypt, sessions, login/logout, guards). **← execute next session.**
- **Phase 2 (plan TBD):** Supervisor PWA — SU04 start/end flow + run logging + edit/void +
  audit + PWA manifest/install.
- **Phase 3 (plan TBD):** Dashboard reflection (read DB).
- **Phase 4 (plan TBD):** Admin UI (manage users/operators/machines/checklist templates).

---

## 6. ★ NEXT SESSION — inline execution of Phase 1

User chose **inline execution** (`superpowers:executing-plans`), NOT subagent-driven.
Batch tasks with checkpoints for review.

**Do this:**
1. Read `docs/superpowers/plans/2026-07-30-supervisor-production-app-phase1-foundation.md`
   (and spec `…/specs/2026-07-30-supervisor-production-app-design.md`).
2. Invoke **`superpowers:executing-plans`** and work Tasks 1→8 in order (TDD; each has
   failing-test → run → implement → pass → commit steps with complete code).
3. **New tooling introduced** (no test runner existed before): `npm i @libsql/client bcryptjs`
   + `npm i -D vitest tsx @types/bcryptjs`; add scripts `test`, `test:watch`, `db:migrate`,
   `db:seed`; add `vitest.config.ts`.
4. **Task ordering gotcha:** Task 3 (seed) test imports `hashPassword` from Task 4 — if you go
   strictly in order, run Task 4 before Task 3's test passes (documented in the plan).
5. **Local DB:** add to `.env.local` → `TURSO_DATABASE_URL=file:local.db` and empty
   `TURSO_AUTH_TOKEN`. `SEED_ADMIN_PASSWORD=admin123 npm run db:seed`. Then browser-verify the
   login flow on a mobile viewport (Task 8).
6. **Production Turso DB is a MANUAL user step** (needs their Turso account): `turso db create`
   → URL + token into this project's Vercel env only. Not needed to build/test Phase 1 locally.
   See `docs/supervisor-app-setup.md` (created in Task 8).

**Phase 1 deliverable:** standalone Turso DB with SU04 seeded + secure username/password login
working. Then write the Phase 2 plan.

**Interfaces Phase 2+ will depend on (from Phase 1):** `getClient()`, `hashPassword`/
`verifyPassword`, `createSession`/`getSessionUser`/`destroySession` + `SessionUser`/`Role` +
`SESSION_COOKIE = "wd_floor_sid"`, `getCurrentUser`/`requireUser`/`requireRole`, `authenticate`.

---

## 7. Stack & environment (unchanged from prior handoffs — re-confirmed)

- **Framework:** Next.js **14.2.5** (App Router, TypeScript, Tailwind), React 18. Vercel,
  auto-deploy on push to `main` (no PR flow).
- **"Database" TODAY is Google Sheets** via `googleapis` + a service account
  (`GOOGLE_SERVICE_ACCOUNT_JSON`, email `utkarsh-rawat@wild-dashboard.iam.gserviceaccount.com`).
  Data shapes = `lib/types.ts`; fetchers/writers = `lib/sheets.ts`. **The Supervisor App (§5)
  introduces the FIRST real SQL DB (Turso) — for production entry only; the rest stays on
  Sheets.**
- **No test runner existed** (offline transpile-and-run pattern for pure libs). **Phase 1 adds
  vitest.**
- **LLM chatbot** ("Ask about your data") uses **Groq** (`llama-3.3-70b-versatile`), `GROQ_API_KEY`.
- **Deps of note:** `googleapis`, `recharts`, `docx`, `@vercel/blob`. Phase 1 will add
  `@libsql/client`, `bcryptjs`, `vitest`, `tsx`.

### Key spreadsheet IDs (READ)
| What | ID | Notes |
|---|---|---|
| **Main / Stock** (`SHEET_ID` == const `STOCK_SHEET_ID`) | `1zMaD2kNKedl3G4UWZrEfqJHIknT6m-Nfr0JrpBYf3v0` | ALL SKU DASHBOARD, WNP PLANNING, Open Purchase Orders, **Packing Schedule** (`A1:H470` → `fetchPackingSchedule`; now feeds procurement opening stock), Current Inventory, New Production Master |
| **BOM** (`BOM_SHEET_ID`) | `19WdMemJgSpZyMEHfM6zKwEoEJfuKB5yxc4idIWPKn6w` | BOM matrix RM, BOM Ancillaries |
| **Production INPUT tracker** (`PRODUCTION_INPUT_SHEET_ID`) | `1NnS9fg1mFxnWljbjUUXG9701mUPbvrVyiZ2Lbo2Hplw` | Tab **INPUT** (gid 1067083444), `A1:N1200` → `fetchProductionInput`. Cols: Date, Week, Employee, Shift, Machine, Planned Qty, Actual Qty, Present, Efficiency, Product(SKU), Capsule Size, Speed, Description, Comments. **This is what the Supervisor App replaces.** Also has tabs: Team-KPI, Dashboard, SHIFTS, Employee Output, Detail1-6, KPI, Monthly/Weekly/Daily Output, Master Employees, Production Plan, Product. |
| **WoW forecast** (`WOW_SHEET_ID`) | `19uHzvIjKYpZPh1YO8HLhjX_YNDNNDhiedOCjYPbFBE8` | Tab "WoW Demand"; drives MRP demand/cover (last contiguous 3-code block, col C is a flag). |
| **Production Reports** (`PRODUCTION_REPORTS_SHEET_ID` env) | `1WliT7s1RWt6wfaC1Wg4d9AaubhA6zFvTWOeKN3OoRzc` | `Reports` + `Goods In` tabs (writable). |
| **SU04 startup checks** (NEW, referenced by design) | `1Lui6amAqUlnjd2T6e-fbPNgya-et9ltwJPRlIlT6rL8` | Tab "AutoPack", "Warehouse Start Up Checks V1". Seeded into the app's DB; not read at runtime. |

### Env vars
Existing: `SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `PRODUCTION_REPORTS_SHEET_ID`,
`PRODUCTION_REPORT_PASSWORD` (default `12345`), `GROQ_API_KEY`, `GOODS_IN_PASSWORD` (optional),
`BLOB_READ_WRITE_TOKEN` (still not provisioned — Goods In uploads).
**New (Supervisor App):** `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (dev = `file:local.db`).

### The dashboard's structure (for orientation — Internal Production is ONE part)
Sidebar groups (`components/Sidebar.tsx`): **① Demand & stock** (Overview, Cover Risk,
Inventory, Sales Variance) · **② Production & supply** (External Production, **Internal
Production** = `/planning/*` with sub-tabs Schedule/Performance/Yield/Readiness/Reports + the
report form, Goods In, Packing Schedule, Open Purchase Orders) · **③ Formulation** (Bill of
Materials, Procurement Planner, Procurement Actions, Component Cover).

---

## 8. Credentials / gotchas / manual steps (carried + new)

- **Passwords:** `/planning/report` (create + edit) + Goods In → `12345` unless `*_PASSWORD` set.
- **Market-mode modal:** first dashboard visit shows "Select Market View"; for headless testing
  set cookies `marketMode=dtc; marketsConfigured=1`. Procurement pages do NOT market-filter.
- **Live Reports tab has the user's 5 REAL reports — never test against them.** Use
  `ZZ-…` throwaways via the API and delete them.
- **Google Sheets read quota = 60 reads/min/user** — live scripts that loop reads trip it; the
  app is protected by the sheet cache (`unstable_cache`, tag `"sheets"`).
- **Drive API is DISABLED** for the service account — can't enumerate sheets by name; need the
  URL/ID up front. (Both the INPUT tracker and SU04 sheets are already shared with the service
  account — reads succeeded this session.)
- **Vercel CLI** authed (account `utkarshrawatofficial-2811`, scope `utkarsh-projects12`,
  project `skudashboard`). Deploy = `git push origin main`; check =
  `npx vercel ls skudashboard | sed 's/\x1b\[[0-9;]*m//g'`.
- **Dev-server gotcha:** the in-app Browser pane sometimes renders blank on `scroll`/screenshot;
  DOM-level `javascript_tool` checks are reliable. Also Next dev can serve a **stale route
  render for a URL you visited under old code** — navigate to a fresh URL (or hard reload) to
  see new output. Both hit this session; production always fine.
- **Both `app/procurement/page.tsx` and `app/procurement/actions/page.tsx` call `computePlan`** —
  keep their argument lists in sync or the build breaks.

---

## 9. Left open / not done

1. **Supervisor App Phases 1–4 not built** — Phase 1 plan ready (§6). Phases 2–4 need plans.
2. **Procurement in-cycle-packing netting (§1)** — decide whether to show TOTAL cycle production
   (current, 69,133) or only ADDITIONAL beyond already-scheduled in-cycle packing (~29k).
3. **SU04 item count** — seed has 15; document has 14 (the extra is "Personnel are fit for
   work"). Confirm with user.
4. **`planned_qty` upgrade** — later derive from machine×product standard run-rate for
   tamper-proof efficiency.
5. **INPUT historical import** — optionally one-time import legacy sheet rows into `runs`.
6. **Carried over (still open from prior handoffs):** Goods In file uploads need
   `BLOB_READ_WRITE_TOKEN`; WNT in-transit column (col M of ALL SKU DASHBOARD) not captured;
   MRP per-SKU targets are URL-only (no persistence); 52 forecast-only WoW SKUs can't be
   part-planned; Procurement Actions raised/received tracker; Expiry/BBD alerts. See
   `SESSION_HANDOFF_2026-07-27.md` §6 for detail.

---

## 10. Read order for the next session
1. **This file** (§5 + §6 especially).
2. `docs/superpowers/plans/2026-07-30-supervisor-production-app-phase1-foundation.md` — execute this.
3. `docs/superpowers/specs/2026-07-30-supervisor-production-app-design.md` — the design behind it.
4. `SESSION_HANDOFF_2026-07-27.md` — prior session (procurement/MRP, consolidation, reports).
5. `CONTEXT.md` — evergreen; `lib/types.ts` + `lib/sheets.ts` — the current (Sheets) data layer.

**Golden rules:** Sheets is the current data source (Turso is NEW, for production entry only,
and STANDALONE — nothing shared with practitioner-portal); `SHEET_ID` == `STOCK_SHEET_ID`;
MRP demand/cover come from WoW Demand; opening stock now includes **planned Packing Schedule**;
procurement cover = 16 global / 20 collagen+magnesium; verify in the browser then `git push`
to deploy; **never test against the 5 real reports**; keep pure engines offline-testable.
