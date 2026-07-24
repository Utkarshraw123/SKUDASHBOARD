# Edit a production report + BBD validation — design

> 2026-07-24. Add the ability to edit an already-submitted production report from
> the Reports register (`/planning/reports`), reusing the existing Production
> Report form in an edit mode that updates the report in place. Tighten BBD
> validation to **required + valid DD/MM/YYYY**, enforced on both client and server.

## Decisions (confirmed with user)

- **Edit flow:** reuse the Production Report form pre-filled, not a separate editor.
- **BBD rules:** required (no blanks) AND a real DD/MM/YYYY date (existing rule kept).
  No future-only or range checks.
- **Enforcement:** client (instant feedback) AND server (can't be bypassed).

## Background (current state)

- A production report = one or more rows in the `Reports` tab (one per bulk),
  all sharing a **Report ID** (col AG, index 32) and a **Timestamp** (col A).
  Primary row carries report-level fields; secondary bulk rows leave them blank.
- `ProductionReportForm` (create) is gated by the report password, validates BBD
  with `isValidDMY` (blank allowed today), and POSTs to `/api/production-report`,
  which builds rows via `reportToRows` and `appendProductionReport` (append only).
- `computeInternalYield(rows).reports` already parses each report into a
  `YieldReport` with every field needed to pre-fill the form: workOrder, sku,
  description, productType, productBatches[], productBBDs[], bulks[] (bulkCode,
  bulkDescription, bulkBatch, bulkBBD, used, wasteCapsules), made, people,
  woStatus, ancWaste, disposalNumber, comments, reportId, timestamp.

## Components

### 1. Reports register — edit entry point
`components/ProductionRecordsView.tsx`: add an **Edit** link as the first (or
last) cell of each row → `href={`/planning/report?edit=${encodeURIComponent(r.reportId)}`}`.
Rows without a reportId (shouldn't happen) omit the link.

### 2. Report page — load the report to edit
`app/planning/report/page.tsx` reads `searchParams.edit`. When present:
- fetch `fetchProductionReportRows()`, run `computeInternalYield(rows)`, find the
  report with matching `reportId`.
- map it to an `EditReport` payload:
  - `batches`: zip `productBatches[i]` with `productBBDs[i]` → `{ batch, bbd }[]`
    (at least one row).
  - `bulks`: map each `bulks[]` entry → form `BulkRow` (numbers → strings).
  - scalar fields copied across; carry `reportId` + `timestamp`.
- pass as `editReport` prop to `ProductionReportForm`. If the id isn't found,
  render the normal create form (no crash).

### 3. `ProductionReportForm` — edit mode
- New optional prop `editReport?: EditReport`.
- On mount (via `useState` initialisers), when `editReport` is set: seed all
  state from it, synthesise a `selected` WorkOrderOption so the form body renders
  immediately, and skip the WO search step. Show a banner: "Editing report
  `<reportId>` — saving overwrites the existing record."
- Submit includes `editReportId` and `editTimestamp` when in edit mode.
- Password gate unchanged (same unlock).
- On success in edit mode: show "Report updated." and keep the form populated
  (don't reset), so further tweaks are possible.

### 4. BBD validation (client) — required + valid
- Add `isRequiredDMY(s) = s.trim() !== "" && isValidDMY(s)` in
  `lib/production-report.ts`.
- "Active" rows only (mirrors the server filter): a batch row is active if
  `batch` or `bbd` is non-empty; a bulk row is active if it has any content.
- `datesValid` = every active batch row and every active bulk row passes
  `isRequiredDMY` on its BBD. Field-level red hint changes from "Use DD/MM/YYYY"
  to also flag blanks ("BBD required"). Submit blocked + message when invalid.

### 5. API `/api/production-report` — server validation + update path
- After building the filtered `batches`/`bulks`, validate: every batch's `bbd`
  and every bulk's `bulkBBD` must satisfy required + valid DD/MM/YYYY; else 400
  with a clear message. (Reuse `isRequiredDMY` / `isValidDMY` from the lib.)
- Read optional `editReportId` (string) + `editTimestamp` (string) from body.
- `reportToRows(input, wastage, opts?)` gains `opts?: { reportId?: string;
  timestamp?: string }` — when provided (edit), reuse them instead of generating
  new ones, so the report keeps its identity + chronological position.
- If `editReportId`: `await updateProductionReport(editReportId, REPORT_HEADERS, rows)`.
  Else: `await appendProductionReport(...)` as today.
- Call `revalidateTag("sheets")` after a successful write (create and edit) so
  the register/yield reflect changes without waiting for the 60s revalidate.

### 6. `lib/sheets.ts` — `updateProductionReport`
```
updateProductionReport(reportId, headers, newRows):
  - ensure header (reuse the header-upsert from appendProductionReport)
  - read Reports!A2:AH with row numbers; collect 0-based data indices where
    row[32] === reportId  → their 1-based sheet rows (index + 2)
  - append newRows (values.append, INSERT_ROWS)   // durable: new version first
  - if old rows existed: batchUpdate deleteDimension ROWS for each captured
    sheet row, DESCENDING (so indices don't shift); needs the Reports sheetId
    from spreadsheets.get.
```
Append-first-then-delete: if the append fails, nothing is deleted (report intact);
if a delete fails after append, the worst case is a duplicate block sharing the
reportId (recoverable by re-editing), never data loss.

## Data flow

Edit: register Edit link → `/planning/report?edit=<id>` → server loads report via
existing engine → form pre-filled → user edits → POST with `editReportId` →
server validates BBD → `updateProductionReport` (append new, delete old) →
`revalidateTag("sheets")` → register/yield show the updated report.

## Error handling

- Bad/blank BBD → 400 (server) + inline block (client).
- `editReportId` not found in the sheet → treat as no old rows: the append still
  writes the (same-id) report; effectively a restore. Return ok.
- Missing `PRODUCTION_REPORTS_SHEET_ID` → existing throw path (500).

## Testing / verification

1. `tsc --noEmit` + `next build` clean.
2. Offline unit check of `isRequiredDMY` and `reportToRows` with a supplied
   reportId/timestamp (transpile-and-run pattern used in this repo).
3. Browser (against a throwaway `ZZ-*`/test report, NEVER `PO2600151` or real
   reports): create a report → Edit it from the register → change made/waste/BBD
   → Save → confirm the register shows the updated values, the Report ID is
   unchanged, and there is exactly ONE report block (no duplicate). Confirm a
   blank BBD blocks submit client-side and returns 400 if forced.
4. Confirm the create flow still works and now also requires BBD.

## Out of scope

- No delete/void of reports (edit only).
- No change to the register columns or the four other sub-tabs.
- No new dependencies.
