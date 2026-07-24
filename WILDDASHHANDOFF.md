# WILDDASHHANDOFF.md — Wild Nutrition SKU Dashboard

> Session record for **2026-07-22 → 2026-07-24**. This is the durable, exhaustive handoff for
> everything done in this session. Pair it with **`CONTEXT.md`** (evergreen full reference).
> **If picking this up cold, read §8 first.**
>
> This file REPLACES the previous session's handoff (2026-07-21→22). That prior record is
> preserved in git history (commit `27f5794`) and its outcomes are folded into `CONTEXT.md`
> §6i. Nothing from the prior session was reverted.

Live app: **https://skudashboard.vercel.app** · Repo: `github.com/Utkarshraw123/SKUDASHBOARD`
(branch `main`, Vercel auto-deploys on push). All work below is **deployed to production**.

---

## 0. TL;DR — what shipped this session

Four pieces of work, all on the **Goods In** feature (`/goods-in`) except the last, which is on the
**Production Report** form (`/planning/report`):

| # | Work | Key commits |
|---|---|---|
| A | Goods In: **edit filed records + delete (void) + part-code filters (1/2/3/4)** | `2692a8d`…`2576382`, `3663fad`, `9d11b34`, `b69707c` |
| B | Goods In: **delete/edit didn't refresh** → cache-bust fix (`revalidateTag`) | `7990746` |
| C | Goods In: **multi-line "file the whole PO" form** + stock-only filter + combined Word doc | `ce72233`…`5f17cc6`, `691bd0b` |
| D | Production Report: **auto product-type from FG description + BBD date validation** | `30aabf6` |

Full session commit range: `27f5794..30aabf6` (27 commits incl. docs). `npx tsc --noEmit` is clean at HEAD.

There is **no SQL database** — see §3. The "database" is Google Sheets (§4).

---

## 1. Acceptance checklist — asked vs. delivered

There was no single formal spec; the asks came across the session as three feature requests + one
bug report. Each has its own design spec + (for A and C) an implementation plan under
`docs/superpowers/`. Status key: ✅ done · ◑ partial · ✗ not done.

### Feature A — Goods In edit / void / part-code filters
Spec: `docs/superpowers/specs/2026-07-22-goods-in-edit-void-filters-design.md` · Plan: `…/plans/2026-07-22-goods-in-edit-void-filters.md`

- ✅ **Part-code filters (1=Bulk, 2=RMs, 3=Finished Goods, 4=Ancillaries, Other)** on BOTH the tasks list and the filed-records list, independent selection each. Derived from the **leading digit of the part number** (`partCategory` in `lib/goods-in.ts`), NOT the free-text `partType` PO column. — `components/GoodsInView.tsx`, `lib/goods-in.ts`.
- ✅ **Edit a filed record in place** (reopen pre-fills, saves without creating a duplicate). Enabled by a new **Record ID** column (col R). — `components/GoodsInForm.tsx`, `app/api/goods-in/route.ts`, `lib/sheets.ts` (`updateGoodsInRecord`).
- ✅ **Delete = Void** (soft delete, Status→"Void", audit trail kept) → the PO line returns to the awaiting list. — `app/api/goods-in/void/route.ts`, `lib/sheets.ts` (`voidGoodsInRecord`), `parseGoodsInRecords` excludes Void.
- ✅ Bug found in browser test & fixed: duplicate React key on multi-line-PO task rows stranded stale rows on filter (`5c64c89`). Pre-existing NUL byte in `key()` separator fixed (`dadeea9`).
- ✅ Critical (caught by final review) fixed: editing the one **legacy record with a blank Record ID** (the real `PO2600151`) appended a duplicate instead of updating — fixed by an explicit `editMode` flag (`b69707c`), re-verified against a blank-Record-ID throwaway row.

### Feature B — delete/edit not refreshing (bug)
- ✅ Root cause: the void wrote `Status=Void` to the sheet correctly, but `fetchGoodsInRows` reads through a 120s `unstable_cache` (tag `"sheets"`) + the page is `revalidate=60`; `router.refresh()` does NOT bust that data cache, so a deleted line took up to ~2 min to leave "Filed" / return to awaiting. Fix: `revalidateTag("sheets")` after every write (void, edit, create). — `7990746`, `app/api/goods-in/void/route.ts`, `app/api/goods-in/route.ts`. Verified live (void → gone on next load).

### Feature C — multi-line "file the whole PO" form
Spec: `…/specs/2026-07-22-goods-in-multiline-po-design.md` · Plan: `…/plans/2026-07-23-goods-in-multiline-po.md`

- ✅ **Tasks list grouped by PO** — one row per PO with "X of N filed" + status **Awaiting / Partial / Filed**; urgency from the earliest UNFILED line. 239 line-tasks → 105 PO rows; `PO2600151` shows 26 items. — `lib/goods-in.ts` (`buildGoodsInPoTasks`, `summarisePo`), `app/goods-in/page.tsx`, `components/GoodsInView.tsx`.
- ✅ **Multi-line grouped form** auto-populates all products (Part/Desc/Qty read-only), per-line Supplier Code / Batch-Lot / BBD; a **"Received" tick that auto-ticks when a Batch/Lot is typed**. — `components/GoodsInPoForm.tsx`.
- ✅ **Partial deliveries** — only ticked lines are saved; the rest stay awaiting.
- ✅ **Keep both forms** — a **single-line PO opens the original `GoodsInForm`**; a multi-line PO opens `GoodsInPoForm`. Routed by line count (`toSingleTask` in `GoodsInView`).
- ✅ **Stock-only (1/2/3/4)** — non-stock lines (freight/`ZZ…`/5-/7-codes) excluded everywhere; the **"Other" filter chip removed** (`isStockPart`, `GOODS_IN_PART_CHIPS`).
- ✅ **Combined QA13-CF01 Word doc** — one doc per PO with a products table + the checklist/sign sections once. — `lib/goods-in-doc.ts` (`buildGoodsInPoDoc`), `app/api/goods-in/doc/po/route.ts`. Rendered & visually confirmed.
- ✅ **Filed records grouped by PO** with a **"Word (all)"** download.
- ✅ **Batch save** loops ticked lines doing update-in-place / append via the SAME per-line record model, `revalidateTag` in a `finally`. — `app/api/goods-in/po/route.ts`, `lib/goods-in.ts` (`poLinesToRecords`).
- ✅ Critical (caught by final review) fixed: batch save wiped stored CofA/doc links when reopening a partial PO. Fixed to **write only NEW/CHANGED lines** and **preserve attachments** on edited existing lines (`691bd0b`). Verified live (edited a filed line w/ a CofA → CofA preserved, no duplicate).

### Feature D — Production Report auto product-type + date validation
Spec: `…/specs/2026-07-23-production-report-autotype-datevalidation-design.md`

- ✅ **Auto-select Product Type** on work-order select, derived from the FG description keywords (`daily essential`→daily_essentials, `powder`→powders, `refill`→refills, `jar`→jars, else blank). Dropdown stays editable. — `lib/production-report.ts` (`deriveProductType`), `components/ProductionReportForm.tsx` (`selectWO`).
- ✅ **BBD date validation** — Product BBD + Bulk BBD: blank allowed, non-empty must be a real `DD/MM/YYYY`; invalid → red "Use DD/MM/YYYY" hint + submit blocked. — `lib/production-report.ts` (`isValidDMY`), `components/ProductionReportForm.tsx` (`datesValid`).
- ◑ Validation is **client-side only** (not re-enforced in `/api/production-report`). Acceptable — the form is the only writer — but a malformed date could still be POSTed by bypassing the UI. See §6.

---

## 2. Decisions made that were NOT explicitly specified

**Feature A/C (Goods In data model)**
- **Record ID as a new sheet column (col R, index 17)** to target rows for edit/void. New records get `` `${po}-${part}-${Date.now()}` `` (batch mapper appends `-${index}` for uniqueness within one submission). The one legacy row (blank Record ID) is matched by fallback key `` `${po} ${part} ${timestamp}` ``.
- **Void = soft delete** (Status cell → `"Void"`, hidden on read) rather than hard row deletion — chosen for a compliance form audit trail (this one WAS confirmed with the user).
- **Edit detection via an explicit `editMode="1"` form field**, NOT recordId-truthiness — because the real record has a blank Record ID and gating on recordId duplicated it.
- **Part category = leading digit of the part number**, deliberately ignoring the free-text `partType` PO column (which doesn't reliably follow the code convention).
- **Attachments are one CofA + docs set per delivery**, applied to all lines saved in that submission; on edit, existing attachments are preserved unless new ones are uploaded (`coaUrl: input.coaUrl || l.existingCoa`).
- **Batch save writes only NEW or CHANGED lines** (the form compares each row's compliance fields to its existing record) — prevents rewriting untouched filed lines (which would wipe their attachments) and shrinks the write set.
- **`revalidateTag("sheets")`** is the cache-invalidation lever (the tag `cachedValues` already sets). Placed in `finally` on the batch route.
- Grouped-form status set: **awaiting / partial / filed** (added "partial", which the single-line flow never had).
- Tasks-table row key made unique (PO for grouped rows; `partNumber+timestamp+index` fallback for filed rows) after a duplicate-key bug.
- Fixed a **pre-existing NUL byte** in `lib/goods-in.ts`'s `key()` separator (made the file binary to git) — behaviour-preserving.

**Feature C (Word doc)**
- Combined doc **reuses every section of the single-doc `buildGoodsInDoc` verbatim**, swapping only the single-product core-fields block for a **products table** (columns Part/Description/Qty/Supplier Code/Batch-Lot/BBD). Added a PO/Supplier field row in the body for visibility. Filename `GoodsIn-<po>-all.docx`.

**Feature D (Production Report)**
- **Keyword order matters:** `daily essential` → `powder` → `refill` → `jar` (specific before generic) so "Daily **Multi** Nutrient … Jar" correctly resolves to Jars, "Fibre **Powder** Pouch" to Powders. The literal substring is `"daily essential"` (not just "daily") to avoid false matches.
- `isValidDMY` accepts **1–2 digit day/month + 4-digit year** (lenient on leading zeros) and requires a real calendar date; **empty is valid** (BBD not required). Derivation runs **only on work-order select** so a manual dropdown choice is never overwritten.

**Process**
- Used the brainstorm → spec → plan → subagent-driven-execution loop for A and C (fresh implementer + reviewer per task, opus final whole-branch review). The **final whole-branch review caught a Critical in BOTH A and C that the per-task reviews missed** — keep doing it. Feature D was implemented inline (user asked to minimise tokens) with pure-fn unit tests + tsc + build-passes as the gate.

---

## 3. Deviation from stack assumptions (the REAL stack)

The generic template assumed Next.js / Turso / Shopify / a SQL DB. Reality (unchanged from prior session, re-confirmed):

- **Framework:** Next.js **14.2.5** (App Router, TypeScript, Tailwind), React 18. ✅
- **Database: there is NO SQL database.** No Turso, Postgres, Prisma/Drizzle, ORM. The "database" is **Google Sheets**, read/written via `googleapis` with a **service account** (`GOOGLE_SERVICE_ACCOUNT_JSON`). Data shapes = TypeScript interfaces in `lib/types.ts` + fetchers/parsers in `lib/sheets.ts`. See §4.
- **Shopify:** not in this project (that's the separate *practitioner-portal* repo). No webhooks, no test store.
- **Auth:** no user auth. `/planning/report` and `/goods-in` are gated by a **shared password** (`12345` default). A "Market View" cookie modal filters SKUs but isn't auth.
- **Hosting/CI:** **Vercel**, auto-deploy on push to `main`. No PR flow.
- **LLM:** the "Ask about your data" chatbot uses **Groq** (`llama-3.3-70b-versatile`).
- **Runtime deps of note:** `googleapis`, `recharts`, `docx` (Word generation), `@vercel/blob` (uploads). **No new dependencies added this session.**
- **Caching:** Sheet reads go through `unstable_cache` (120s TTL, tag `"sheets"`); pages use `revalidate` (60–300s). Writes now call `revalidateTag("sheets")`.

---

## 4. Current "DB schema" as it exists right now (Google Sheets)

No SQL tables. The app READS from four spreadsheets and WRITES to one spreadsheet (two tabs).

### 4a. Source spreadsheets (READ-only)

| Spreadsheet (env / const) | ID | Tab → range → fetcher (`lib/sheets.ts`) |
|---|---|---|
| **Main** (`SHEET_ID` env) | *(in env)* | `ALL SKU DASHBOARD!A1:AX200` → `fetchSkus`; `New Production Master!A1:W430` → `fetchProduction`; `WNP PLANNING!A1:V1048` → `fetchWNPPlanning`; `Open Purchase Orders!A1:L240` → `fetchBulkOpenPOs`; `Packing Schedule!A1:H470` → `fetchPackingSchedule` |
| **BOM** (`BOM_SHEET_ID` const) | `19WdMemJgSpZyMEHfM6zKwEoEJfuKB5yxc4idIWPKn6w` | `BOM matrix RM!A1:BZ800` → `fetchRmBom`; `BOM Ancillaries!A1:EZ800` → `fetchAncillaryBom` (UNFORMATTED) |
| **Stock** (`STOCK_SHEET_ID` const) | `1zMaD2kNKedl3G4UWZrEfqJHIknT6m-Nfr0JrpBYf3v0` | `Current Inventory!A1:F5000` → `fetchCurrentInventory` (6 cols: Warehouse, Warehouse Desc, Part Number, Part Description, Balance, Unit — **NO product-type or BBD column**) |
| **Production INPUT** (`PRODUCTION_INPUT_SHEET_ID` const) | `1NnS9fg1mFxnWljbjUUXG9701mUPbvrVyiZ2Lbo2Hplw` | `INPUT!A1:N1200` → `fetchProductionInput` |

Column→field maps: fetchers in `lib/sheets.ts` + interfaces in `lib/types.ts` (`SkuRow`, `ProductionRow`, `PlanningRow`, `BulkPoRow`, `PackingRow`, `InventoryRow`, `BomSheet`, `ProductionInputRow`).

**Key facts:** bulk (1-code) quantities are in **THOUSANDS** across stock AND POs (normalise via `bulkCaps`). Part-code convention: **1**=bulk/capsules, **2**=raw materials, **3**=finished goods (packed), **4**=ancillaries, else non-stock. External production cost is per 1,000 capsules.

### 4b. Write target (`PRODUCTION_REPORTS_SHEET_ID` env = `1WliT7s1RWt6wfaC1Wg4d9AaubhA6zFvTWOeKN3OoRzc`)

**Tab `Reports` — 34 columns A–AH, ONE ROW PER BULK** (unchanged this session; `lib/production-report.ts` `REPORT_HEADERS`; read by `fetchProductionReports` A2:AC and `fetchProductionReportRows` A2:AH):
```
A Timestamp · B Work Order · C SKU · D Description · E Product Batch · F Product BBD ·
G Bulk Code · H Bulk Description · I Bulk Batch · J Bulk BBD · K Used · L Made ·
M People · N WO Status · O Waste Capsules · P–U Waste Jars/Lids/Labels/Box/Pouches/Desiccants ·
V Capsule Waste % · W–AB per-part Waste % · AC Blended Waste % ·
AD Product Type · AE Disposal Number · AF Comments · AG Report ID · AH Bulk Seq ("1/3")
```

**Tab `Goods In` — 18 columns A–R (Record ID column ADDED this session; was 17):**
```
A Timestamp · B PO Number · C Part Number · D Description · E Quantity · F Supplier ·
G Supplier Product Code · H Batch/Lot No. · I BBD · J Haulier · K Date · L Time ·
M CofA Received · N Comments · O COA URL · P Document URLs (" | " joined) ·
Q Status ("Booked in" | "Void") · R Record ID
```
- Defined by `GOODS_IN_HEADERS` in `lib/goods-in.ts`; auto-bootstrapped/header-extended on first write by `appendGoodsInRecord`. Read by `fetchGoodsInRows` (`Goods In!A2:R2000`).
- Filled by the app: A–I + O/P/Q/R. J–N are schema placeholders (blank; those live on the Word doc). One record = one PO line (PO + part).
- **`Status="Void"`** = soft-deleted (excluded by `parseGoodsInRecords`, case-insensitive).
- **Record ID (col R):** unique id for edit/void targeting. Legacy rows have it blank → matched by fallback `` `${po} ${part} ${timestamp}` ``.

### 4c. Relations (logical, done in code — no FKs)
- Planning `productCode`/`bulkCode` ↔ SKU `skuCode`/`bulk` ↔ Inventory `partNumber` ↔ BOM product `code`.
- Goods In task ↔ Open PO `order`+`partNumber`; Goods In record ↔ task by `PO + part`; grouped by PO (`buildGoodsInPoTasks`).
- Reports grouped by Report ID (col AG).

---

## 5. Environment variables in use (no secret values)

All in `.env.local` (gitignored) AND must be set in Vercel.

| Var | Set? | Description |
|---|---|---|
| `SHEET_ID` | ✅ | Main Google Sheet ID (SKUs, planning, POs, packing, production master). |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | ✅ | Stringified service-account creds. Scope `spreadsheets` (read+write). Email `utkarsh-rawat@wild-dashboard.iam.gserviceaccount.com`. |
| `PRODUCTION_REPORTS_SHEET_ID` | ✅ | Writable sheet holding the `Reports` tab AND the `Goods In` tab (`1WliT7s1RWt6wfaC1Wg4d9AaubhA6zFvTWOeKN3OoRzc`). |
| `PRODUCTION_REPORT_PASSWORD` | ✅ | Shared password gating `/planning/report` and (fallback) `/goods-in`. Default `12345` if unset. |
| `GROQ_API_KEY` | ✅ | Groq LLM key for the chatbot (`/api/chat`). |
| `GOODS_IN_PASSWORD` | ❌ (optional) | Dedicated Goods In / compliance password. Falls back to `PRODUCTION_REPORT_PASSWORD` then `12345`. |
| `BLOB_READ_WRITE_TOKEN` | ❌ (**needed for uploads**) | Vercel Blob token for CofA/document uploads. **Not yet provisioned** — see §6.1. |
| `VERCEL_OIDC_TOKEN` | ✅ (auto) | Injected by Vercel tooling locally; not app code — ignore. |

**Not env, hardcoded consts in `lib/sheets.ts`:** `BOM_SHEET_ID`, `STOCK_SHEET_ID`, `PRODUCTION_INPUT_SHEET_ID` (values in §4a). No new env vars were introduced this session.

---

## 6. Left broken / stubbed / partial — and exactly what's needed

1. **Goods In file uploads (CofA + documents) — NOT LIVE.** Needs Vercel Blob. **To finish:** Vercel → project `skudashboard` → **Storage → Create/Connect a Blob store → link to project** (auto-adds `BLOB_READ_WRITE_TOKEN`) → redeploy. Until then, records save and the Word doc generates; attachments are skipped with an on-screen warning ("File storage not configured…"). Code is ready (`lib/goods-in-upload.ts` guards on the token). **Caveat:** current upload is server-side multipart (~4.5 MB Vercel body limit); if real CofAs are larger, switch to Vercel Blob **client-upload** (`handleUpload`) — a contained change to `lib/goods-in-upload.ts` + the two forms.

2. **Production Report date validation is client-side only.** `/api/production-report` does not re-validate BBD format. Low risk (form is the only writer). To harden: add an `isValidDMY` check server-side and 400 on bad dates.

3. **Product-type auto-derivation leaves ~20 FGs blank** (gummies, boxed/unboxed capsules, tablets — no format word in the description). By design; user picks those manually. If they want those covered, add SKU→type overrides or more keywords in `deriveProductType`.

4. **Known minors (non-blocking, logged during review):**
   - `/api/goods-in/void` returns HTTP **500 (not 404)** on a no-match. Cosmetic.
   - `updateGoodsInRecord`/`voidGoodsInRecord` don't re-label the header row to 18 cols. Cosmetic — reads are positional; the header self-heals on the next `appendGoodsInRecord`.
   - `/api/goods-in/po` batch save: a **mid-loop write failure** commits earlier lines then 500s; a blind retry can create **duplicate rows** for the already-succeeded lines (rare; recoverable via Delete/Void). `revalidateTag` now fires in `finally` so partial writes are at least visible.
   - `/api/goods-in/po` reads a `supplier` multipart field that is unused (each line carries its own supplier). Harmless.

5. **Carried over from earlier sessions (still open):** Procurement Actions raised/received status tracker (needs a persistence tab); Expiry/BBD alerts (Current Inventory has no BBD column — Goods In now captures BBD, a partial future source); bulk make-readiness lead-time scheduling (no per-bulk lead-time data); Readiness `PACKING_WAREHOUSES = {WNP, WNC}` assumption.

---

## 7. Test data, credentials, manual steps (redo if starting fresh)

- **Live Goods In tab currently contains the user's own real trial records** (both are the user's, not automated-test junk): `PO2600151`/`20000022` (Grow 213 Biotin) — currently **`Status=Void`** (the user deleted it via the app; since that PO is still open it now shows back in the awaiting list); and `PO2600633`/`20000148` — **`Booked in`**. Keep or delete as desired.
- **All automated-test rows were cleaned up.** This session's live E2E scripts wrote only `ZZ-*` throwaway POs (`ZZ-EDIT-TEST-*`, `ZZ-E2E-*`, `ZZ-LEGACY-*`, `ZZ-CACHE-*`, `ZZ-MLPO-*`, `ZZ-ATT-*`) and hard-deleted them; a final sweep confirmed 0 `ZZ-*` rows remain. **Never write tests against `PO2600151`.**
- **Vercel Blob not yet enabled** — the one outstanding manual step for full Goods In (§6.1).
- **Service account** `utkarsh-rawat@wild-dashboard.iam.gserviceaccount.com` must retain: Editor on the reports sheet, ≥ Viewer on the 4 source sheets. It can also read the QA13-CF01 template sheet `1ANaz90LscwnCn_b9slh9w5lPh3YmhKRk6fZYp9iucvs` (reference only; the app reproduces the layout in `lib/goods-in-doc.ts`, does not read it at runtime).
- **Passwords:** `/planning/report` and `/goods-in` → `12345` (unless the `*_PASSWORD` envs are set).
- **Market-mode modal:** first visit shows "Select Market View". For headless/browser testing set cookies `marketMode=dtc; marketsConfigured=1` to skip it.
- **Google Sheets read quota is 60 reads/min/user** — E2E scripts that loop reads WILL trip it (hit this session). Throttle / add 429 backoff in any live script; the app itself is protected by the 120s cache.
- **Vercel CLI** is authenticated (account `utkarshrawatofficial-2811`, scope `utkarsh-projects12`, project `skudashboard`). Deploy = `git push origin main`; check with `npx vercel ls skudashboard`.
- **Offline verification pattern** (no test runner): transpile a pure `lib/*.ts` with the `typescript` package's `transpileModule` and run it in a Node `.mjs` (see this session's scratchpad scripts). For `lib/goods-in-doc.ts`, re-point the `docx` import to `node_modules/docx/build/index.mjs` (it's ESM-only). Word docs checked with `qlmanage -t -s 1100 -o . file.docx`.
- **No Shopify / Turso / external DB** to re-point. None exist here.

---

## 8. If picking this up in a NEW session — read in this order

1. **`WILDDASHHANDOFF.md`** (this file) — session-complete record.
2. **`CONTEXT.md`** (repo root) — evergreen reference; **§6i is the full Goods In write-up** (edit/void/filters + multi-line PO), updated this session.
3. **`lib/types.ts`** — the data shapes (these interfaces ARE the schema; no ORM).
4. **`lib/goods-in.ts`** — Goods In domain logic: `GoodsInRecord`, `GOODS_IN_HEADERS` (18 cols), `partCategory`/`isStockPart`/`GOODS_IN_PART_CHIPS`, `buildGoodsInTasks`, `buildGoodsInPoTasks`/`GoodsInPoTask`/`GoodsInLine`/`summarisePo`, `poLinesToRecords`, `parseGoodsInRecords` (Void exclusion).
5. **`lib/sheets.ts`** — fetchers, the `cachedValues` (120s tag `"sheets"`) layer, and writers: `appendGoodsInRecord`, `updateGoodsInRecord`, `voidGoodsInRecord`, `findGoodsInRow`. Understand this before touching data.
6. **`components/GoodsInView.tsx`** (PO-grouped list + routing) + **`GoodsInForm.tsx`** (single) + **`GoodsInPoForm.tsx`** (multi-line) — the three Goods In UIs.
7. **The API routes:** `app/api/goods-in/route.ts` (single save/edit), `/po/route.ts` (batch save), `/void/route.ts`, `/doc/route.ts` + `/doc/po/route.ts` (Word). `lib/goods-in-doc.ts` (`buildGoodsInDoc` + `buildGoodsInPoDoc`), `lib/goods-in-upload.ts` (Blob).
8. **`lib/production-report.ts`** (`deriveProductType`, `isValidDMY`, `PRODUCT_TYPES`, `computeWastage`) + **`components/ProductionReportForm.tsx`** — for the Production Report work.
9. The three specs + two plans under `docs/superpowers/` for the full reasoning behind each feature.

**Golden rules:** data source is Google Sheets (not a DB); bulk 1-code quantities are in thousands; Goods In is one row per PO+part (18 cols, Record ID col R, Void = soft delete); every write must `revalidateTag("sheets")`; part category = leading digit of the part number; keep engines pure and unit-test them offline against a transpiled module; run the **opus whole-branch final review before deploy** (it caught a Critical in both A and C); verify in the browser preview, then `git push` to deploy; **never test against `PO2600151`**; throttle live Sheets reads (60/min quota).
