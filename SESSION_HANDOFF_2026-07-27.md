# SESSION HANDOFF — Wild Nutrition SKU Dashboard — 2026-07-27

> Session record for **2026-07-27**. Exhaustive handoff for everything done this
> session. This is the **latest** handoff — supersedes `SESSION_HANDOFF.md`
> (2026-07-21) and `WILDDASHHANDOFF.md` (2026-07-24) as the current pointer;
> both remain valid history. Pair with **`CONTEXT.md`** (evergreen reference).
> **If picking this up cold, read §8 first.**
>
> Live app: **https://skudashboard.vercel.app** · Repo: `github.com/Utkarshraw123/SKUDASHBOARD`
> (branch `main`, Vercel auto-deploys on push). Everything below is **deployed to production**.
>
> Session commit range: **`00b1246..7235809`** (HEAD `7235809`). `npx tsc --noEmit`
> and `npx next build` are both clean at HEAD.

---

## 0. TL;DR — what shipped this session

| # | Work | Key commits |
|---|---|---|
| A | **Consolidate Internal Production** — Performance + Yield + Readiness + Schedule into ONE tab with a sub-tab bar | `57aa0a0`, `56538b5` |
| B | **Reports register** — new 5th sub-tab: raw table of every submitted production report | `4e93e99` |
| C | **Planning schedule column trim** — hide Batch, BBD, Date Completed, Qty Produced; widen Description | `f08d56d`, `76cdf61` |
| D | **Edit a production report + required BBD validation** (client + server) | `43d8e2b`, `eb90207` |
| E | **Sales Variance fix** — sheet columns had shifted +2; realigned `fetchSkus` (also fixed Inventory/Cover/Overview silently) | `19e707e` |
| F | **Total external stock = BCA + EXG** (two external warehouse columns summed) | `1bbdef4` |
| G | **MRP Procurement Planner on WoW weekly forecast** — the big one | `7efff9d`, `7235809` |

**There is still no SQL database** — see §3. The "database" is Google Sheets (§4).

---

## 1. Acceptance checklist — asked vs delivered

Status key: ✅ done · ◑ partial · ✗ not done.

### A — Consolidate the internal-production tabs into one
Spec: `docs/superpowers/specs/2026-07-24-internal-production-consolidation-design.md`

- ✅ **One "Internal Production" tab** with four sub-tabs: **Schedule · Performance · Yield · Readiness**. Implemented as a nested layout + client sub-tab bar (Approach A — routes unchanged, lowest risk). — `app/planning/layout.tsx`, `components/InternalProductionTabs.tsx`
- ✅ **Removed the 3 redundant sidebar links** (Production Performance / Internal Production Yield / Production Readiness); one "Internal Production" entry remains and highlights across all `/planning/*` sub-tabs. — `components/Sidebar.tsx`
- ✅ **Report form kept clean** — the sub-tab bar hides on `/planning/report` (exact-match guard). — `components/InternalProductionTabs.tsx`
- ✅ **Deleted duplicated code** — the DD/MM/YYYY date parser was copy-pasted in 3 page files; extracted to one `lib/dates.ts` (`parseDateDMY`), used by planning / performance / production pages.
- Each of the four sub-routes keeps its own `revalidate` and filters — no data logic changed.

### B — Reports register (5th sub-tab)
Spec: `docs/superpowers/specs/2026-07-24-internal-production-reports-register-design.md`

- ✅ **New `/planning/reports` sub-tab "Reports"** — a flat, searchable, CSV-exportable table, **one row per submitted report**, all fields (date, WO, SKU, description, product type, WO status, made, people, bulk code(s), product batch/BBD, capsules/ancillary wasted, blended waste %, disposal #, comments, report ID). — `app/planning/reports/page.tsx`, `components/ProductionRecordsView.tsx`
- ✅ **Reuses the existing engine** — `computeInternalYield(rows).reports` (no new Sheets read, no duplicated computation). Distinct from Yield (the analytics dashboard over the same data).
- ✅ **Appended as the 5th tab**; the form guard changed to exact `=== "/planning/report"` so `/planning/reports` isn't mistaken for the form.

### C — Planning schedule column trim
- ✅ Removed **Batch, BBD, Date Completed** columns; widened Description (max-w 200→420px). — `app/planning/page.tsx`
- ✅ Removed **Qty Produced** column too (follow-up request). — `app/planning/page.tsx`
- Note: those columns also dropped from the CSV export (export mirrors the visible table). The **Batch filter dropdown** above the table is untouched (it's a filter, not a column).

### D — Edit a production report + BBD validation
Spec: `docs/superpowers/specs/2026-07-24-production-report-edit-bbd-validation-design.md`

- ✅ **Edit link per row** in the Reports register → `/planning/report?edit=<reportId>`. — `components/ProductionRecordsView.tsx`
- ✅ **Form pre-fills in edit mode** from `computeInternalYield(rows).reports` (banner "Editing report …", WO locked, "Save Changes"). — `app/planning/report/page.tsx`, `components/ProductionReportForm.tsx`
- ✅ **Update-in-place writer** — `updateProductionReport(reportId, headers, rows)` **appends the new version first, then deletes the old rows** for that Report ID (append-first = never lose data; delete-by-captured-index = unambiguous). Keeps original Report ID + timestamp. — `lib/sheets.ts` (`updateProductionReport`), `app/api/production-report/route.ts`
- ✅ **`reportToRows` gained `opts?: {reportId, timestamp}`** to reuse identity on edit. — `lib/production-report.ts`
- ✅ **BBD validation = required + valid DD/MM/YYYY** on every active batch/bulk row, enforced **client-side** (red "BBD required" / border, submit blocked) **and server-side** (400). New `isRequiredDMY`. — `lib/production-report.ts`, `components/ProductionReportForm.tsx`, `app/api/production-report/route.ts`
- ✅ **API returns `reportId`** on create (used to reference the created report).
- ✅ Verified live via a throwaway `ZZ-EDIT-TEST` report: after edit → exactly one block, same Report ID, no duplicate/leftover rows; blank BBD rejected 400; ZZ rows cleaned up (5 real reports untouched).
- ◑ **Editing cannot reassign a report to a different Work Order** — the WO is locked in edit mode (its Report ID encodes the original WO). By design; a follow-up if ever needed.

### E — Sales Variance "not working" (bug)
- ✅ **Root cause:** two columns (`Extenal Stock EXG` col L, `Stock in Transit to WNP (WNT)` col M) were inserted into the ALL SKU DASHBOARD tab, shifting **every field from `Fill` onward +2**. `fetchSkus` read old positions, so `salesVariance` read the Monthly-Demand column (no `%`), `cleanPct` returned `null` for all → the page rendered empty (both tables hidden). — `lib/sheets.ts` `fetchSkus`
- ✅ **Fix:** realigned every index from `Fill` onward by +2 to the current layout, and widened the read range `A1:AX200 → A1:BA200` (16-week demand now lands at col AY, past the old cut-off). Verified live: Outperforming (8) + Underperforming (79) now render with aligned Avg Demand / Last Qtr / Variance.
- ✅ **Side benefit:** the same shift had silently corrupted Fill / demand / potential-units / packing fields across **Inventory, Cover Risk, Overview** too — all corrected by this one fix.

### F — Total external stock
- ✅ **`externalStock` now sums BCA (col K) + EXG (col L)** via a new `sumNums` helper (blanks→0; null only when both blank so a truly-empty figure still shows "—"). Verified live: Lions Mane Jar 2,000 (0+2,000); Lions Mane Refill 9,255 (3,059+6,196). — `lib/sheets.ts`
- ✗ **"Stock in Transit to WNP (WNT)" (col M) is still NOT captured** in `SkuRow`. Not requested yet; a follow-up if in-transit stock should surface or feed cover.

### G — MRP Procurement Planner on the WoW weekly forecast
Spec: `docs/superpowers/specs/2026-07-27-mrp-wow-demand-procurement-design.md`

- ✅ **New data source** — `fetchWowDemand()` reads the **"WoW Demand"** tab of a **separate spreadsheet** (id `19uHzvIjKYpZPh1YO8HLhjX_YNDNNDhiedOCjYPbFBE8`). Parses row 2 week headers (cols C→EH, 30/09/2024→03/05/2027, ~136 weeks) and the **last contiguous run of 3-code rows** (the lower "baseline" block, ~rows 172–347; col C is a "1" flag, ignored; demand aligns directly to date headers). Returns `{ weeks, demandBySku, nameBySku }`. — `lib/sheets.ts`
- ✅ **Demand & cover now come from the weekly forecast**, not the flat 12-week average. Per SKU for a cycle `[start,end]`: opening stock at cycle start = current stock + open POs before start − forecast sales(today→start); cycle demand = Σ forecast in cycle; target = Σ next N weeks after end; **units to produce = max(0, target + cycleDemand − opening − POs-in-cycle)**. — `lib/procurement.ts` `computePlan`
- ✅ **Current stock = ALL SKU DASHBOARD "Current Inventory"** (`sku.inventory`, confirmed = sum of warehouses), replacing the old Current-Inventory-tab warehouse sum.
- ✅ **Manual FG plans ignored** — FG built from scratch, supply = current stock + open POs only. Committed-consumption netting removed from bulk & ancillary sections.
- ✅ **Cover targets: global (16) / collagen+magnesium (20) / per-SKU override**, all URL-driven (`cover`, `coverCM`, `cov=sku:wks,…`) with an inline **editable target per FG row + Recalculate button**. Resolution: per-SKU > collagen/mag > global. — `components/ProcurementView.tsx`, `app/procurement/page.tsx`
- ✅ **Cascade** FG → bulk → RM → ancillaries unchanged mechanics (net vs stock + open POs; RM +8%, ancillary buffers). — `lib/procurement.ts`
- ✅ **Headline MRP output** — "Make (production plan)" + "Order (purchasing, by supplier)" instruction lists up front; four expandable cascade tables below; **every table CSV-downloadable**. — `components/ProcurementView.tsx`
- ✅ **Guards** — out-of-range-cycle banner; forward-cover-past-grid flag; **"Forecast-only SKUs" table** for the **52 WoW SKUs not in the dashboard** (demand shown, can't part-plan).
- ✅ **`/procurement/actions`** page updated to the new signature (still works). — `app/procurement/actions/page.tsx`
- ✅ Verified live (cycle 02/11/2026→04/01/2027): Vitamin D Jar current stock 16,421, cycle demand **7,141**, units to produce **11,816** — exact match to an independent raw-sheet calc; cover/per-SKU overrides + Recalculate confirmed; verified on production too.
- ✗ **WNT in-transit column** not included in supply (same as §F).
- ✗ **No per-SKU target persistence** — overrides live only in the URL (shareable/bookmarkable), not saved to a sheet.

---

## 2. Decisions made that were NOT explicitly specified

**A/B (consolidation & reports)**
- Chose **Approach A** (nested layout + sub-tab bar, routes unchanged) over a single merged route — lowest regression risk; each view keeps its own caching/filters.
- Sub-tab order fixed as **Schedule · Performance · Yield · Readiness · Reports**.
- Reports register is a **raw per-report table** (grain = one row per report, the primary/summary row), deliberately NOT another analytics view (Yield already is). Named **"Reports"** (matches the sheet tab + the form).
- Sidebar "Internal Production" highlight uses a scoped prefix match (`href === "/planning" && pathname.startsWith("/planning/")`) so only that entry lights up on sub-tabs; other nav items keep exact-match.

**D (edit + BBD)**
- **Edit reuses the existing form** (pre-filled) rather than a separate editor.
- **Update = append-new-then-delete-old** (durability over in-place overwrite), keyed by Report ID (col AG). Keeps original Report ID + timestamp.
- **BBD rule = required + valid DD/MM/YYYY** (kept the existing calendar-validity rule; added "no blanks"). No future-only / range checks (user picked only "required"). "Active row" = a batch/bulk row with any content (mirrors the server filter) so empty placeholder rows don't block submit.
- WO **locked** in edit mode (avoid accidental clearing / re-keying identity).

**E/F (SKU sheet)**
- On the column shift, **realigned all downstream fields** (not just `salesVariance`) because every field from `Fill` onward was wrong — correctness over minimal patch.
- `externalStock` = **BCA + EXG** (confirmed with user); left **WNT** out of the model pending a decision.
- Read range widened to **`A1:BA200`** (headroom past the last used column AZ/51).

**G (MRP)**
- **WoW block detection = the LAST contiguous run of 3-code rows** (survives row shifts; the upper block is an older duplicate — verified identical to the lower block from col K onward).
- **Column C in the WoW lower block is a "1" flag** (ignored); demand indexed purely by the row-2 date headers (verified via a SKU present in both blocks).
- **Cover = forward sum of the next N weeks' forecast** after the cycle end (capped at the last forecast week, flagged when short). "Weeks of cover" walks the weekly forecast (fractional final week).
- **Current stock source = ALL SKU DASHBOARD** `Current Inventory` (`sku.inventory`), per user, not the Current-Inventory tab warehouse sum.
- **All planner state in the URL** (`start,end,cover,coverCM,cov`) — no persistence layer; shareable. One client component (`ProcurementView`) owns all controls so a single Recalculate applies dates + covers + per-SKU together.
- **Consolidated controls into `ProcurementView`** and removed the old `CyclePicker`/`PlannerControls` split.
- **Local `YYYY-MM-DD` formatting** (`ymdLocal` in sheets.ts, and inline in the pages) instead of `toISOString().slice(0,10)` to avoid a UTC off-by-one on week/date labels.
- Default cycle = **first day of next month → last day of month+2** (a bimonthly window).
- **52 forecast-only SKUs surfaced in their own table**, not silently dropped and not auto-added to the dashboard.

**Process**
- Every feature: brainstorm → spec (committed to `docs/superpowers/specs/`) → implement → browser-verify → `tsc` + `next build` → push (Vercel auto-deploys). Pure engines were offline-unit-tested via the transpile-and-run pattern.

---

## 3. Deviation from stack assumptions (the REAL stack)

The generic template assumed Next.js / Turso / Shopify / a SQL DB. Reality (unchanged, re-confirmed):

- **Framework:** Next.js **14.2.5** (App Router, TypeScript, Tailwind), React 18. ✅
- **Database: there is NO SQL database.** No Turso, Postgres, Prisma/Drizzle, ORM. The "database" is **Google Sheets**, read/written via `googleapis` with a **service account** (`GOOGLE_SERVICE_ACCOUNT_JSON`). Data shapes = TypeScript interfaces in `lib/types.ts` + fetchers/parsers in `lib/sheets.ts`. See §4.
- **Shopify:** not in this project. No webhooks/test store.
- **Auth:** no user auth. `/planning/report` (and Goods In) gated by a shared password (`12345` default). A "Market View" cookie modal filters SKUs (not auth).
- **Hosting/CI:** **Vercel**, auto-deploy on push to `main`. No PR flow.
- **LLM:** the "Ask about your data" chatbot uses **Groq** (`llama-3.3-70b-versatile`).
- **Runtime deps of note:** `googleapis`, `recharts`, `docx`, `@vercel/blob`. **No new dependencies added this session.**
- **NEW external data source this session:** the **"New - Week on Week Cover - March 2025"** spreadsheet (id `19uHzvIjKYpZPh1YO8HLhjX_YNDNNDhiedOCjYPbFBE8`), tab **"WoW Demand"** — the weekly forecast that drives the MRP. Shared with the service account (Viewer). Sheet ID is a **hardcoded const** (`WOW_SHEET_ID`) in `lib/sheets.ts`, not an env var.
- **Caching:** sheet reads go through `unstable_cache` (tag `"sheets"`); pages use `revalidate`. Report writes call `revalidateTag("sheets")`.

---

## 4. Current "DB schema" as it exists right now (Google Sheets)

No SQL tables. Data shapes are the TS interfaces in `lib/types.ts` + `lib/sheets.ts`. **Important discovery this session: `SHEET_ID` and the hardcoded `STOCK_SHEET_ID` are the SAME spreadsheet** ("New - Current Stock Levels", id `1zMaD2kNKedl3G4UWZrEfqJHIknT6m-Nfr0JrpBYf3v0`).

### 4a. Source spreadsheets (READ)

| Spreadsheet (env / const) | ID | Tab → range → fetcher (`lib/sheets.ts`) |
|---|---|---|
| **Main / Stock** (`SHEET_ID` env == `STOCK_SHEET_ID` const) | `1zMaD2kNKedl3G4UWZrEfqJHIknT6m-Nfr0JrpBYf3v0` | `ALL SKU DASHBOARD!A1:BA200` → `fetchSkus` (**range widened this session**, was `AX200`); `New Production Master!A1:W430` → `fetchProduction`; `WNP PLANNING!A1:V1048` → `fetchWNPPlanning`; `Open Purchase Orders!A1:L240` → `fetchBulkOpenPOs`; `Packing Schedule!A1:H470` → `fetchPackingSchedule`; `Current Inventory!A1:F5000` → `fetchCurrentInventory` |
| **BOM** (`BOM_SHEET_ID` const) | `19WdMemJgSpZyMEHfM6zKwEoEJfuKB5yxc4idIWPKn6w` | `BOM matrix RM!A1:BZ800` → `fetchRmBom`; `BOM Ancillaries!A1:EZ800` → `fetchAncillaryBom` (UNFORMATTED) |
| **Production INPUT** (`PRODUCTION_INPUT_SHEET_ID` const) | `1NnS9fg1mFxnWljbjUUXG9701mUPbvrVyiZ2Lbo2Hplw` | `INPUT!A1:N1200` → `fetchProductionInput` |
| **WoW forecast** (`WOW_SHEET_ID` const — NEW) | `19uHzvIjKYpZPh1YO8HLhjX_YNDNNDhiedOCjYPbFBE8` | `WoW Demand!A2:EH400` → `fetchWowDemand` |

**ALL SKU DASHBOARD current layout (post-shift, 0-based col index → `SkuRow` field):**
`0` rowNum · `1` bulk · `2` skuCode · `3` description · `4` type · `5` cover · `6` potentialBulkToUnits · `7` **inventory (= current stock, sum of warehouses)** · `8` wnpStock · `9` coverAtWNP · `10` External BCA + `11` External EXG → **`externalStock` (summed)** · `12` Stock in Transit WNT (**not captured**) · `13` fill · `15` monthlyDemandAvg · `16` monthlyDemandLastQtr · `17` **salesVariance (%)** · `19` potentialFGWNC · `20` bulkAtWNC · `21` totalPotentialUnits · `22` totalWeeksCover · `23` weeksOver · `25` potentialUnitsOther · `26` weeksOverOther · `27` bulkAtOther · `29` nextBulkDelivery · `30` bulkDeliveryQty · `31` bulkPotentialUnits · `32` bulkETA · `33` bulkPlannedQty · `34` packerVendor · `35` totalPlannedTs · `37` nextPackingDelivery · `38` packingDeliveryQty · `39` packingETA · `40` packingSplitSKUs · `41` packingVendor · `42` totalPackingPlanned · `44` unitsToBePlanned · `45` unitsNotPlanned · `46` projectedCover · `48` demand12Week · `49` demand3Month · `50` demand16WeekCover. (Data rows start at index 2 / sheet row 3.)

**WoW Demand tab (`WOW_SHEET_ID`):** row 2 = `A`"New Codes", `B`"Product", **`C`→`EH` week-commencing dates** (30/09/2024 → 03/05/2027, ~136 weekly cols; cols after EH are summaries, ignored). SKU forecast = the **last contiguous run of `/^3\d{7}/` rows** (~rows 172–347, 176 codes); each week-column holds that SKU's forecast units; **col C is a constant "1" flag (ignored)**. `fetchWowDemand` returns `{ weeks: {iso,date}[], demandBySku: Map<sku, number[]>, nameBySku: Map<sku,string> }`.

### 4b. Write target (`PRODUCTION_REPORTS_SHEET_ID` env = `1WliT7s1RWt6wfaC1Wg4d9AaubhA6zFvTWOeKN3OoRzc`, "WNP Production Reports")

**Tab `Reports` — 34 cols A–AH, ONE ROW PER BULK** (`lib/production-report.ts` `REPORT_HEADERS`; read by `fetchProductionReports` A2:AC and `fetchProductionReportRows` A2:AH). Unchanged schema this session; new **edit** path writes to it via `updateProductionReport` (append-new-then-delete-old by Report ID col **AG**, index 32). Timestamp col **A**.
```
A Timestamp · B Work Order · C SKU · D Description · E Product Batch · F Product BBD ·
G Bulk Code · H Bulk Description · I Bulk Batch · J Bulk BBD · K Used · L Made ·
M People · N WO Status · O Waste Capsules · P–U Waste Jars/Lids/Labels/Box/Pouches/Desiccants ·
V Capsule Waste % · W–AB per-part Waste % · AC Blended Waste % ·
AD Product Type · AE Disposal Number · AF Comments · AG Report ID · AH Bulk Seq ("1/3")
```

**Tab `Goods In` — 18 cols A–R** (unchanged this session; see `WILDDASHHANDOFF.md` §4b).

### 4c. Relations (logical, in code — no FKs)
- WoW SKU (`New Codes`) ↔ SKU `skuCode` (**124 of 176 match**; 52 WoW-only → forecast-only table).
- Planning/SKU/Inventory/BOM relations per `WILDDASHHANDOFF.md` §4c.
- Reports grouped by Report ID (col AG). Report ↔ edit form by `?edit=<reportId>`.
- Procurement: FG (WoW demand + SKU stock/fill) → bulk (`sku.bulk` ↔ RM BOM `product.code`) → RM/ancillary components; open POs matched by part number across Open Purchase Orders + New Production Master.

---

## 5. Environment variables in use (no secret values)

All in `.env.local` (gitignored) AND must be set in Vercel.

| Var | Set? | Description |
|---|---|---|
| `SHEET_ID` | ✅ | Main Google Sheet id ("New - Current Stock Levels"; SKUs, planning, POs, packing, production master, Current Inventory). **Same file as the hardcoded `STOCK_SHEET_ID`.** |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | ✅ | Stringified service-account creds, scope `spreadsheets` (read+write). Email `utkarsh-rawat@wild-dashboard.iam.gserviceaccount.com`. **Must also have ≥ Viewer on the WoW sheet.** |
| `PRODUCTION_REPORTS_SHEET_ID` | ✅ | Writable sheet holding `Reports` + `Goods In` tabs (`1WliT7s1RWt6wfaC1Wg4d9AaubhA6zFvTWOeKN3OoRzc`). |
| `PRODUCTION_REPORT_PASSWORD` | ✅ | Shared password gating `/planning/report` (create + edit) and Goods In. Default `12345` if unset. |
| `GROQ_API_KEY` | ✅ | Groq LLM key for the chatbot (`/api/chat`). |
| `GOODS_IN_PASSWORD` | ❌ (optional) | Dedicated Goods In password; falls back to `PRODUCTION_REPORT_PASSWORD` then `12345`. |
| `BLOB_READ_WRITE_TOKEN` | ❌ (**needed for Goods In uploads**) | Vercel Blob token for CofA/document uploads. Still not provisioned (see `WILDDASHHANDOFF.md` §6.1). |
| `VERCEL_OIDC_TOKEN` | ✅ (auto) | Injected by Vercel tooling locally; not app code — ignore. |

**Hardcoded consts in `lib/sheets.ts` (NOT env):** `STOCK_SHEET_ID` (= `SHEET_ID`'s value), `BOM_SHEET_ID`, `PRODUCTION_INPUT_SHEET_ID`, **`WOW_SHEET_ID` (new)**. No new env vars introduced this session.

---

## 6. Left broken / stubbed / partial — and exactly what's needed

1. **52 forecast-only SKUs (MRP)** — WoW has demand for 52 SKUs not in ALL SKU DASHBOARD (EU/US/discontinued variants). They appear in the planner's **"Forecast-only SKUs" table** with cycle demand but **cannot be part-planned** (no stock/fill/BOM). *To finish:* add those SKUs to the ALL SKU DASHBOARD tab (with bulk/fill), and they'll flow into the full plan automatically.
2. **"Stock in Transit to WNP (WNT)" column not captured** — col M (index 12) of ALL SKU DASHBOARD is ignored by `SkuRow`. *To finish:* add a `transitStock` field in `fetchSkus` and decide whether it counts toward external/available stock or MRP supply.
3. **MRP per-SKU targets are URL-only** — not persisted. *To finish (if wanted):* add a small overrides tab and a save action, or accept URL/bookmark as the store.
4. **MRP forward cover past the forecast grid** — for late cycles a 20-week target can run past the last forecast week (03/05/2027); the plan **caps at the last week and flags it** (amber banner + per-row note). Not a bug, but cover is understated in that edge. *To finish (if wanted):* extend the WoW forecast or fall back to an average tail beyond the grid.
5. **Report edit cannot change the Work Order** (WO locked in edit mode). By design.
6. **Goods In file uploads** still need Vercel Blob (`BLOB_READ_WRITE_TOKEN`) — carried over, see `WILDDASHHANDOFF.md` §6.1.
7. **Production Report date validation** now enforced server-side for BBD (fixed this session); other fields are still client-trusted (form is the only writer).
8. **Dev-server gotcha (not a prod issue):** rapid file edits can leave Next dev in a stuck **Fast Refresh** state where a page's client component stops hydrating (looks interactive-dead, no console error). Fix = restart the dev server. Hit this on `/procurement` mid-session; production was always fine.

**Carried over (still open):** Procurement Actions raised/received tracker (needs a persistence tab); Expiry/BBD alerts; bulk make-readiness lead-time scheduling — see `WILDDASHHANDOFF.md` §6.

---

## 7. Test data, credentials, manual steps

- **Passwords:** `/planning/report` (create + edit) and Goods In → `12345` (unless `*_PASSWORD` envs set).
- **Market-mode modal:** first visit shows "Select Market View". For headless/browser testing set cookies `marketMode=dtc; marketsConfigured=1` to skip it. (Procurement pages do NOT market-filter — they use all SKUs.)
- **Live Reports tab has the user's 5 real reports** — **never write tests against them.** This session used only `ZZ-EDIT-TEST-*` throwaways via the API and deleted them (0 ZZ rows remain; 5 real reports intact). Cleanup was done with a `googleapis` script using the service account (`deleteDimension` by Report ID).
- **Offline verification pattern** (no test runner): transpile a pure `lib/*.ts` with the `typescript` package's `transpileModule` and run in Node from the **project root** (so `typescript`/`googleapis` resolve). Used for `isRequiredDMY`, `reportToRows` id-reuse, and to independently recompute MRP numbers from the raw sheet.
- **Google Sheets read quota is 60 reads/min/user** — live scripts that loop reads can trip it; the app is protected by the sheet cache.
- **Vercel CLI** authenticated (account `utkarshrawatofficial-2811`, scope `utkarsh-projects12`, project `skudashboard`). Deploy = `git push origin main`; check with `npx vercel ls skudashboard` (strip ANSI: `| sed 's/\x1b\[[0-9;]*m//g'`).
- **Drive API is DISABLED** for the service account — can't enumerate accessible spreadsheets by name; you need the sheet URL/ID up front.

---

## 8. If picking this up in a NEW session — read in this order

1. **`SESSION_HANDOFF_2026-07-27.md`** (this file) — the latest, complete record.
2. **`WILDDASHHANDOFF.md`** — prior session (Goods In edit/void/filters, multi-line PO, report auto-type/date-validation).
3. **`CONTEXT.md`** (repo root) — evergreen reference.
4. **`lib/types.ts`** — the data shapes (these interfaces ARE the schema; no ORM).
5. **`lib/sheets.ts`** — all fetchers, the `cachedValues` (tag `"sheets"`) layer, and writers (`appendProductionReport`, **`updateProductionReport`**, `fetchWowDemand`, `fetchSkus` with the corrected column map). **Read this before touching data.**
6. **`lib/procurement.ts`** — the WoW-driven MRP engine (`computePlan`): weekly-forecast demand, opening stock, forward cover, cascade. Plus `lib/procurement-actions.ts` (`buildOrderActions`).
7. **`components/ProcurementView.tsx`** — the single client component owning the planner controls + all tables + Recalculate.
8. **`components/InternalProductionTabs.tsx`** + **`app/planning/layout.tsx`** — the consolidated Internal Production sub-tab bar; **`components/ProductionRecordsView.tsx`** (Reports register + Edit links); **`components/ProductionReportForm.tsx`** + **`app/planning/report/page.tsx`** (create/edit form).
9. **`lib/production-report.ts`** (`reportToRows` opts, `isRequiredDMY`) + **`lib/internal-yield.ts`** (`computeInternalYield().reports`, reused by the register and the edit pre-fill).
10. The specs under **`docs/superpowers/specs/2026-07-*`** for the full reasoning behind each feature.

**Golden rules:** data source is Google Sheets (not a DB); `SHEET_ID` == `STOCK_SHEET_ID`; ALL SKU DASHBOARD columns shifted +2 from `Fill` onward (map lives in `fetchSkus`); MRP demand/cover come from the **WoW Demand** tab (last contiguous 3-code block, col C is a flag, direct date alignment); current stock = `sku.inventory`; external stock = BCA+EXG; report edits keep the Report ID and use append-then-delete; every report write must `revalidateTag("sheets")`; BBD is required + valid DD/MM/YYYY (client + server); keep engines pure and offline-unit-test them; verify in the browser preview, then `git push` to deploy; **never test against the 5 real reports**; if a dev page goes interactive-dead, restart the dev server.
