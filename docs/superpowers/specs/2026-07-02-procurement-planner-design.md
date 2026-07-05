# Procurement Planner — Design Spec
**Date:** 2026-07-02
**Page:** `/procurement` (new sidebar entry under a "Planning" section)

## Purpose
Automate cycle procurement planning: given a planning cycle (start/end dates), compute exactly what to produce and order across finished goods (3-codes), bulk/capsules (1-codes), raw materials (2-codes), and ancillaries (4-codes) — netting against stock, committed usage, and open POs so we never over-order.

## Data Sources
| Data | Sheet / Tab | Notes |
|---|---|---|
| SKU demand & cover | `ALL SKU DASHBOARD` (existing `fetchSkus`) | weekly demand = monthlyDemandAvg ÷ 4.33 |
| Current inventory | Stock file `1zMaD2kNKedl3G4UWZrEfqJHIknT6m-Nfr0JrpBYf3v0`, tab `Current Inventory` | cols: Warehouse, Warehouse Desc, Part Number, Part Description, Balance, Unit |
| RM BOM | KIT BUILD AI sheet, `BOM matrix RM` (existing `fetchRmBom`) | kg per 1,000 capsules |
| Ancillary BOM | KIT BUILD AI sheet, `BOM Ancillaries` (existing `fetchAncillaryBom`) | units per finished product |
| Committed production | `WNP PLANNING` + `Packing Schedule` (existing fetchers) | planned 3-code output between today and cycle start |
| Open POs | `Open Purchase Orders` + `New Production Master` (open rows) | incoming supply for 1/2/4 codes |

## Warehouse Rules
- **3-codes (FG stock):** sum of E&G + BCA + WNP + WNC balances
- **2-codes (RM excess):** WNP + WNC balances only (stock at third-party manufacturers = already-planned use)
- **4-codes (ancillaries):** stock netted against committed production usage from today → cycle start

## Cover Targets
- Default: **16 weeks** cover at the last week of the cycle
- **Collagen and Magnesium products: 20 weeks**
- SKUs already at/above target at cycle end: no plan needed

## Calculation Pipeline
### 1. Finished Goods (3-codes)
For each SKU with weekly demand > 0:
- `projectedStockAtCycleEnd = FG stock + incoming open packing/production orders − (weeklyDemand × weeksUntilCycleEnd)`
- `targetStock = targetCover(16 or 20) × weeklyDemand`
- `unitsToProduce = max(0, targetStock − projectedStockAtCycleEnd)`, rounded up sensibly

### 2. Bulk / Capsules (1-codes)
- `capsulesNeeded per SKU = unitsToProduce × fill`
- Group by bulk code (map from ALL SKU DASHBOARD `bulk` column / planning data)
- **Committed consumption:** 3-code packing orders planned between today and cycle start × fill = capsules consumed pre-cycle
- `availableBulk = bulk stock + open bulk POs − committedConsumption`
- `bulkToOrder = max(0, capsulesNeeded − max(0, availableBulk))`

### 3. Raw Materials (2-codes)
- Explode `bulkToOrder` through RM BOM: `kgNeeded = (bulkToOrder / 1000) × kgPer1000Caps`
- `excessStock = WNP + WNC balance`, minus committed RM usage today → cycle start
- Net against open RM POs
- `orderQty = max(0, kgNeeded − excess − openPOs) × 1.08` (8% buffer on net)

### 4. Ancillaries (4-codes)
- Explode `unitsToProduce` through Ancillary BOM
- Only plan: **jars, lids, boxes, labels, pouches** (exclude scoops, shippers)
- `excess = stock − committed usage (today → cycle start)`, net against open POs
- Buffers on net order: boxes 5%; labels, pouches, jars, lids 10%

## UI
- Date-range picker (cycle start / cycle end) at top; state in URL params
- 4 sections (FG, Bulk, RM, Ancillaries), each a table with KPI summary
- Every row expandable: full calculation trail (gross requirement, committed usage, stock by warehouse group, open POs with PO numbers, buffer, net order)
- Rows fully covered by stock/POs still shown greyed with reason, e.g. "No order needed — covered by PO WN12345"
- **Open PO cutoff:** only POs with a due date on or before the cycle end date count as incoming supply; POs landing after the cycle end are ignored
- CSV export per section (later enhancement)

## Non-Goals
- No write-back to sheets; read-only planner
- No lead-time modelling (in-house truck, nearby TPMs — transit is negligible)
- Scoops and shippers excluded from ancillary planning
