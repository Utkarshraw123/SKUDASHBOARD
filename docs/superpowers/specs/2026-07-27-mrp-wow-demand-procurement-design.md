# MRP Procurement Planner on WoW weekly forecast — design

> 2026-07-27. Rebuild the Procurement Planner into an MRP that drives demand and
> cover off the **WoW Demand** weekly forecast (not the flat 12-week average),
> plans finished-goods production from scratch for a chosen bimonthly cycle, and
> cascades into bulk → raw materials → ancillaries. Cover targets are settable
> (global + collagen/magnesium + per-SKU). Every table is CSV-downloadable.

## Confirmed data facts (probed live)

- **WoW sheet:** id `19uHzvIjKYpZPh1YO8HLhjX_YNDNNDhiedOCjYPbFBE8`, tab **"WoW Demand"**.
  - Row 2: `A`="New Codes", `B`="Product", **`C`→`EH` = week-commencing dates**,
    weekly, **30/09/2024 → 03/05/2027** (136 weeks). Columns after `EH`
    (`CSL Demand`, `Forcasted Demand`, `8/12/16 weeks`) are summaries — ignored.
  - **SKU block = the LOWER contiguous run of 3-codes** (rows ~172–347, 176 codes).
    Column `C` there is a constant "1" flag — ignored. Demand aligns **directly**
    to the row-2 date headers (verified: upper vs lower block identical from
    col K onward). Detect the block dynamically as the **last** contiguous run of
    codes matching `/^3\d{7}/` after the header, so it survives row shifts.
- **Current stock:** ALL SKU DASHBOARD tab, col H "Current Inventory" = sum of
  warehouse balances (verified: 16,421 = 3,509 WNP + 4,922 BCA + 7,990 EXG). Use
  `sku.inventory` from the existing `fetchSkus`. (Replaces the old
  `sumStock(Current Inventory tab, FG_WAREHOUSES)`.)
- **SKU coverage:** dashboard tracks 143 SKUs; WoW block has 176. **124 match**,
  **52 are WoW-only** (EU/US/discontinued variants not in the dashboard). Matched
  SKUs get the full MRP; the 52 unmatched are surfaced in a flagged
  "forecast-only — not in dashboard" table (demand shown, can't plan parts).

## New fetcher — `lib/sheets.ts`

`fetchWowDemand(): Promise<WowDemand>`
- Const `WOW_SHEET_ID = "19uHzvIjKYpZPh1YO8HLhjX_YNDNNDhiedOCjYPbFBE8"`.
- Read `'WoW Demand'!A2:EH400` (headers + generous block).
- Parse row 2 cols C→EH into `weeks: { iso: string; label: string }[]` (DD/MM/YYYY → Date; keep only real dates).
- Find the block: scan col A rows below the header for runs of `/^3\d{7}/`
  separated by blanks; take the **last** run. For each SKU row build
  `number[]` weekly demand aligned to `weeks` (cleanNum each cell, blanks→0).
- Return `{ weeks, demandBySku: Map<string, number[]> }`. Cached via `cachedValues`.

```ts
export interface WowDemand {
  weeks: { iso: string; date: Date }[];      // week-commencing, chronological
  demandBySku: Map<string, number[]>;         // skuCode -> units per week (aligned)
}
```

## Engine — `lib/procurement.ts` (rewrite FG demand/cover; keep cascade)

New inputs to `computePlan`: `wow: WowDemand`, `cycleStart`, `cycleEnd`, `today`,
and cover targets `{ globalCover: number; cmCover: number; perSku: Record<string, number> }`.

Weekly helpers (pure):
- `weeksInRange(from, to)` → indices of `wow.weeks` with `from ≤ date ≤ to`.
- `demandSum(sku, from, to)` → Σ weekly demand over those indices.
- `forwardCoverStock(sku, fromDate, nWeeks)` → Σ of the next `nWeeks` weekly cells
  starting at the first week `≥ fromDate`; if fewer than `nWeeks` remain in the
  grid, sum what's there and set a `coverShort` flag.
- `weeksOfCover(sku, fromDate, stock)` → walk forward accumulating weekly demand
  until it exceeds `stock`; return the number of weeks covered (for display).

Per matched SKU (skips SKUs with no demand in grid):
```
target N       = perSku[sku] ?? (isCollagenMagnesium ? cmCover : globalCover)
currentStock   = sku.inventory                       // ALL SKU DASHBOARD col H
posBeforeStart = Σ open POs due (today, cycleStart]
salesToStart   = demandSum(sku, today, cycleStart)   // forecast consumed pre-cycle
S0             = max(0, currentStock + posBeforeStart − salesToStart)  // opening stock
cycleDemand    = demandSum(sku, cycleStart, cycleEnd)
posInCycle     = Σ open POs due (cycleStart, cycleEnd]
targetStock    = forwardCoverStock(sku, cycleEnd, N)  // N weeks forward cover after end
projectedEnd   = S0 + posInCycle − cycleDemand
unitsToProduce = max(0, ceil(targetStock − projectedEnd))
currentCover   = weeksOfCover(sku, today, currentStock)
openingCover   = weeksOfCover(sku, cycleStart, S0)
```
Row kept when `unitsToProduce > 0` OR `openingCover < N` (visibility). **Manual FG
plans are NOT netted** — no `committedFg`. FgPlanRow gains: `openingStock` (S0),
`openingCover`, `cycleDemand`, `currentCover`, `targetCover` (N), `coverShort`.

Cascade (bulk → RM → ancillary): unchanged mechanics but **remove the committed-
consumption netting** (drop `committedCapsByBulk` / `committedAncUsage`), since
manual FG is ignored. `availableBulk = bulkStock + bulkOpenPOs`;
ancillary `available = ancStock + ancOpenPOs`. Bulk caps = Σ unitsToProduce×fill.

`ProcurementPlan` gains `unmatched: { skuCode: string; product: string; cycleDemand: number }[]`
(WoW SKUs with cycle demand but no dashboard record) and `meta: { cycleStart, cycleEnd,
lastForecastWeek, outOfRange: boolean, globalCover, cmCover }`.

## Cover targets UI (URL-driven, matches existing CyclePicker pattern)

Control bar params: `start`, `end` (cycle dates), `cover` (global, default 16),
`coverCM` (collagen/magnesium, default 20), `cov` (per-SKU overrides encoded
`sku:wks,sku:wks`). Per-SKU: the FG table's target cell is an editable input;
a **Recalculate plan** button collects changed rows into `cov` and navigates.
Resolution: per-SKU > collagen/magnesium > global.

## Page — `app/procurement/page.tsx`

Add `fetchWowDemand()` to the `Promise.all`; default cycle = a sensible bimonthly
window inside the grid; parse cover params; pass everything to `computePlan`; build
the order-action list; render.

## Output / view — `components/ProcurementView.tsx`

1. **Control bar:** cycle start + "cover by" end dates, global cover, collagen/mag
   cover, Recalculate. Cycle-start tooltip (committed-before-start note). Banner if
   the cycle falls outside the forecast grid or forward cover runs past the last week.
2. **Headline MRP instruction list** (the promoted order list), two blocks:
   - **Make:** "Produce N units of [SKU] → N wks cover by [end]" (from FG).
   - **Order (by supplier):** bulk / RM / ancillary lines, as today.
3. **Cascade tables** below: Finished Goods (now showing current cover, opening
   cover @ start, cycle demand, target, to produce), Bulk, Raw Materials, Ancillaries.
4. **Forecast-only SKUs** table: the 52 WoW-only SKUs with cycle demand, flagged.
5. **Every table has `ExportCsvButton`** (CSV download) — including the headline
   Make/Order lists and the forecast-only table.

## Guards
- Cycle dates outside `[first week, last week]` → banner, empty-but-safe plan.
- Forward cover running past the last forecast week → per-row `coverShort` flag +
  a note (target uses the weeks available).
- WoW SKU not in dashboard → forecast-only table, never a crash.

## Testing / verification
- `tsc` + `next build` clean.
- Offline unit test of the weekly helpers (range sum, forward cover, weeks-of-cover)
  against hand-checked numbers from a known SKU (e.g. Immune Support).
- Browser: plan a cycle inside the grid (e.g. **02/11/2026 → 04/01/2027**); confirm
  FG rows show sane opening cover / cycle demand / units to produce; change global
  cover and a per-SKU target → Recalculate updates the plan; CSV downloads work;
  out-of-range cycle shows the banner.

## Out of scope
- No writing back to any sheet. No per-SKU persistence (targets live in the URL).
- No seasonality modelling beyond the weekly forecast as given.
- The 52 forecast-only SKUs are surfaced, not auto-added to the dashboard.
