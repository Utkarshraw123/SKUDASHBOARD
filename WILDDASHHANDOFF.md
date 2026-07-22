# WILDDASHHANDOFF.md — Wild Nutrition SKU Dashboard

> Written at the end of a working session (2026-07-21 → 2026-07-22). This is the
> durable, exhaustive record of what was done, decided, deviated, and left open.
> Pair it with **`CONTEXT.md`** (the evergreen full project reference). This file is
> session-specific and complete. **Read §8 first if you're picking this up cold.**

Live app: **https://skudashboard.vercel.app** · Repo: `github.com/Utkarshraw123/SKUDASHBOARD` (branch `main`, Vercel auto-deploys on push).

---

## 0. TL;DR — what shipped this session

Commits (newest first):

| Commit | What |
|---|---|
| `d03b709` | Goods In: exact QA13-CF01 Word form, 3-field "G-In form", per-line filed status |
| `3e88cbd` | docs: CONTEXT.md §6i (Goods In) |
| `d17e29d` | Goods In: task list from open POs, pre-filled form, Word-doc + COA upload (v1) |
| `32edad5` | Readiness: 5% shortfall tolerance + reschedule recommendation |
| `2d46771` | docs: CONTEXT.md §6h + readiness inbound note |
| `f32e18f` | Internal Production Yield section + readiness inbound fix + livelier graphics |

Five distinct pieces of work: **(1)** livelier dashboard graphics, **(2)** a readiness
inbound-calculation bug fix, **(3)** the Internal Production Yield section, **(4)** a
readiness 5% tolerance + delivery-date recommendation, **(5)** the Goods In feature.

> Two side tasks also happened this session but are **NOT in this repo**: a PowerPoint
> edit (`~/Downloads/CRM PPT (2) - with Welcome & Thank You.pptx`) and a Wild Nutrition
> hero landing-page Artifact (a separate claude.ai artifact). Ignore for dashboard work.

---

## 1. Acceptance checklist — what was asked vs. delivered

There was no formal written spec; these are the explicit asks across the session.

### 1a. "Make the graphics more live" (internal tool, no marketing polish) — ✅ DONE
- **Count-up KPI numbers** — ✅ new `components/CountUp.tsx` (easeOutExpo, respects `prefers-reduced-motion`, parses formatted strings like `92.5%`/`1,234`). Wired into `components/KpiCard.tsx` (propagates to every page) + the Overview "Production Room" snapshot in `app/page.tsx`.
- **Live status dot on KPI cards; red/critical card pulses** — ✅ `components/KpiCard.tsx`.
- **Gradient + interactive charts** — ✅ `components/InventoryChart.tsx` (gradient bars, hover-dims the rest), `components/PerformanceView.tsx` (gradient bars + glow area + animated efficiency line, active dot, richer tooltip).
- Verified live in browser (count-up rolls, gradient bars, hover-dim, pulse dot).

### 1b. Readiness inbound-calculation fix — ✅ DONE
- Ask: *"inbound should be taken only from bulk open POs"* (WO2605322 "NEW Menopause Complex 2AD" wrongly showed at-risk).
- Root cause: `inboundFor()` in `lib/readiness.ts` counted inbound from **both** the Open Purchase Orders sheet **and** the New Production Master. The Production Master includes partially-received historical orders whose un-received remainder was double-counted as phantom inbound, masking real shortages.
- Fix: **inbound now taken ONLY from the Open Purchase Orders sheet** (`lib/readiness.ts` `inboundFor`). `production` (New Production Master) is still used for bulk-make WO refs but never as inbound. Verified: WO2605322 → correctly `short` (on-hand 92,000 vs need 93,000, inbound 0) before the tolerance change below.

### 1c. Internal Production Yield section — ✅ DONE
- Ask: production reports should surface in-dashboard (not just a spreadsheet); show line items + waste; wastage by **work order / week / month / individual ancillary type**; **batch-level tracking for compliance**; **downloadable**.
- Delivered: route `/planning/yield`, sidebar "Internal Production Yield".
  - Engine `lib/internal-yield.ts` (pure): `computeInternalYield(rows)` → `reports` (full detail), `byWorkOrder`, `byWeek` (ISO week), `byMonth`, `byAncillary` (jars/lids/labels/box/pouches/desiccants), `batches` (compliance trace), `summary`.
  - Fetcher `fetchProductionReportRows()` in `lib/sheets.ts` (reads `Reports!A2:AH2000`, all 34 cols).
  - View `components/InternalYieldView.tsx`: count-up KPIs, Weekly/Monthly wastage trend chart, ancillary bar chart, by-WO table, **batch-tracking compliance table**, expandable per-run line items. **3 CSV exports** via `components/ExportCsvButton.tsx`.
  - Page `app/planning/yield/page.tsx` (`revalidate = 60`). Production form links to it (`components/ProductionReportForm.tsx`).
- "Get rid of that spreadsheet": **kept the Reports sheet as the invisible backing store** (see §2) — the dashboard is now the interface.

### 1d. Readiness 5% tolerance + reschedule recommendation — ✅ DONE
- Ask: a material short by ≤5% should read as fine; add a small recommendation from the incoming delivery date ("this bulk is due next week, if you can reschedule…").
- Delivered in `lib/readiness.ts`: `SHORT_TOLERANCE = 0.05` → effective need = `need × 0.95` in `evaluate()` and the bulk-make gate. Short/at-risk components get a `recommendation` string from the next Open-PO delivery after the WO date (`nextDeliveryFor` + `relativeWhen`). Rendered under the component row + added to the CSV in `components/ReadinessView.tsx`.
- Verified: WO2605322 (~1% short) → Ready; a >5% short line → short **with** "This bulk is due next week (DD/MM/YYYY) — if you can reschedule the run to then, it can be covered."

### 1e. Goods In feature — ✅ DONE (⚠ file uploads need provisioning — §6)
- Ask: a "Goods In" section = the day's incoming deliveries (open POs) as tasks; click a PO → form pre-filled (Part, Description, Quantity, Supplier auto); **compliance fills Supplier Product Code, Batch/Lot No., BBD**; generate an **editable Word doc = exact match of the QA13-CF01 template**; attach COA + docs; filed forms sit in the Goods In section; warehouse fills the rest by hand.
- Delivered: route `/goods-in`, sidebar "Goods In".
  - Engine `lib/goods-in.ts` (pure): `buildGoodsInTasks` (open POs → tasks, overdue/today sorted, **filed status per PO+part line**), `parseGoodsInRecords`, `recordToRow`, `GOODS_IN_HEADERS`, `summarise`.
  - Word doc `lib/goods-in-doc.ts`: `buildGoodsInDoc(record)` → `.docx` via the `docx` lib — a **faithful, complete reproduction** of QA13-CF01 (header, core fields, inbound checks, Vehicle/Product & Pallet/Certification checklists with Example + Action text, "refer to Product List" note, FINISHED GOODS ONLY QC block, Comments box, SIGN/COMPLIANCE SIGN). Only the 5 PO fields + 3 compliance fields are filled; everything else blank for the warehouse.
  - Fetch/append in `lib/sheets.ts`: `fetchGoodsInRows()` (`Goods In!A2:Q2000`), `appendGoodsInRecord()` (auto-bootstraps the tab + header).
  - API: `app/api/goods-in/route.ts` (multipart POST → upload attachments to Vercel Blob → append record), `app/api/goods-in/doc/route.ts` (JSON POST → streams the .docx).
  - UI: `components/GoodsInView.tsx` (tasks list, KPIs, filed-records table with per-row Word download), `components/GoodsInForm.tsx` (modal: auto box + 3 compliance fields + COA/doc uploads + password; Save auto-downloads the Word file and shows a success panel).
  - Page `app/goods-in/page.tsx` (`revalidate = 60`).
- Verified: page renders from real open POs; form pre-fills; `.docx` renders as a complete QA13-CF01 form (checked by rendering the file); save round-trip writes to the "Goods In" tab; per-line filed status correct.

---

## 2. Decisions made that were NOT explicitly specified

**Graphics**
- `CountUp` uses **easeOutExpo**, ~1.1s; parses a formatted string (strips commas, keeps `%`/`k`) so pre-formatted values animate too.
- Red (critical) KPI card pulses **only when value > 0**.
- **Recharts animated `<Bar>` renders EMPTY under React 18 dev StrictMode** — a real gotcha. Bars that must always render use `isAnimationActive={false}` (PerformanceView trend bars, all yield/goods-in bars). InventoryChart bars kept animation (verified they survive). If a bar chart ever shows blank in dev, set `isAnimationActive={false}`.

**Readiness inbound fix**
- Interpreted "only bulk open POs" as **the Open Purchase Orders sheet only**, applied uniformly to bulk, ancillary and RM inbound (the sheet is the canonical inbound source for all part types). Production Master fully dropped as an inbound source.

**Readiness tolerance / recommendation**
- 5% tolerance applied to **both** the stock threshold and the stock+inbound threshold (effective need = `need × 0.95`). Bulk-make gate also tolerant. **True shortfall still displayed** (only the classification is tolerant).
- `relativeWhen` buckets: `already due / tomorrow / in N days (≤6) / next week (≤13) / in N weeks (≤27) / next month (≤45) / in N months`.
- Recommendation only for `short`/`at_risk` components. `short` → reschedule to next Open-PO delivery **after the WO date**; `at_risk` → confirm the inbound PO it depends on.

**Internal Production Yield**
- Group rows by **Report ID**; legacy rows (no ID) key on `WO + timestamp`. Primary row = the one with **Made** populated.
- Blended wastage for WO/week/month = **made-weighted mean** of report blended %s. Ancillary % = **pooled** `100 × Σwaste ÷ Σ(made+waste)` (precise, not an average of %s).
- Weeks = **ISO-8601 week** (`YYYY-Www`, label `W29 · 2026`). Months = `YYYY-MM` (label `Jul 2026`).
- Batch trace = **one row per bulk line** (product batch ↔ bulk batch ↔ BBD ↔ disposal #).
- Route `/planning/yield`; icon `❋`; `revalidate = 60`.

**Goods In**
- **Kept the Reports/Goods-In sheets as the durable backing store** despite "get rid of that spreadsheet" — Google Sheets is the app's ONLY persistence; deleting the write would lose data on stateless Vercel. The dashboard is the interface; the user never opens the sheet. (Documented + surfaced to user; not silently overridden.)
- **Filed status is per PO line = `PO + part`** (a multi-line PO's other parts stay awaiting after one is filed).
- Word doc uses **fixed DXA column widths + `TableLayoutType.FIXED`** — percentage widths collapse to 1-char-per-line in Word/LibreOffice/Quick Look. A4 page (11906 twips), 620-twip margins, content width `CW = 10666`.
- On-screen form deliberately trimmed to the **3 compliance fields** (+ attachments). Date/Time/Haulier/CofA-tick/checklists live only on the Word doc (blank, for the warehouse). Record schema still has those columns (blank).
- Button "G-In form" (was "Book in"); status "Filed" (was "Booked in"). Save **auto-downloads** the Word file + success panel (fixes "didn't know where to find it").
- Library: **`docx`** for runtime generation; **`@vercel/blob`** for uploads (user chose Vercel Blob over Google Drive). Doc filename `GoodsIn-<po>-<part>.docx`.
- Persistence: a new **"Goods In" tab** in `PRODUCTION_REPORTS_SHEET_ID` (auto-bootstrapped, 17 cols). Password gate: `GOODS_IN_PASSWORD ?? PRODUCTION_REPORT_PASSWORD ?? "12345"`.
- Uploads **degrade gracefully**: without `BLOB_READ_WRITE_TOKEN`, files are skipped with a warning and the record still saves.

---

## 3. Deviation from stack assumptions (the REAL stack)

The generic handoff template assumed Next.js / Turso / Shopify webhooks / a SQL DB. Reality:

- **Framework:** Next.js **14.2.5** (App Router, TypeScript, Tailwind), React 18. ✅ (Next part matched)
- **Database:** **There is NO SQL database. No Turso, no Postgres, no Prisma/Drizzle/ORM.** The "database" is **Google Sheets**, read/written via the `googleapis` package with a **service account** (`GOOGLE_SERVICE_ACCOUNT_JSON`). Data shapes are TypeScript interfaces in `lib/types.ts` + the fetcher/parser functions in `lib/sheets.ts`. See §4.
- **Shopify:** **Not in this project.** No webhooks, no test store, nothing Shopify. (That's the separate *practitioner-portal* repo.)
- **Auth:** No user auth. `/planning/report` and `/goods-in` are gated by a **shared password** (`PRODUCTION_REPORT_PASSWORD`, default `12345`). Everything else is open. A "Market View" cookie modal (`marketMode`, `marketsConfigured`) filters SKUs but isn't auth.
- **Hosting/CI:** **Vercel**, auto-deploy on push to `main`.
- **LLM:** the "Ask about your data" chatbot (`app/api/chat`) uses **Groq** (`llama-3.3-70b-versatile`), env `GROQ_API_KEY`.
- **Runtime deps added this session:** `docx` (Word generation), `@vercel/blob` (file uploads). Existing key dep: `googleapis`, `recharts`.

---

## 4. Current "DB schema" as it actually exists (Google Sheets)

No SQL tables. Data lives in **Google Sheets tabs**. The app READS from four spreadsheets and WRITES to one spreadsheet (two tabs).

### 4a. Source spreadsheets & tabs (READ-only)

| Spreadsheet (env / const) | ID | Tab → range → fetcher (`lib/sheets.ts`) |
|---|---|---|
| **Main** (`SHEET_ID` env) | *(in env)* | `ALL SKU DASHBOARD!A1:AX200` → `fetchSkus`; `New Production Master!A1:W430` → `fetchProduction`; `WNP PLANNING!A1:V1048` → `fetchWNPPlanning`; `Open Purchase Orders!A1:L240` → `fetchBulkOpenPOs`; `Packing Schedule!A1:H470` → `fetchPackingSchedule` |
| **BOM** (`BOM_SHEET_ID` const) | `19WdMemJgSpZyMEHfM6zKwEoEJfuKB5yxc4idIWPKn6w` | `BOM matrix RM!A1:BZ800` → `fetchRmBom`; `BOM Ancillaries!A1:EZ800` → `fetchAncillaryBom` (both UNFORMATTED) |
| **Stock** (`STOCK_SHEET_ID` const) | `1zMaD2kNKedl3G4UWZrEfqJHIknT6m-Nfr0JrpBYf3v0` | `Current Inventory!A1:F5000` → `fetchCurrentInventory` (6 cols: Warehouse, Warehouse Desc, Part Number, Part Description, Balance, Unit — **NO BBD/expiry column**) |
| **Production INPUT** (`PRODUCTION_INPUT_SHEET_ID` const) | `1NnS9fg1mFxnWljbjUUXG9701mUPbvrVyiZ2Lbo2Hplw` | `INPUT!A1:N1200` → `fetchProductionInput` |

Column→field mappings: each fetcher in `lib/sheets.ts` + interfaces in `lib/types.ts` (`SkuRow`, `ProductionRow`, `PlanningRow`, `BulkPoRow`, `PackingRow`, `InventoryRow`, `BomSheet`, `ProductionInputRow`).

**Key data facts:**
- **Bulk (1-code) quantities are in THOUSANDS** across stock AND POs. Normalised by `bulkCaps(v) = |v| < 100000 ? v*1000 : v`.
- Part-code convention: **1** = bulk/capsules, **2** = raw materials, **3** = finished goods (packed), **4** = ancillaries. External production cost is per 1,000 capsules.
- **Reads are cached 120s** in-memory (`cachedValues`) to avoid Sheets per-minute read-quota trips.

### 4b. Write target (`PRODUCTION_REPORTS_SHEET_ID` env = `1WliT7s1RWt6wfaC1Wg4d9AaubhA6zFvTWOeKN3OoRzc`)

**Tab `Reports` — 34 columns A–AH, ONE ROW PER BULK** (`lib/production-report.ts` `REPORT_HEADERS`; read back by `fetchProductionReports` A2:AC for Performance, and `fetchProductionReportRows` A2:AH for Internal Yield):

```
A Timestamp · B Work Order · C SKU · D Description · E Product Batch · F Product BBD ·
G Bulk Code · H Bulk Description · I Bulk Batch · J Bulk BBD · K Used · L Made ·
M People · N WO Status · O Waste Capsules · P–U Waste Jars/Lids/Labels/Box/Pouches/Desiccants ·
V Capsule Waste % · W–AB Jars/Lids/Labels/Box/Pouches/Desiccants Waste % · AC Blended Waste % ·
AD Product Type · AE Disposal Number · AF Comments · AG Report ID · AH Bulk Seq ("1/3")
```
Invariant: cols A–AC (index 0–28) unchanged from the original 29-col layout; the FIRST bulk row of a report carries report-level fields (Made, ancillary waste, blended %), later bulk rows leave them blank so column sums don't double-count. `fetchProductionReports` filters rows where **Made (col 11)** is populated → one record per report.

**Tab `Goods In` — 17 columns A–Q** (NEW this session; `lib/goods-in.ts` `GOODS_IN_HEADERS`; auto-bootstrapped on first write by `appendGoodsInRecord`; read back by `fetchGoodsInRows` A2:Q):

```
A Timestamp · B PO Number · C Part Number · D Description · E Quantity · F Supplier ·
G Supplier Product Code · H Batch/Lot No. · I BBD · J Haulier · K Date · L Time ·
M CofA Received · N Comments · O COA URL · P Document URLs (" | " joined) · Q Status ("Booked in")
```
Currently filled by the app: A–I + O/P/Q. J–N are schema placeholders (blank; those fields live on the Word doc for the warehouse). One record = one PO line (PO + part).

### 4c. Relations
No FK relations (it's Sheets). Logical joins done in code by key:
- Planning `productCode`/`bulkCode` ↔ SKU `skuCode`/`bulk`, ↔ Inventory `partNumber`, ↔ BOM product `code`.
- Readiness inbound ↔ Open POs `partNumber`. Goods In task ↔ Open PO `order`+`partNumber`; Goods In record ↔ task by `PO + part`.
- Internal Yield reports grouped by Report ID (col AG).

---

## 5. Environment variables in use

All in `.env.local` (gitignored) AND must be set in Vercel. No secret values here.

| Var | Set? | Description |
|---|---|---|
| `SHEET_ID` | ✅ | Main Google Sheet ID (SKU dashboard, planning, POs, packing, production master). |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | ✅ | Stringified service-account creds. Scope `spreadsheets` (read+write). Email: `utkarsh-rawat@wild-dashboard.iam.gserviceaccount.com`. |
| `PRODUCTION_REPORTS_SHEET_ID` | ✅ | Writable sheet holding the `Reports` tab AND the `Goods In` tab (`1WliT7s1RWt6wfaC1Wg4d9AaubhA6zFvTWOeKN3OoRzc`). |
| `PRODUCTION_REPORT_PASSWORD` | ✅ | Shared password gating `/planning/report` and (fallback) `/goods-in`. Default `12345` if unset. |
| `GROQ_API_KEY` | ✅ | Groq LLM key for the chatbot (`/api/chat`, llama-3.3-70b). |
| `VERCEL_OIDC_TOKEN` | ✅ | Auto-injected by Vercel tooling locally; not app code — ignore. |
| `GOODS_IN_PASSWORD` | ❌ (optional) | Dedicated Goods In / compliance password. If unset, falls back to `PRODUCTION_REPORT_PASSWORD` then `12345`. |
| `BLOB_READ_WRITE_TOKEN` | ❌ (**needed for uploads**) | Vercel Blob token for CofA/document uploads. **Not yet provisioned** — see §6.1. Auto-added when a Blob store is created + linked in the Vercel project. |

**Not env, but effectively config (hardcoded in `lib/sheets.ts`):** `BOM_SHEET_ID`, `STOCK_SHEET_ID`, `PRODUCTION_INPUT_SHEET_ID` (values in §4a).

---

## 6. Left broken / stubbed / partial — and exactly what's needed

1. **Goods In file uploads (CofA + documents) — NOT LIVE.** Needs Vercel Blob. **To finish:** Vercel → project `skudashboard` → **Storage → Create a Blob store → link to the project** (auto-adds `BLOB_READ_WRITE_TOKEN`) → redeploy. Until then the form saves and the Word doc generates; attachments are skipped with an on-screen warning. Code is ready (`app/api/goods-in/route.ts` guards on `BLOB_READ_WRITE_TOKEN`).
   - **Caveat:** current upload is **server-side** (multipart), so files > ~4.5 MB will fail (Vercel function body limit). If real CofAs are larger, switch to Vercel Blob **client-upload** (`handleUpload`) — a known, contained change to the route + form.

2. **Near-real-time lag.** `/planning/yield` and `/goods-in` use `revalidate = 60` on top of the 120s `cachedValues` cache → a submission can take up to ~2 min to appear in the list (the Word doc / auto-download is immediate). To make instant: bypass the cache for those reads or reduce TTL.

3. **Docx layout is faithful but not pixel-identical** to the Google Sheet (fonts/exact widths differ). All fields/sections/labels are present and correct. If an exact visual clone is required, further table-width tuning in `lib/goods-in-doc.ts`.

4. **Carried over from prior sessions (still open):**
   - Procurement Actions **raised/received status tracker** — not built (needs a persistence tab).
   - **Expiry/BBD alerts** — blocked: `Current Inventory` has no BBD column. (Note: Goods In now captures BBD into its own tab, a partial data source if you later want inbound-BBD alerts.)
   - Bulk make-readiness **lead-time backward-scheduling** — not modelled (no per-bulk lead-time data).
   - Readiness `PACKING_WAREHOUSES = {WNP, WNC}` — still an assumption to confirm.

---

## 7. Test data, credentials, manual steps (redo if starting fresh)

- **Goods In tab is now live** in `PRODUCTION_REPORTS_SHEET_ID`. It contains **one REAL record**: `PO2600151` / part `20000022` (Grow 213 Biotin) — the user's own trial submission via the deployed app. Keep or delete as desired (not test junk).
- A throwaway row `ZZ-GI-TEST-DELETE` was written during testing and **deleted** — no lingering test data from automated tests.
- **Vercel Blob not yet enabled** — see §6.1. This is the one outstanding manual step for full Goods In.
- **Service account** `utkarsh-rawat@wild-dashboard.iam.gserviceaccount.com` must retain: Editor on the reports sheet, ≥ Viewer on the 4 source sheets, and it **currently can read the QA13-CF01 template** sheet `1ANaz90LscwnCn_b9slh9w5lPh3YmhKRk6fZYp9iucvs` (used only as the doc reference; the app does NOT read it at runtime — the layout is reproduced in `lib/goods-in-doc.ts`).
- **Passwords:** `/planning/report` and `/goods-in` → `12345` (unless `PRODUCTION_REPORT_PASSWORD`/`GOODS_IN_PASSWORD` set).
- **Market-mode modal:** first visit shows "Select Market View" (sets cookies `marketMode`, `marketsConfigured`). For headless/browser testing set `marketMode=dtc; marketsConfigured=1` to skip it.
- **Vercel CLI** is authenticated on this machine (account `utkarshrawatofficial-2811`, scope `utkarsh-projects12`, project `skudashboard`). Deploy = `git push origin main`; use `npx vercel ls skudashboard` / `npx vercel inspect <url>` for status.
- **Git** pushes via osxkeychain to `github.com/Utkarshraw123/SKUDASHBOARD` (main). No PR flow — commit to main → Vercel builds (~50s).
- **Offline verification pattern** (no test runner in the repo): transpile a pure `lib/*.ts` with the TypeScript compiler API and run it in a Node `.mjs` against live sheet data using the `.env.local` service-account creds (examples were used this session for readiness, internal-yield, goods-in). Word docs were visually checked with `qlmanage -t -s 1100 -o . file.docx` (macOS Quick Look).
- **No Shopify / Turso / external DB** to re-point. None exist here.

---

## 8. If picking this up in a NEW session — read in this order

1. **`WILDDASHHANDOFF.md`** (this file) — session-complete record.
2. **`CONTEXT.md`** (repo root) — evergreen full reference (data sources, part-code rules, every section §6a–§6i, env, conventions).
3. **`lib/types.ts`** — the data shapes (these interfaces ARE the schema; no ORM).
4. **`lib/sheets.ts`** — every fetcher, the `cachedValues` 120s layer, and the two writers (`appendProductionReport`, `appendGoodsInRecord`). Understand this before touching data.
5. **Feature engines (all pure, unit-test-friendly):** `lib/readiness.ts`, `lib/internal-yield.ts`, `lib/goods-in.ts`, `lib/goods-in-doc.ts`, plus existing `lib/procurement.ts`, `lib/performance.ts`, `lib/production-report.ts`, `lib/component-cover.ts`.
6. **`components/Sidebar.tsx`** — the route map / nav (fastest way to see every page).
7. The view for whatever you're changing: `ReadinessView` / `InternalYieldView` / `GoodsInView` + `GoodsInForm` / `PerformanceView`.

**Golden rules:** data source is Google Sheets (not a DB); bulk 1-code quantities are in thousands; keep engines pure and add a scratchpad transpile-test against live data before wiring UI; Recharts animated `<Bar>` can render empty under React 18 dev StrictMode (use `isAnimationActive={false}`); verify in the browser preview then `git push` to deploy; don't delete or restructure the live `Reports`/`Goods In` tabs without explicit user go.
