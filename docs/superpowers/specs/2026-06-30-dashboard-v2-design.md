# Wild Nutrition Dashboard v2 — Design Spec
_Date: 2026-06-30_

## Overview
Extend the existing Next.js 14 dashboard with four new production/planning pages and add URL-param-based filters to all pages.

## New Data Sources (Google Sheets tabs)

| Tab | Key Fields | Purpose |
|-----|-----------|---------|
| New Production Master | Vendor, Order Type, PO#, Part Number, Description, Due Date, Qty, Received | External production orders |
| WNP PLANNING | Planned Week, WO#, Bulk Code, SKU Code, Description, Fill, Qty Planned, Qty Produced | Internal WNP work orders |
| Bulk Open POs | Vendor, PO#, Part Number, Description, Due Date, Order Qty | Open bulk ingredient POs |
| Packing Schedule | Part Number, Description, Due Date, PO#, Balance, Vendor | Active packing orders |

## New Types (`lib/types.ts`)
- `ProductionRow` — external production (New Production Master)
- `PlanningRow` — internal WNP planning
- `BulkPoRow` — bulk open purchase orders
- `PackingRow` — packing schedule

## New Data Fetchers (`lib/sheets.ts`)
- `fetchProduction()` — reads New Production Master, skips 3 header rows
- `fetchWNPPlanning()` — reads WNP PLANNING, skips 3 header rows
- `fetchBulkOpenPOs()` — reads Bulk Open POs, skips 1 header row
- `fetchPackingSchedule()` — reads Packing Schedule, skips 1 header row

## Filter Architecture
URL search params pattern (`?search=collagen&type=PCH&status=critical`).
- `<FilterBar>` — single reusable client component with search input + dropdowns
- Each page reads `searchParams` prop server-side and filters data before render
- No client-state, shareable URLs, fast server render

## New Pages

### `/production` — External Production
Columns: Vendor, Order Type, PO#, Part Number, Description, Due Date, Qty Ordered, Qty Received, Status
Filters: Vendor, Order Type (Bulk/Work Order), search
Status derived: if Received > 0 → "Partial/Complete", else "Open"
Chart: orders due per month

### `/planning` — WNP Internal Planning
Columns: Planned Week, WO#, SKU Code, Description, Fill, Qty Planned, Qty Produced, Status
Filters: Status (Completed/In Progress/Planned), search by SKU/WO
Status derived: Qty Produced >= Qty Planned → Complete; Qty Produced > 0 → In Progress; else Planned

### `/packing` — Packing Schedule
Columns: Part, Description, Due Date, PO#, Balance, Vendor
Sorted: Due Date asc (most urgent first)
Filters: Vendor, overdue/this-week/upcoming, search
Row colour: overdue=red, due ≤7 days=amber, else default

### `/purchase-orders` — Bulk Open POs
Columns: Vendor, PO#, Part, Description, Part Type, Due Date, Qty Ordered
Filters: Vendor, Part Type, search

## Filters on Existing Pages
- `/risk` — adds: Type multi-select, Cover status (Critical/Low/OK), search
- `/inventory` — adds: Type multi-select, search
- `/variance` — adds: Type multi-select, direction (over/under), search

## Sidebar Update
Add "Production" section header + 4 new nav items below existing items.

## Implementation Order
1. Types for new data shapes
2. Sheet fetchers for 4 new tabs
3. `FilterBar` component
4. Filters on existing 3 pages (risk, inventory, variance)
5. `/production` page
6. `/planning` page
7. `/packing` page
8. `/purchase-orders` page
9. Update sidebar
10. Local test → user approval → deploy
