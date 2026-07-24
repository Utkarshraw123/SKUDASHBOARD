# Internal Production — 5th tab: Reports register — design

> 2026-07-24. Add a 5th sub-tab, **Reports**, to the consolidated Internal
> Production view. It is a raw records register of every production report
> submitted via the Production Report form (`/planning/report`) — flat,
> searchable, CSV-exportable. One row per report. Distinct from Yield (which is
> the analytics dashboard over the same data).

## Decisions (confirmed with user)

- **Purpose:** raw records register, NOT more analytics.
- **Grain:** one row per report (per submission), not per bulk line.
- **Name:** "Reports" (matches the sheet tab + the form).

## Why this isn't a Yield duplicate

Yield (`/planning/yield`) presents the report data as dashboards: KPIs, wastage
trend chart, wastage by ancillary / work order, batch-compliance table, and an
expandable per-report line-item drill-down. Reports is the opposite: a single
flat table that mirrors the `Reports` sheet, one row per submission, every
report-level field visible at once, sortable-by-nature (newest first) and
CSV-exportable — the same pattern as Schedule / Goods In / External Production.

## Approach

Reuse the existing engine and fetcher; add only a route + a view.

- **Route:** `app/planning/reports/page.tsx` (new), server component,
  `export const revalidate = 60` (near real-time, matching Yield).
- **Data:** `fetchProductionReportRows()` (already cached; same call Yield makes,
  so no extra Sheets read) → `computeInternalYield(rows).reports`. That field is
  a `YieldReport[]`, newest-first, already carrying every report-level field:
  reportId, timestamp, dateLabel, workOrder, sku, description, productType,
  productBatches, productBBDs, made, people, woStatus, ancWaste, blendedPct,
  disposalNumber, comments, bulks[], totalCapsulesWasted, totalAncillaryWasted.
  No new engine, no duplicated computation.
- **View:** `components/ProductionRecordsView.tsx` (new, client). A flat table
  with a search box (filters across work order / SKU / description / product
  type / product batch / report id) and `<ExportCsvButton filename="production-reports" />`
  (exports the rendered table). A count line ("Showing X of N reports").

### Columns (one row per report)

Date (`dateLabel`, fallback timestamp date) · Work Order · SKU · Description ·
Product Type · WO Status · Made · People · Bulk Code(s) (`bulks[].bulkCode`
joined) · Product Batch (`productBatches` joined) · Product BBD (`productBBDs`
joined) · Capsules Wasted (`totalCapsulesWasted`) · Ancillary Wasted
(`totalAncillaryWasted`) · Blended Waste % (`blendedPct`) · Disposal # · Comments
· Report ID.

Numbers right-aligned, tabular-nums; blended % uses the existing waste colour
badge convention if trivial, else plain `.toFixed(2)%`. Empty cells render "—".

### Nav wiring

- **`components/InternalProductionTabs.tsx`:** append
  `{ href: "/planning/reports", label: "Reports" }` as the 5th tab. Order:
  Schedule · Performance · Yield · Readiness · Reports.
- **Bug fix in the same file:** the form guard currently reads
  `pathname.startsWith("/planning/report")`, which would ALSO match the new
  `/planning/reports` and wrongly hide the tab bar there. Change to an exact
  match `pathname === "/planning/report"` (the form has no sub-routes) so the
  bar shows on `/planning/reports` and stays hidden on the form.
- Sidebar needs no change: its Internal Production entry already highlights on
  any `/planning/*` path via `startsWith("/planning/")`.

## Testing / verification

1. `npx tsc --noEmit` clean; `next build` passes.
2. Browser: `/planning/reports` shows the tab bar with **Reports** active, a
   flat table of reports, search filters rows, CSV export downloads the table.
3. `/planning/report` (the form) still shows **no** tab bar (guard fix holds).
4. The other four sub-tabs unaffected.

## Out of scope

- No new writes; the form remains the only writer.
- No per-bulk drill-down here (that lives in Yield).
- No change to the engine, the four existing views, or the sheet schema.
