# Internal Production Performance — Design Spec
**Date:** 2026-07-03
**Route:** `/planning/performance` · sidebar "Production Performance" (Production group)

## Purpose
A detailed view of what happens inside the production room: output, efficiency (yield vs the supervisor's flexible daily target), material yield/wastage, broken down by machine, employee, shift and product, with trends over time.

## Data sources
- **Production INPUT sheet** `1NnS9fg1mFxnWljbjUUXG9701mUPbvrVyiZ2Lbo2Hplw`, tab `INPUT` (live). Columns: Date (DD/MM/YYYY), Week Number, Employee, Shift, Machine, Planned Qty, Actual Qty, Present, Efficiency, Product (code), Capsule Size, Speed, Description, Comments. ~915 rows, growing.
- **WNP Production Reports sheet** `1WliT7s1RWt6wfaC1Wg4d9AaubhA6zFvTWOeKN3OoRzc`, tab `Reports` — per-part + blended wastage from the supervisor form. Sparse until adoption; UI degrades gracefully.

## Metrics
- **Efficiency** = Actual ÷ Planned (Planned = supervisor's daily target). Roll-ups use **weighted** efficiency = Σactual ÷ Σplanned (not average of row %).
- **Yield** = good-output rate = 100% − blended material wastage % (from reports). Shown alongside wastage. "Awaiting reports" when no data.
- **Output** = Σ Actual Qty.
- **Headcount present** = distinct employees with Present = Yes in range.
- **RAG:** green ≥ 90%, amber 75–90%, red < 75% (applies to efficiency).

## Layout (top → bottom)
1. **Filter bar** — date range + This Week/This Month chips (reuse FilterBar periodKeys); optional Machine / Employee / Shift selects. Everything reacts.
2. **Overview KPIs** — Total Output, Weighted Efficiency (RAG), Yield %, Headcount Present, Tasks Below Target count, Avg Blended Wastage.
3. **Trend chart** (Recharts) — output bars + efficiency line, daily when range ≤ ~6 weeks else weekly.
4. **By Machine** — planned, actual, weighted efficiency (RAG), output share; sorted worst-efficiency first (bottlenecks). Expandable → underlying tasks incl. Comments.
5. **By Employee** — efficiency, output, days worked, RAG. Expandable.
6. **By Shift** — Shift 1/2/3 comparison.
7. **By Product** — SKU-level efficiency & output (join Product code → description via SKU dashboard).
8. **Material Wastage panel** — per-part + blended wastage from reports; graceful empty state.
9. **CSV export** on each table.

## Files
- `lib/sheets.ts` — `fetchProductionInput()` (INPUT tab), `fetchProductionReports()` (Reports tab). Both read-only.
- `lib/performance.ts` — types + pure aggregation: parse rows, group + weighted efficiency + RAG by machine/employee/shift/product, daily/weekly trend series, wastage summary from reports. Unit-testable.
- `app/planning/performance/page.tsx` — server: fetch INPUT + reports + SKUs, compute, render.
- `components/PerformanceView.tsx` — client: filters, KPIs, trend chart, breakdown tables (expandable), wastage panel, CSV buttons.
- `components/Sidebar.tsx` — new nav entry.

## Non-goals
- No write-back. Read-only analytics.
- Speed / Capsule Size columns: surfaced in task drill-down if populated, not core metrics (sparse).
- No forecasting/predictive analytics (YAGNI).
