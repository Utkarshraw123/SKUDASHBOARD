# Production Reporting Form — Design Spec
**Date:** 2026-07-03
**Routes:** `/planning/report` (form) · `/api/production-report` (write API)

## Purpose
Let a production supervisor file a per-production report via a shareable link. Each submission appends a row to a dedicated "WNP Production Reports" spreadsheet with computed part-level and blended wastage, for month-end reconciliation. Slack posting is deliberately out of scope for now (API structured so it can be added later).

## Access
- Standalone shareable URL `/planning/report` + a "New Production Report" button on the Internal Production page.
- **Password gate:** supervisor enters `12345` (env `PRODUCTION_REPORT_PASSWORD`) before the form appears. Password is also sent with the submission and re-verified server-side before any sheet write.

## Flow (pre-fill = Option A)
1. Supervisor selects their **Work Order** from live WNP Planning data (searchable dropdown).
2. Auto-fill (all editable): Description (fallback to SKU dashboard if planning row blank), SKU/Product Code, Work Order, product Batch, product BBD, Bulk Code, Bulk Description (looked up from bulk code via Current Inventory), planned Staff.
3. Manual entry: Bulk Batch, Bulk BBD (read off drum), **Used** (bulk capsules), **Made** (units), **People**, **WO Status** (complete/partial), and **Waste** per part — Capsules, Jars, Lids, Labels, Box, Pouches, Desiccants.
4. Submit → POST `/api/production-report` → verify password → compute wastage → append row.

## Wastage formulas (new — not calculated today)
- **Capsule/bulk wastage %** = capsuleWaste ÷ used
- **Ancillary wastage %** (jars, lids, labels, box, pouches, desiccants) = partWaste ÷ (made + partWaste)
- **Blended wastage %** = average of the individual part wastage percentages, over parts actually consumed (waste or usage > 0)
All computed in a pure function `computeWastage()` in `lib/production-report.ts` (unit-testable).

## Spreadsheet output
- Dedicated sheet, env `PRODUCTION_REPORTS_SHEET_ID`, service account shared as Editor.
- Tab `Reports`; headers auto-created on first write if the sheet is empty.
- Columns: Timestamp, Work Order, SKU, Description, Product Batch, Product BBD, Bulk Code, Bulk Description, Bulk Batch, Bulk BBD, Used, Made, People, WO Status, Waste Capsules, Waste Jars, Waste Lids, Waste Labels, Waste Box, Waste Pouches, Waste Desiccants, Capsule Waste %, Jars Waste %, Lids Waste %, Labels Waste %, Box Waste %, Pouches Waste %, Desiccants Waste %, Blended Waste %.
- One row appended per submission (`values.append`), newest at bottom; CSV/pivot friendly for finance.

## Scope / infra change
- Service account scope upgraded from `spreadsheets.readonly` to `spreadsheets` (read+write). Existing read fetchers unaffected.
- New env vars: `PRODUCTION_REPORTS_SHEET_ID`, `PRODUCTION_REPORT_PASSWORD` (default 12345). Added to `.env.local` and Vercel.

## Components / files
- `lib/production-report.ts` — types + `computeWastage()` pure fn.
- `lib/sheets.ts` — scope change; `appendProductionReport(row)` incl. header bootstrap; `fetchBulkDescription` lookup helper (or reuse inventory).
- `app/planning/report/page.tsx` — server: fetch WNP planning + inventory, pass to form.
- `components/ProductionReportForm.tsx` — client: password gate, WO search/select, pre-fill, waste inputs, submit + success/error state.
- `app/api/production-report/route.ts` — POST: validate password, compute wastage, append.
- Internal Production page: "New Production Report" button linking to `/planning/report`.

## Non-goals
- No Slack (later; API leaves a clear insertion point).
- No edit/delete of submitted reports from the UI (correct directly in the sheet if needed).
- No auth beyond the shared password.
