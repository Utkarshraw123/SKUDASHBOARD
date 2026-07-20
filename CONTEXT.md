# Wild Nutrition SKU Dashboard — Full Project Context

> Handoff file: everything needed to continue work in a fresh chat without losing context.
> Last updated: 2026-07-03

## 1. What this is

A Next.js 14 (App Router, TypeScript, Tailwind) dashboard for Wild Nutrition's supply/production planning, reading live data from Google Sheets via a service account. Built iteratively with Claude Code.

- **Local dev:** `npm run dev` in `wild-dash/` → http://localhost:3000
- **Live:** https://skudashboard.vercel.app
- **Repo:** https://github.com/Utkarshraw123/SKUDASHBOARD (main branch, Vercel auto-deploys on push)
- **User:** Utkarsh Rawat, supply/production planner at Wild Nutrition (mailmeutkarsh1999@gmail.com)

## 2. Critical business knowledge (Wild Nutrition part-number coding)

- **1-codes (10000…):** bulk / capsules. Produced by third-party manufacturers (TPMs) from raw materials.
- **2-codes (2…):** raw materials (RMs) used to make bulk capsules.
- **3-codes (3…):** finished goods (jars, pouches, boxes of product) — this is what gets PACKED.
- **4-codes (4…):** ancillaries — jars, lids, labels, boxes, pouches, scoops, shippers.
- **Packing questions always refer to 3-codes** (never 1-codes; 1-code = bulk production).
- **External production cost is per 1,000 capsules.** Qty 325 at £11.36 = 325,000 capsules; total cost = qty × costPerUnit.
- **Fill** = capsules per unit (30/60/90/120). Displayed as plain number, never with % sign.
- Wild Nutrition doesn't produce capsules in-house from RMs; TPMs do. So RM stock at own warehouses (WNP/WNC) = excess/available; RM stock at TPMs = already planned for use.
- Nearby TPMs + in-house truck → transit/lead times are negligible, not modelled.

## 3. Google Sheets data sources

Service account creds in env var `GOOGLE_SERVICE_ACCOUNT_JSON` (local `.env.local`, also set in Vercel). JSON file lives at `/Users/utkarshrawat/Desktop/wild-dashboard-2db2869d37c6.json` — NEVER commit it.

### Main sheet (`SHEET_ID` env var)
| Tab | Fetcher | Content |
|---|---|---|
| ALL SKU DASHBOARD | `fetchSkus` | ~186 SKUs: cover, inventory, WNP stock, fill, monthly demand, variance, bulk code, planned deliveries |
| New Production Master | `fetchProduction` | External production POs/WOs; status derived: received>=qty→complete, >0→partial, else open |
| WNP PLANNING | `fetchWNPPlanning` | Internal production work orders (batch, BBD, qty produced, completion) |
| Open Purchase Orders | `fetchBulkOpenPOs` | Open POs (all part types) |
| Packing Schedule | `fetchPackingSchedule` | Packing orders with due dates, vendors |

### BOM sheet (`19WdMemJgSpZyMEHfM6zKwEoEJfuKB5yxc4idIWPKn6w` — "KIT BUILD AI")
- Tab `BOM matrix RM` (`fetchRmBom`): matrix — rows=2-code RMs, cols=1-code bulks, values=kg per 1,000 capsules
- Tab `BOM Ancillaries` (`fetchAncillaryBom`): rows=4-code ancillaries, cols=3-code FGs, values=units per product
- Matrix layout: row0=product codes (from col C), row1=product names, row3+=components (colA=code, colB=name)
- **Must fetch with `valueRenderOption: "UNFORMATTED_VALUE"`** (formula cells otherwise return empty); all cells coerced via `String()` before `.trim()`; qty handled as number-or-string
- Ranges: RM `A1:BZ800`, Ancillaries `A1:EZ800`

### Stock sheet (`1zMaD2kNKedl3G4UWZrEfqJHIknT6m-Nfr0JrpBYf3v0`)
- Tab `Current Inventory` (`fetchCurrentInventory`): Warehouse | Warehouse Desc | Part Number | Part Description | Balance | Unit. User pastes fresh data every planning cycle.
- Warehouse codes: EXG (Express and Global = "E&G"), BCA (Brighton Carriers), WNP (Wild Nutrition Production), WNC (Wild Nutrition Create), plus TPMs: ACP, ARE, LIF, LIQ, PHP, RAI, SPF etc., Amazon: FBA/DEAM/IEAM, transit: WNT/LIQT/LTRN/RaiT, quarantine: WNQ/WNQC.

## 4. Code structure (`wild-dash/`)

```
app/
  page.tsx            Overview KPIs
  risk/               Cover risk (<16w)
  inventory/          Inventory table + chart (Fill shown as plain number)
  variance/           Sales variance (out/under-performing tables)
  production/         External production (mobile cards + desktop fixed-layout table, minWidth 1260px)
  planning/           Internal production (WNP work orders)
  packing/            Packing schedule with urgency logic
  purchase-orders/    Open POs
  bom/                BOM search (Where Used / Product BOM)
  procurement/        Procurement Planner (NEW — see §6)
  sku/[code]/         SKU detail
  api/chat/route.ts   Chatbot (Groq)
components/
  Sidebar.tsx         Nav; market-mode panel; inlined MODE_LABELS (must NOT import lib/markets — server-only)
  FilterBar.tsx       Search + selects + date filters + This Week/This Month chips (periodKeys prop)
  ExportCsvButton.tsx Table→CSV download (walks up DOM to nearest <table>)
  BomSearch.tsx       Client BOM search, both directions, per-card CSV export
  ProcurementView.tsx Procurement UI: CyclePicker + 4 expandable-section tables
  MarketModal.tsx     Exclusive market mode selector (all/dtc/eu/us/accessories), cookie-persisted
lib/
  sheets.ts           All fetchers (React cache()), cleanNum/cleanPct, parseBomMatrix
  procurement.ts      computePlan() — full planning engine (see §6)
  markets.ts          Market filtering + futureDateOnly(DD/MM) + futureDateFull(DD/MM/YYYY) — uses next/headers, server-only
  types.ts            SkuRow, ProductionRow, PlanningRow, BulkPoRow, PackingRow, Bom types, getCoverStatus
docs/superpowers/specs/2026-07-02-procurement-planner-design.md   Approved spec
```

## 5. Key behaviours already built

- **Dates:** never show past dates where future dates are expected. `futureDateOnly` (DD/MM), `futureDateFull` (DD/MM/YYYY) return null for past dates → UI shows "—". Completed orders still show their actual (past) dates.
- **External production:** total cost KPI = open orders only. Sorted newest first. Fixed colgroup widths.
- **Internal production:** sorted newest first.
- **Packing schedule status:** external vendor rows → overdue/this_week/upcoming by due date. Internal rows (blank vendor) → "Planned (Internal)" if in WNP planning (planned/in_progress) else: cover>=16w → blue "Sufficient Stock", else red "Not Planned ⚠". KPI cards + filters for all six statuses.
- **Filters:** all main tables have FilterBar; This Week / This Month chips (periodKeys={from:"dateFrom",to:"dateTo"}) on production, planning, packing.
- **CSV export:** ExportCsvButton on every table (production, planning, packing, POs, inventory, risk, variance ×2, BOM cards, procurement ×4). Exports rendered table as `<name>-<date>.csv`.
- **Market modes:** exclusive radio (All SKUs / DTC & Retail / EU / US / Accessories), cookies `marketMode` + `marketsConfigured`.
- **Chatbot** (`/api/chat`): Groq `llama-3.3-70b-versatile` (12k TPM free), SSE streaming, max_tokens 800, temp 0.2, last 6 turns. Context: last 80 planning rows (all statuses incl. WO/batch/BBD), 35 newest external POs (open+completed), 20 open bulk POs, 20 packing rows, 20 critical SKUs. System prompt rules: packing→3-codes, bulk→1-codes, ETA questions→open orders only, historical spend→ALL orders PO-by-PO, cost=per 1,000 caps, never say "no data" without checking all sections. `GROQ_API_KEY` in .env.local + Vercel.

## 6. Procurement Planner (latest feature — deployed)

User's manual process, now automated: week-on-week cover sheet + current stock + BOM → plan orders without over-ordering.

**Page `/procurement`**, cycle start/end date picker (URL params `start`/`end`, defaults +8w/+16w). Engine in `lib/procurement.ts` `computePlan()`:

1. **Finished Goods (3-codes):** weekly demand = monthlyDemandAvg/4.33. Stock = EXG+BCA+WNP+WNC. Target cover **16w** (**20w if description matches /collagen|magnesium/i**) at cycle END. `unitsToProduce = max(0, targetCover×weeklyDemand − (stock + incomingPOs − demand×weeksUntilCycleEnd))`. Rows below target but covered still shown greyed "Covered".
2. **Bulk (1-codes):** capsules = unitsToProduce × fill, grouped by bulk code (SKU's `bulk` column). Committed pre-cycle consumption = 3-code packing orders + WNP planned rows due between today and cycle start, × fill. `availableBulk = max(0, allStock + openPOqty×1000 − committedCapsules)`; order = needed − available. Leftover bulk after pre-cycle commitments = next-cycle excess (ordered less).
3. **Raw Materials (2-codes):** explode bulkToOrder through RM BOM ((caps/1000)×kg). Excess = WNP+WNC stock only. Net of open POs due ≤ cycle end. **+8% buffer on net.**
4. **Ancillaries (4-codes):** explode unitsToProduce through Ancillary BOM. Only jars/lids/boxes/labels/pouches (regex on name; scoops+shippers excluded). Available = max(0, stock − committed pre-cycle usage) + open POs. Buffers on net: **boxes 5%, labels/pouches/jars/lids 10%.**

- **Open PO rule:** only POs due on/before cycle end count as incoming (from Open Purchase Orders + open New Production Master rows, de-duped).
- Every row expandable → full calculation trail with PO numbers ("why we didn't order").
- CSV export per section.

**Unconfirmed assumptions (user was asked, not yet answered):**
1. Bulk PO quantities assumed in thousands of caps (×1000) while warehouse bulk stock assumed in actual capsule count — VERIFY with real numbers.
2. Collagen/magnesium 20w target matched by description regex — user may want explicit SKU list.

## 6b. Production Reporting Form (deployed 2026-07-03)

Supervisor-facing form for internal production reporting → appends to a dedicated sheet for month-end reconciliation.

- **Route `/planning/report`** — shareable link + "New Production Report" button on Internal Production page. Password-gated (`12345`, env `PRODUCTION_REPORT_PASSWORD`), re-verified server-side.
- **Pre-fill (Option A):** supervisor searches a Work Order (from WNP Planning, newest first, de-duped); auto-fills Description (fallback to SKU dashboard), SKU, first product Batch/BBD, first Bulk Code + Bulk Description (looked up from bulk code via Current Inventory). All editable.
- **Multi-batch / multi-bulk / disposal / comments (added 2026-07-20):**
  - **Product Type** select — Jars / Refills / Daily Essentials / Powders (`PRODUCT_TYPES` in lib).
  - **Product batches** — repeatable Batch+BBD rows ("+ Add batch", Remove when >1). Joined with `" | "` into the single Product Batch / Product BBD columns.
  - **Bulks** — repeatable cards ("+ Add bulk", Remove when >1). Each bulk carries its own Code, Description, Batch, BBD, **Used (caps)** and **Capsules Wasted** (per-bulk, not combined — mainly for Daily Essentials with 3-4 bulks).
  - **Disposal Number** (one ERP disposal ref per report) + **Production Comments** (textarea).
  - Capsule waste is now PER BULK; the Waste card holds only ancillary parts (Jars/Lids/Labels/Box/Pouches/Desiccants), tied to `made`.
- **`lib/production-report.ts`** — `computeWastage()` pure fn: per-bulk capsule % = wasteCapsules/used; ancillary % = waste/(made+waste); **blended = QUANTITY-WEIGHTED mean of active parts** (each % weighted by its denominator — bulk: used caps; ancillary: made+waste; ≡ 100×Σwaste÷Σbase). Switched from simple average 2026-07-20 so a tiny-throughput part can't skew the blend; throughput-dominated (capsules carry most weight). `REPORT_HEADERS` (34 cols) + `reportToRows()` (plural).
- **`app/api/production-report/route.ts`** — POST, verifies password, parses `batches[]` / `bulks[]` / `ancWaste{}` / disposal / comments, computes wastage, calls `appendProductionReport(headers, rows)`. Slack deferred; clean insertion point here.
- **`appendProductionReport()` in sheets.ts** — auto-creates `Reports` tab, **upserts the header row** (extends 29→34 cols non-destructively), appends **one row per bulk**. Service account scope `spreadsheets` (read+write).
- **Sheet layout (ONE ROW PER BULK):** cols A..AC (0..28) unchanged from original 29-col layout; cols AD..AH added = Product Type, Disposal Number, Comments, Report ID, Bulk Seq ("1/3"). The FIRST bulk row of a report carries the report-level fields (joined product batches, Made, People, ancillary waste, blended %); subsequent bulk rows leave those blank so column sums don't double-count. `fetchProductionReports()` now filters rows where Made (col 11) is populated → one record per report (keeps performance-page wastage correct; Made@11 / Blended@28 indexes preserved).
- **Target sheet:** `PRODUCTION_REPORTS_SHEET_ID` = `1WliT7s1RWt6wfaC1Wg4d9AaubhA6zFvTWOeKN3OoRzc` (shared with service account as Editor). Tab `Reports`, now 34 columns.
- Original single-row write tested 2026-07-03. **2026-07-20 rework: form render/hydration + repeatable groups verified live; wastage math + one-row-per-bulk mapping verified via offline unit test. Live sheet-append NOT yet re-tested end-to-end (first real submission will also relabel/extend the header row — safe/non-destructive).**
- **Pending:** Slack integration (later); consider admin auth vs shared pw. (Multi-row append verified live 2026-07-20; blended-wastage switched to quantity-weighted 2026-07-20.)

## 6e. Production Readiness — MRP-lite (deployed 2026-07-20)

Flags any WNP work order in the next 10 days whose components won't be available in
time, so production is never halted. Design spec: `docs/superpowers/specs/2026-07-20-production-readiness-mrp.md`.

- **Route `/planning/readiness`** ("Production Readiness", Production sidebar group) + red/amber banner and a tile on the Overview homepage.
- **`lib/readiness.ts`** — pure `computeReadiness()`. For each WNP WO (status≠complete, `productCode` starts with 3, `netQty = quantity−quantityProduced > 0`, planned date in [today, today+10d]):
  - **Date** from `deriveWoDate(plannedWeek, plannedDays)` — week-commencing + first weekday named (earliest wins for fuzzy "Thu - Fri"); falls back to week-commencing.
  - **Requirements:** bulk caps = `netQty × fill` (row→SKU fallback for fill & bulkCode); ancillaries = explode `netQty` through Ancillary BOM, filtered by the procurement subset (jar/lid/label/box/pouch; scoops/shippers/unmatched skipped).
  - **Supply:** on-hand at **WNP+WNC only** (`PACKING_WAREHOUSES`), plus inbound Open POs + open New Production Master rows due ≤ run date, de-duped.
  - **Bulk quantities are in THOUSANDS** across the DB (stock AND POs): `bulkCaps(v)` = `v < 100000 ? v*1000 : v` — small values ×1000, values already written in full (≥100k) kept as-is. Applied per stock line (`sumBulkStock`) and to inbound bulk POs. Live data has a clean gap (largest thousands ≈ 3,360; smallest actual ≈ 748,755). Added 2026-07-20 after 10000267 (stock 487 = 487,000) false-flagged short.
  - **Time-phased netting:** two running balances per component (stockOnly / withInbound); green = stock covers, amber = only inbound covers (names the PO), red = short (shortfall shown). Shortages cascade to later WOs sharing a component. WO status = worst component.
- **`components/ReadinessView.tsx`** — KPI row (total/ready/at-risk/short), RAG-sorted WO cards, expandable component trail (need/on-hand/inbound/shortfall), status filters, CSV export (client-side).
- Engine verified via offline unit test (netting, cascade, amber-inbound, ancillary explosion, warehouse filter, fill fallback); page verified live (7 WOs, 2 at-risk, 5 short on real data 2026-07-20).
- **Calibrate after first use:** the `{WNP, WNC}` packing-warehouse set drives bulk "on hand" — live data shows bulk on-hand there is near-zero (bulk arrives just before packing), so most bulk flags rely on inbound POs. If real bulk sits at a TPM/transit and isn't captured as an inbound PO/WO, it will over-flag "short". Constant is at top of `lib/readiness.ts`. Overdue (past-dated incomplete) WOs currently excluded.
- **Multi-level bulk make-readiness (added 2026-07-20):** pass optional `rmBom` to `computeReadiness` → `result.bulkMake`. For each bulk whose TOTAL window need > on-hand (WNP/WNC, thousands-normalised) + inbound, computes the caps that must be MADE, explodes that through the RM BOM ((shortfall/1000)×kg), and checks each RM against WNP/WNC stock + inbound RM POs. `makeStatus`: **makeable** (RMs available, just needs a bulk WO) vs **blocked** (an RM is also short → procurement). Detects existing open bulk WOs (`production` rows for the 1-code, any date). Rendered as a "Bulk make-readiness" section on `/planning/readiness` (dormant when no bulk is short — currently the case on live data after the thousands fix). Lead-time backward-scheduling not modelled in v1 (no per-bulk TPM lead-time data).
- **Phase 2 (later):** daily Resend email digest of red/amber WOs (flight-engine cron pattern).
- **Perf note:** page + Overview banner each fetch ~6 Sheets ranges with `revalidate=0`; heavy reloading can trip the Sheets per-minute read quota (banner degrades gracefully to hidden).

## 6f. Procurement Actions — order action list (deployed 2026-07-20)

First of 3 MRP features chosen after reviewing the mybizna/mrp module (which turned out to be a bare PHP/Laravel skeleton — only a feature-list README, no logic). Queue: (1) **Procurement Actions ← this**, (2) bulk make-readiness / multi-level, (3) expiry (BBD) & reorder-point alerts. Note for #3: Current Inventory has NO BBD column — expiry needs an alternative source (planning BBD / report-form bulk BBD).

- **Route `/procurement/actions`** ("Procurement Actions", Formulation sidebar group) + "Order action list →" button on the Procurement Planner page. Same default cycle as the planner (+8w/+16w, `?start`/`?end`).
- **`lib/procurement-actions.ts`** — pure `buildOrderActions(plan, bulkPOs, production)`. Flattens `computePlan()` output into purchasable lines: bulk (`capsulesToOrder`/1000 → "×1,000 caps"), RM (`orderQty` kg +8%), ancillary (`orderQty` units +buffer). Excludes FG `unitsToProduce` (that's an internal WO, not a purchase). Supplier inferred per part from the most-recent-dated PO/production `vendorName`; unknown → grouped "Supplier not on file". Grouped by supplier, CSV export = the draft PO.
- **`components/ProcurementActionsView.tsx`** — KPI row, type filter (bulk/RM/anc), supplier-grouped tables, CSV.
- **Pending (feature #1 part 2):** raised/received status tracker needs a persistence store (mirror `appendProductionReport` with a new tab) — deferred; v1 is read-only + CSV.
- **Known:** heavy pages (this + Overview banner + Readiness) each read ~6-8 Sheets ranges with `revalidate=0`; rapid navigation trips the Sheets per-minute read quota → error boundary "Try again" (Overview banner degrades to hidden). Consider short-TTL caching if it bites in production.

## 6c. Production Performance section (deployed 2026-07-03)

Analytics of the production room from a shared production-tracking sheet.

- **Route `/planning/performance`** — "Production Performance" in sidebar (Production group).
- **Data:** Production INPUT sheet `1NnS9fg1mFxnWljbjUUXG9701mUPbvrVyiZ2Lbo2Hplw` tab `INPUT` (hardcoded ID, shared with service account read-only). One row per employee×machine×shift×day: Date, Week, Employee, Shift, Machine, Planned Qty, Actual Qty, Present, Efficiency, Product, Capsule Size, Speed, Description, Comments. `fetchProductionInput()`. Plus `fetchProductionReports()` reads back the Reports tab for wastage.
- **Metrics:** Efficiency = Actual÷Planned (Planned = supervisor's flexible daily target); roll-ups weighted (Σactual÷Σplanned). Yield = 100 − blended wastage% (from reports). RAG: green ≥90, amber 75-90, red <75.
- **`lib/performance.ts`** — pure `computePerformance()`: KPIs, groupBy machine/employee/shift/product (weighted eff + RAG + below-target), daily/weekly trend (weekly if span >45d), wastage summary. Unit-testable.
- **`components/PerformanceView.tsx`** — client: KPI row, Recharts ComposedChart (output bars + efficiency line), 4 expandable breakdown tables (drill to tasks + Comments), wastage panel (graceful empty state), CSV export per table.
- **Filters:** date range + This Week/This Month + Machine/Employee/Shift selects (server-side via searchParams).
- Verified live on real data: ~915 rows, output 1.09M, weighted eff 98%.

## 6d. Platform polish (overnight 2026-07-03)

- `app/error.tsx` — friendly retry screen replaces raw "Application error" (Sheets hiccups are transient; retry usually fixes).
- `loading.tsx` skeletons (via `components/PageSkeleton.tsx`) on all 10 data routes.
- Overview homepage now shows: Production Room last-7-days snapshot (output, RAG efficiency, tasks) + Planning Tools quick-link grid (Procurement, Performance, BOM, Report form).
- By Employee table on /planning/performance gained Days Worked column.

## 7. Environment / deploy

- `.env.local` (gitignored): `GOOGLE_SERVICE_ACCOUNT_JSON` (stringified JSON), `SHEET_ID`, `GROQ_API_KEY`, `PRODUCTION_REPORTS_SHEET_ID`, `PRODUCTION_REPORT_PASSWORD`. All must also be set in Vercel (the two PRODUCTION_* vars added 2026-07-03 — needed for the report form to write on the live site).
- Deploy = `git push` to main → Vercel auto-builds. Env var changes require a redeploy to take effect.
- tsconfig target predates ES2015 iteration: use `Array.from(map.values())`, not `for..of map.values()`.
- Node script debugging pattern: `node --env-file=.env.local -e "..."` (dotenv not installed).
- If localhost looks unstyled/black-and-white: stale dev server holding port 3000 (new one silently takes 3001) — kill both, `rm -rf .next`, restart.

## 8. Known issues / pending

- ~~Rotate the exposed GitHub personal access token~~ — DONE 2026-07-03 (leaked tokens deleted by user).
- Verify BOM fix live: product 30000619 (Collagen 500 Plus Jar) should now show jars/labels/boxes, not just lids (fixed via UNFORMATTED_VALUE + range EZ800).
- Procurement unit assumptions above (§6) need user confirmation against manual plan.
- Buffers/targets are constants in `lib/procurement.ts` — could become UI-configurable.
- User said "we will have to do tweaks before deployment" re procurement — it IS deployed now at user's request, but expect tuning after he compares with his manual planning.

## 9. Style conventions

- Brand palette (tailwind.config.ts): charcoal #393836, copper #c9612e, cream #f7f3ee, cream-dark #ede6db, text-muted #8a8480, border #e4ddd4. Serif = Playfair Display for headings.
- Cards: `bg-white rounded-2xl border border-[#e4ddd4]`; KPI grids above tables; status badges as rounded-full pills.
- Tables: `thead bg-cream`, uppercase tracking-widest tiny headers; greyed (opacity-50) rows for no-action items.
- Mobile: card layout `md:hidden`, table `hidden md:block` (pattern used on production page).
