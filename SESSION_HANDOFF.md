# SESSION_HANDOFF.md — Wild Nutrition SKU Dashboard

> Written 2026-07-21 at end of an autonomous session. This is the durable memory of
> what was done, what was decided, and what's left. Pair it with **`CONTEXT.md`**
> (the maintained full project handoff) — this file is session-specific and
> exhaustive; CONTEXT.md is the evergreen reference.

---

## 0. TL;DR — what shipped this session

All committed to `main` and auto-deployed to https://skudashboard.vercel.app (Vercel).
Session commits (newest first):

| Commit | What |
|---|---|
| `1505a00` | Cache raw sheet reads (120s) — stops Google Sheets per-minute quota trips |
| `f898d40` | **Component Cover** — weeks-of-cover low-stock view (bulk/RM/ancillary) |
| `84b395f` | **Bulk make-readiness** — multi-level RM check on the Readiness page |
| `7b6115c` | **Procurement Actions** — supplier-grouped order action list |
| `a7c14f7` | Readiness fix: bulk (1-code) stock is in **thousands** |
| `95cf71e` / `2a0dd96` | **Production Readiness** (MRP-lite, 10-day component check) |
| `4379837` | Production report: **quantity-weighted** blended wastage |
| `dcf5525` | Production report: **multi-batch, multi-bulk, disposal #, comments** |

Everything below is grouped to match the requested handoff checklist.

---

## 1. ACCEPTANCE CHECKLIST (item by item)

The user never gave a formal written acceptance list; this is reconstructed from the
explicit asks across the session. Status + file paths for each.

### 1a. Production Report form enhancements — ✅ DONE
- **Add multiple product batches (add/remove)** — ✅ `components/ProductionReportForm.tsx` (batches state, "+ Add batch")
- **Product type selector (Jars / Refills / Daily Essentials / Powders)** — ✅ `lib/production-report.ts` (`PRODUCT_TYPES`), form select
- **Multiple bulks per work order, each with own used + capsule waste** — ✅ `ProductionReportForm.tsx` (bulks state, "+ Add bulk"); math in `lib/production-report.ts` `computeWastage()`
- **Disposal Number field (ERP ref, one per report)** — ✅ form + `lib/production-report.ts`
- **Production Comments field** — ✅ form + lib
- **Write to sheet as one-row-per-bulk, non-destructive** — ✅ `lib/sheets.ts` `appendProductionReport()`; API `app/api/production-report/route.ts`
- **Verified live end-to-end** — ✅ real 3-bulk POST written to the live Reports tab, confirmed, then test rows deleted (see §7).

### 1b. Weighted blended wastage — ✅ DONE
- Switched simple-average → **quantity-weighted** blended wastage — ✅ `lib/production-report.ts` `computeWastage()` (weight each part % by its denominator).

### 1c. Production Readiness (MRP-lite, 10 days) — ✅ DONE
- **Flag WOs in next 10 days short on bulk/ancillary** — ✅ engine `lib/readiness.ts` `computeReadiness()`; page `app/planning/readiness/page.tsx`; UI `components/ReadinessView.tsx`
- **Ancillaries from BOM, skip scoops/shippers** — ✅ (jar/lid/label/box/pouch subset)
- **Time-phased netting (shortage cascades across WOs)** — ✅
- **Overview banner + sidebar link** — ✅ `app/page.tsx`, `components/Sidebar.tsx`
- **Bulk stock is in thousands (×1000; keep values already written in full)** — ✅ `lib/readiness.ts` `bulkCaps()`, threshold 100,000

### 1d. Post-`mybizna/mrp` review — 3 chosen features
The referenced repo (`github.com/mybizna/mrp`) turned out to be a **bare PHP/Laravel
skeleton** (one empty model, wishlist README, no logic). Used its feature list as a
checklist only. Three features chosen:

- **#1 Procurement action list + PO tracker** — 🟡 **PARTIAL**
  - Action list (supplier-grouped, exportable draft PO) — ✅ `lib/procurement-actions.ts`, `app/procurement/actions/page.tsx`, `components/ProcurementActionsView.tsx`, sidebar link
  - Raised/received **status tracker** — ❌ **NOT DONE** (deferred; needs a persistence tab — see §6)
- **#2 Bulk make-readiness (multi-level)** — 🟡 **DONE but partial by design**
  - RM explosion + makeable/blocked + planned-WO detection — ✅ `lib/readiness.ts` (`bulkMake`, opt-in via `rmBom`); UI section in `components/ReadinessView.tsx`
  - **Lead-time backward-scheduling** — ❌ NOT modelled (no per-bulk TPM lead-time data exists; see §6)
  - Currently **dormant on live data** (no bulk is short after the thousands fix) — correct, not a bug
- **#3 Expiry (BBD) & reorder-point alerts** — 🔀 **SWAPPED → Component Cover** ✅
  - Real expiry alerts **NOT POSSIBLE**: verified Current Inventory sheet has **no BBD/expiry column** (see §6)
  - Built the feasible, non-redundant slice instead: **Component Cover** (weeks-of-cover for bulk/RM/ancillary) — ✅ `lib/component-cover.ts`, `app/component-cover/page.tsx`, `components/ComponentCoverView.tsx`, sidebar link

### 1e. Reliability — ✅ DONE
- **Google Sheets per-minute read-quota trips** (heavy pages read 6–8 ranges each, `revalidate=0`) — ✅ fixed via 120s raw-value cache in `lib/sheets.ts` (`cachedValues`). Verified: 4 heavy pages back-to-back, **zero quota errors**; `npm run build` passes.

---

## 2. DECISIONS I MADE THAT WEREN'T EXPLICITLY SPECIFIED

(Confirmed with the user where marked ✅-asked; otherwise inferred.)

**Production report form / sheet:**
- "Multiple batches" = **product/finished-good batches** (Batch + BBD pairs); bulks are a separate repeatable group. ✅-asked
- Per-bulk **used + capsule waste** (not one combined figure). ✅-asked
- Sheet layout = **one row per bulk**. ✅-asked
- Disposal number = **one per report** (not per part). ✅-asked
- Kept the **existing 29 columns A–AC unchanged**; appended 5 new columns AD–AH (Product Type, Disposal Number, Comments, Report ID, Bulk Seq). First bulk row carries report-level fields; later bulk rows leave them blank to avoid double-counting. (Inferred — least-destructive to the live reconciliation sheet.)
- `appendProductionReport` now **upserts the header row** so new columns get labelled. (Inferred.)
- `fetchProductionReports` now filters to rows where **Made (col 11) is populated** → one record per report (so the Performance page's wastage isn't skewed by the extra per-bulk rows). (Inferred.)
- **Report ID** format = `${workOrder}-${Date.now()}`; **Bulk Seq** = `"1/3"` style. (Inferred naming.)

**Weighted wastage:**
- "Weighted" = **quantity-weighted mean** (each part % weighted by its denominator: bulk→used caps, ancillary→made+waste). Equivalent to `100 × Σwaste ÷ Σbase`. ✅-asked (chose weighted); formula was inferred.

**Readiness engine:**
- Packing-warehouse set for on-hand = **{WNP, WNC}** (constant `PACKING_WAREHOUSES`). Inferred; flagged for user to confirm.
- Horizon-date derivation = **specific day** from `PLANNED WEEK (WC)` + first weekday in `PLANNED DAYS`, fallback to week-commencing for fuzzy strings ("Thursday - Friday" picks the earliest day). ✅-asked (chose specific-day).
- Bulk depth = **on-hand + inbound** (green/amber/red). ✅-asked.
- Ancillary subset = **jar/lid/label/box/pouch**, skip scoops/shippers/unmatched. ✅-asked.
- Only `productCode` starting **"3"** checked; other WOs excluded and counted. (Inferred.)
- Alerting = **dashboard + Overview banner** (no email digest in v1). ✅-asked.
- **Bulk thousands threshold = 100,000**: values `< 100000` are ×1000, `≥ 100000` kept as-is. Chosen from live data (clean gap: largest "thousands" ≈ 3,360; smallest "actual" ≈ 748,755). ✅-asked (rule); threshold inferred.

**Procurement Actions:**
- Supplier **inferred per part from its most-recent-dated PO/production `vendorName`**; unknown → grouped "Supplier not on file". (Inferred — no supplier master exists.)
- Bulk order qty shown in **units of 1,000 caps**; FG `unitsToProduce` **excluded** (that's an internal WO, not a purchase). (Inferred.)
- v1 is **read-only + CSV** (status tracker deferred). (Inferred phasing.)

**Component Cover:**
- RAG thresholds = **critical < 4 weeks, low < 8 weeks** (mirrors the FG cover-status bands). (Inferred.)
- Stock basis = **total across all warehouses** (bulk thousands-normalised). (Inferred.)
- Ancillary subset = same jar/lid/label/box/pouch filter. (Inferred, for consistency.)
- Skip bulk codes that aren't real 1-codes (drops literal "N/A"). (Inferred, data-cleaning.)
- WEEKS_PER_MONTH = 4.33 (matches procurement.ts). (Inferred, consistency.)

**Caching:**
- **120s TTL**, cache the **raw `string[][]`** (not parsed objects — so BOM `Map`s rebuild per request). Aligns with the UI's existing "refreshes every 5 min" copy. (Inferred.)

**Routes / naming / icons (all inferred):**
- `/planning/readiness` ("Production Readiness", ⚑), `/procurement/actions` ("Procurement Actions", ⛁), `/component-cover` ("Component Cover", ◈). Sidebar groups: readiness under Production; actions & component-cover under Formulation.

---

## 3. DEVIATION FROM STACK ASSUMPTIONS (IMPORTANT — read this)

The handoff-request template assumed **Next.js / Turso / Shopify webhooks / a SQL DB**.
The **real** stack is different:

- **Framework:** Next.js **14** (App Router, TypeScript, Tailwind). ✅ (that part matched)
- **Database:** **There is NO SQL database. No Turso, no Postgres, no Prisma/Drizzle.**
  The "database" is **Google Sheets**, read via the `googleapis` npm package with a
  **service-account** (`GOOGLE_SERVICE_ACCOUNT_JSON`). See §4 for the de-facto schema.
- **Shopify:** **Not in this project.** There are no Shopify webhooks, no test store, no
  Shopify anything here. (You may be thinking of the *practitioner-portal* project, which
  is a different repo under `Wild Dash/`.) This project = the **SKU Dashboard** only.
- **Auth:** No user auth system. One page (`/planning/report`) is gated by a **shared
  password** (`PRODUCTION_REPORT_PASSWORD`, default `12345`). Everything else is open.
- **Hosting/CI:** **Vercel**, auto-deploy on `git push` to `main`. Repo:
  `github.com/Utkarshraw123/SKUDASHBOARD`.
- **LLM:** the chatbot (`app/api/chat`) uses **Groq** (`llama-3.3-70b-versatile`), not
  OpenAI/Anthropic. Env `GROQ_API_KEY`.
- **ORM/migrations:** none. Data shape is defined by TypeScript interfaces in
  `lib/types.ts` and the fetcher/parser functions in `lib/sheets.ts`.

---

## 4. "DB SCHEMA" AS IT ACTUALLY EXISTS (Google Sheets)

There are no SQL tables. Data lives in **Google Sheets tabs**. The app READS from four
spreadsheets and WRITES to exactly one tab.

### 4a. Source spreadsheets & tabs (READ-only)

| Spreadsheet (env / const) | ID | Tabs used (range) → fetcher |
|---|---|---|
| Main (`SHEET_ID` env) | *(in env)* | `ALL SKU DASHBOARD!A1:AX200` → `fetchSkus`; `New Production Master!A1:W430` → `fetchProduction`; `WNP PLANNING!A1:V1048` → `fetchWNPPlanning`; `Open Purchase Orders!A1:L240` → `fetchBulkOpenPOs`; `Packing Schedule!A1:H470` → `fetchPackingSchedule` |
| BOM (`BOM_SHEET_ID` const) | `19WdMemJgSpZyMEHfM6zKwEoEJfuKB5yxc4idIWPKn6w` | `BOM matrix RM!A1:BZ800` → `fetchRmBom`; `BOM Ancillaries!A1:EZ800` → `fetchAncillaryBom` (both `UNFORMATTED_VALUE`) |
| Stock (`STOCK_SHEET_ID` const) | `1zMaD2kNKedl3G4UWZrEfqJHIknT6m-Nfr0JrpBYf3v0` | `Current Inventory!A1:F5000` → `fetchCurrentInventory` |
| Production INPUT (`PRODUCTION_INPUT_SHEET_ID` const) | `1NnS9fg1mFxnWljbjUUXG9701mUPbvrVyiZ2Lbo2Hplw` | `INPUT!A1:N1200` → `fetchProductionInput` |

Column→field mappings live in `lib/sheets.ts` (each fetcher) and `lib/types.ts`
(`SkuRow`, `ProductionRow`, `PlanningRow`, `BulkPoRow`, `PackingRow`, `InventoryRow`,
`BomSheet`/`BomProduct`/`BomComponent`, `ProductionInputRow`).

Key column facts:
- **`Current Inventory`** = 6 columns only: `Warehouse | Warehouse Desc. | Part Number |
  Part Description | Balance | Unit`. **No BBD / expiry / batch column** (this blocks
  real expiry alerts — see §6).
- **Bulk (1-code) quantities are in THOUSANDS** across the DB (stock AND POs). Normalised
  by `bulkCaps(v) = v < 100000 ? v*1000 : v`.
- Part-code convention: **1**=bulk/capsules, **2**=raw materials, **3**=finished goods
  (packed), **4**=ancillaries. External production cost is **per 1,000 capsules**.

### 4b. The ONE write target (the closest thing to a "table")

**Spreadsheet:** `PRODUCTION_REPORTS_SHEET_ID` (env) = `1WliT7s1RWt6wfaC1Wg4d9AaubhA6zFvTWOeKN3OoRzc`
**Tab:** `Reports` — auto-created + header auto-upserted on first write.
**Written by:** `appendProductionReport()` in `lib/sheets.ts` (via `app/api/production-report/route.ts`).
**Read back by:** `fetchProductionReports()` (for the Performance page's wastage).

**Current schema — 34 columns (A–AH), one row per bulk** (defined in
`lib/production-report.ts` `REPORT_HEADERS`):

| # | Col | Header | Notes |
|---|---|---|---|
|1|A|Timestamp|ISO, all rows|
|2|B|Work Order|all rows|
|3|C|SKU|all rows|
|4|D|Description|all rows|
|5|E|Product Batch|**first bulk row only**, batches joined by " \| "|
|6|F|Product BBD|first row only, joined|
|7|G|Bulk Code|per bulk|
|8|H|Bulk Description|per bulk|
|9|I|Bulk Batch|per bulk|
|10|J|Bulk BBD|per bulk|
|11|K|Used|per bulk (caps used from this bulk)|
|12|L|Made|**first row only** (finished units) — `fetchProductionReports` filters on this being non-empty|
|13|M|People|first row only|
|14|N|WO Status|all rows|
|15|O|Waste Capsules|per bulk|
|16–21|P–U|Waste Jars/Lids/Labels/Box/Pouches/Desiccants|first row only (ancillary, report-level)|
|22|V|Capsule Waste %|per bulk|
|23–28|W–AB|Jars/Lids/Labels/Box/Pouches/Desiccants Waste %|first row only|
|29|AC|Blended Waste %|first row only (quantity-weighted) — Performance page reads this at index 28|
|30|AD|Product Type|all rows (jars/refills/daily_essentials/powders)|
|31|AE|Disposal Number|all rows|
|32|AF|Comments|all rows|
|33|AG|Report ID|all rows (groups the bulk rows of one report)|
|34|AH|Bulk Seq|"1/3" style|

**Invariant:** columns A–AC (index 0–28) are unchanged from the original 29-col layout, so
old rows and the Performance read (`Made`@11, `Blended`@28) stay valid.

---

## 5. ENVIRONMENT VARIABLES IN USE

All in `.env.local` (gitignored) AND must be set in Vercel. No secret values here.

| Var | Description |
|---|---|
| `SHEET_ID` | ID of the main Google Sheet (SKU dashboard, planning, POs, packing) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Stringified service-account JSON creds (read+write scope `spreadsheets`) |
| `GROQ_API_KEY` | Groq API key for the chatbot (`/api/chat`, llama-3.3-70b) |
| `PRODUCTION_REPORTS_SHEET_ID` | ID of the sheet the production report form writes to (Reports tab) |
| `PRODUCTION_REPORT_PASSWORD` | Shared password gating `/planning/report` (default `12345` if unset) |
| `VERCEL_OIDC_TOKEN` | Auto-injected by Vercel tooling locally; not app code — ignore |

**Also hardcoded in `lib/sheets.ts`** (not env, but effectively config): `BOM_SHEET_ID`,
`STOCK_SHEET_ID`, `PRODUCTION_INPUT_SHEET_ID` (values in §4a).

**Service-account JSON file** lives at `/Users/utkarshrawat/Desktop/wild-dashboard-2db2869d37c6.json`
— **never commit it**. Each source sheet must be **shared with the service-account email**
(Reports sheet = Editor; others = at least Viewer).

---

## 6. LEFT BROKEN / STUBBED / PARTIAL — and exactly what's needed

1. **Procurement Actions — raised/received status tracker** (NOT built).
   - Now: read-only list + CSV (`components/ProcurementActionsView.tsx`).
   - To finish: add a persistence store (mirror `appendProductionReport` — a new tab, e.g.
     "Procurement Orders", in `PRODUCTION_REPORTS_SHEET_ID`), a POST route to mark
     raised/received, and merge saved status into `buildOrderActions` output. **User must
     explicitly approve creating that tab** (writes to their live sheet).

2. **Expiry / BBD alerts** (blocked by data).
   - `Current Inventory` has **no BBD column** (verified — 6 cols only). Real "expiring
     within N weeks" alerts are impossible until a **BBD/batch column is added to that
     sheet**. Once added, build alongside `lib/component-cover.ts`. (We shipped Component
     Cover instead.)

3. **Bulk make-readiness — lead-time backward-scheduling** (not modelled).
   - `lib/readiness.ts` `bulkMake` checks RM availability but does **not** do date-based
     backward scheduling (bulk-make lead time before packing, RM arrival before that).
     No per-bulk TPM lead-time data exists. To finish: add a lead-time source/constant and
     schedule RM/bulk deadlines back from each WO date.

4. **Component Cover — 0.0w rows** (interpretation, not a bug).
   - Components with demand but **0 stock in the sheet** show 0.0w and count as critical.
     Some are genuinely critical; some may be **made-to-order / not stocked** in the
     inventory sheet. Worth a human pass to confirm which. No code fix needed unless the
     user wants such parts excluded.

5. **Readiness `PACKING_WAREHOUSES = {WNP, WNC}` assumption** (needs confirmation).
   - Bulk on-hand counts only WNP/WNC. Live data shows near-zero bulk there (bulk arrives
     just before packing), so bulk flags lean on inbound POs. If real bulk sits at a TPM/in
     transit and isn't captured as an inbound PO, it will over-flag. Constant is at the top
     of `lib/readiness.ts` — easy to widen.

6. **Sheets quota** — mitigated (120s cache) but not eliminated. If a burst still trips it,
   the error boundary shows "Try again" and the Overview banner degrades to hidden
   (wrapped in try/catch in `app/page.tsx`). Could raise TTL or add stale-while-revalidate.

7. **Phase-2 email digest** for Readiness (not built) — a daily Resend email of red/amber
   WOs, same pattern as the separate flight-engine cron. Future.

---

## 7. TEST DATA, CREDS, MANUAL STEPS (redo if starting fresh)

- **Production report live write was tested and CLEANED UP.** A 3-bulk test report
  (Work Order `ZZ-TEST-DELETE-ME`) was POSTed to the live Reports tab to verify, then the
  3 rows were **deleted** (`scratchpad/cleanup-sheet.js`). **No lingering test data.** The
  first *real* submission will also relabel/extend the header row 29→34 cols (safe).
- **`/planning/report` password** = `12345` (env `PRODUCTION_REPORT_PASSWORD`). Share link
  is public; only the password gates it.
- **Vercel CLI** is authenticated on this machine (account `utkarshrawatofficial-2811`,
  scope `utkarsh-projects12`, project `skudashboard`). `npx vercel ls` / `inspect` work.
  Deploy is normally just `git push` (auto-deploy); CLI is for status/env only.
- **Git** pushes via osxkeychain credential to `github.com/Utkarshraw123/SKUDASHBOARD`
  (main branch). No PR flow — commit straight to main → Vercel builds.
- **Google service account** must have access to all 4 source sheets + the Reports sheet.
  Creds file: `/Users/utkarshrawat/Desktop/wild-dashboard-2db2869d37c6.json` (do not commit).
- **Market-mode modal:** first visit shows a "Select Market View" modal that sets cookies
  `marketMode` + `marketsConfigured`. In headless/browser testing, set those cookies to
  skip it (e.g. `marketMode=dtc; marketsConfigured=1`).
- **Local dev quirk (CONTEXT.md §7):** if localhost looks unstyled/black-and-white, a stale
  dev server is holding port 3000 — kill it, `rm -rf .next`, restart. A long-running dev
  server can also start serving 500s for `_next` chunks (hydration breaks) — same fix.
- **No Shopify / Mailchimp / Turso / external DB to re-point.** None exist in this project.
- **Scratchpad test scripts** (not in repo; in the session scratchpad dir) verified the
  pure engines: `test-report.js`, `test-readiness.js`, `test-component-cover.js`,
  `read-sheet.js`, `cleanup-sheet.js`. They transpile the `lib/*.ts` pure functions with
  the TS compiler API and assert. Re-create similar if you need to re-verify logic offline
  (no test runner is installed in the repo).

---

## 8. IF PICKING THIS UP IN A NEW SESSION — READ IN THIS ORDER

1. **`CONTEXT.md`** (repo root) — the maintained full project handoff: data sources,
   part-code rules, every section/feature, env, conventions. Start here.
2. **This file (`SESSION_HANDOFF.md`)** — what changed this session + open items.
3. **`lib/types.ts`** — the data shapes (there's no ORM; these interfaces ARE the schema).
4. **`lib/sheets.ts`** — every fetcher, the `cachedValues` layer, and `appendProductionReport`
   (the only write). Understand this before touching data.
5. **`lib/procurement.ts`** — `computePlan()`, the engine most other features reuse
   (BOM explosion + stock netting). Then `lib/readiness.ts`, `lib/procurement-actions.ts`,
   `lib/component-cover.ts`, `lib/production-report.ts` (all pure, unit-test-friendly).
6. **`components/Sidebar.tsx`** — the route map / nav (fastest way to see every page).
7. **`docs/superpowers/specs/2026-07-20-production-readiness-mrp.md`** — the approved design
   spec for the Readiness feature (pattern for how features are specced here).

**Golden rules:** data source is Google Sheets (not a DB); bulk 1-code quantities are in
thousands; keep engines pure and add a scratchpad transpile-test before wiring UI; verify
in the browser preview then `git push` to deploy; don't write to the live Reports sheet
(or create new tabs) without explicit user go.
