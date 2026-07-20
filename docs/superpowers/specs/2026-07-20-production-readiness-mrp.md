# Production Readiness (MRP-lite) — Design Spec

> Approved 2026-07-20. Flags any WNP work order in the next 10 days whose
> components (bulk + ancillaries) won't be physically available in time, so
> production is never halted for a missing part.

## Goal
For every internal (WNP) work order scheduled in the next 10 days, verify each
consumed component is on hand — or arriving in time — and flag shortfalls early.

## Decisions (locked)
1. **Horizon date** — specific day derived from `PLANNED WEEK (WC)` + first day in
   `PLANNED DAYS`; fall back to week-commencing when the day string is fuzzy.
2. **Bulk depth** — on-hand + inbound: green = on hand; amber = covered only by a
   bulk WO/PO arriving before the run; red = neither.
3. **Ancillaries** — reuse the procurement subset (`ancillaryType()`: jar/lid/label/
   box/pouch). Skip scoops, shippers, and anything unmatched.
4. **Alerting (Phase 1)** — dashboard page + Overview banner. Email digest = Phase 2.

## Scope of a work order
A WNP WO = a packing run: consumes **bulk (1-code)** + **ancillaries (4-codes)** to
make a **finished good (3-code)**. Raw materials are a level deeper (TPM lead times
≫ 10 days) — out of scope; if the bulk itself isn't there, that's the flag.
Only `productCode` starting with `3` is checked; other rows excluded (counted).

## Engine — `lib/readiness.ts` `computeReadiness()`
Pure, unit-testable. Reuses the explosion/netting shape of `lib/procurement.ts`.

**Inputs:** `planning`, `skus`, `inventory`, `production` (New Production Master),
`bulkPOs` (Open Purchase Orders), `ancBom`, `today?`, `horizonDays?=10`.

1. **Select WOs:** `status != complete`, `plannedDate ∈ [today, today+10d]`,
   `netQty = quantity − quantityProduced > 0`.
2. **Requirements per WO:**
   - Bulk: `bulkCode` (row → SKU fallback), caps = `netQty × fill` (row → SKU fallback).
   - Ancillaries: explode `netQty` through `ancBom` for the 3-code, filtered by
     `ancillaryType()`; qty = `unitsPerProduct × netQty`.
3. **Supply per component:**
   - On-hand = stock at **packing warehouses (WNP, WNC)** as of today.
   - Inbound = Open POs + open New Production Master rows due `≤ plannedDate`
     (bulk PO qty ×1000 caps), de-duped by PO number.
4. **Time-phased netting** (the MRP part): sort WOs by date; per component keep two
   running balances seeded at on-hand — `stockOnly` and `withInbound` (adds future
   receipts as their due date passes). Per component on each WO:
   - `stockOnly ≥ need` → **ok** (green)
   - else `withInbound ≥ need` → **at_risk** (amber; names the inbound PO/WO)
   - else → **short** (red; `shortfall = need − withInbound`)
   - decrement both by `need` (shortage cascades to later WOs sharing the part).
   WO status = worst component.

**Output:** `ReadinessResult { horizonDays, summary{total,ready,atRisk,short},
workOrders[WoReadiness{…, components[ComponentCheck]}], excludedNon3 }`.

## UI
- **`/planning/readiness`** ("Production Readiness", Production sidebar group):
  KPI row (Ready / At risk / Short), RAG-sorted WO cards, each expandable to the
  component trail (need vs on-hand vs inbound vs shortfall). CSV export.
- **Overview banner:** "⚠ N work orders in the next 10 days are short on components"
  linking through, when short > 0.

## Assumptions to confirm after first live run
- Packing-warehouse set `{WNP, WNC}` for usable stock (adjustable constant).
- Overdue (past-dated, incomplete) WOs currently excluded — easy to fold in.

## Phase 2 (later)
Daily Resend email digest of red/amber WOs (flight-engine cron pattern).
