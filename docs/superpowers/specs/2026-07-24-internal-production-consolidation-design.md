# Internal Production tab consolidation — design

> 2026-07-24. Collapse three separate sidebar tabs (Production Performance,
> Internal Production Yield, Production Readiness) plus the existing Internal
> Production planning schedule into **one** "Internal Production" tab with four
> sub-tabs. Delete the now-redundant nav links and duplicated helper code.
> Approach approved: **A — nested layout + sub-tab bar** (routes unchanged).

## Goal

The sidebar's Production group currently exposes four internal-production
destinations as separate top-level links:

- `/planning` — **Internal Production** (WNP planning schedule: work orders, status, batches)
- `/planning/performance` — **Production Performance**
- `/planning/yield` — **Internal Production Yield**
- `/planning/readiness` — **Production Readiness**

The user wants these presented as **one** "Internal Production" tab. The user
explicitly chose to keep the planning schedule as a 4th section (nothing lost).

Final experience: **one** sidebar entry ("Internal Production" → `/planning`)
that opens a page with a horizontal sub-tab bar:

**Schedule · Performance · Yield · Readiness**

## Approach (A — approved)

Keep the four existing pages exactly as they are (each keeps its own
`revalidate`, its own `searchParams`/filters, and its proven data logic). Add a
shared sub-tab header via a nested layout so all four render under one visual
tab. Remove the three redundant sidebar links.

This is the lowest-risk option: no data-fetching or filtering logic is rewritten,
so none of the four views can regress. The consolidation is purely navigational
plus dead-link and dead-code removal.

### Components

1. **`app/planning/layout.tsx`** (new, server component)
   - Wraps all `/planning/*` routes.
   - Renders `<InternalProductionTabs />` above `{children}`.
   - No data fetching.

2. **`components/InternalProductionTabs.tsx`** (new, client component)
   - `"use client"`, uses `usePathname()`.
   - Renders 4 links styled as a horizontal tab bar, active tab highlighted with
     the existing copper accent (`#c9612e` / `bg-copper`) to match `Sidebar.tsx`.
   - Tabs (order fixed): Schedule (`/planning`) · Performance
     (`/planning/performance`) · Yield (`/planning/yield`) · Readiness
     (`/planning/readiness`).
   - Active-match rule: Schedule is active only on exact `/planning`; the other
     three are active on their exact path. (Exact match, not `startsWith`, so
     `/planning/performance` does not also light up Schedule.)
   - **Renders `null` when `pathname` starts with `/planning/report`** — the
     Production Report form is a data-entry form reached via button, not one of
     the four views, and must not gain a sub-tab bar. Its URL and behaviour are
     unchanged.

3. **`components/Sidebar.tsx`** (edit)
   - In `productionNav`, remove the three entries: Production Performance,
     Internal Production Yield, Production Readiness.
   - Keep the single `{ href: "/planning", label: "Internal Production" }` entry.
   - Result — Production group becomes: External Production · **Internal
     Production** · Goods In · Packing Schedule · Open Purchase Orders.

4. **Per-page headers (edit, cosmetic)**
   - The four pages each render their own `<h1>` + description. Keep each page's
     own `<h1>` (Schedule / Production Performance / Internal Production Yield /
     Production Readiness) so each sub-tab still has a clear title beneath the
     tab bar. No change required, but verify spacing looks right below the bar.

### Repeated code to delete

- **Duplicated date parser.** `parseDDMMYYYY` in `app/planning/page.tsx` and the
  identical helper in `app/production/page.tsx`, plus `parseDMY` in
  `app/planning/performance/page.tsx`, are the same function three times. Extract
  one `parseDateDMY(s: string): Date | null` into **`lib/dates.ts`** (new) and
  import it in `planning/page.tsx` and `performance/page.tsx`. Also update
  `production/page.tsx` to use it (identical logic; trivial swap) so the helper
  exists once. Behaviour-preserving.
- **The three redundant sidebar links** (removed as above).

Out of scope: no change to any view's columns, filters, computations, Word/CSV
export, the Report form, or External Production's data logic.

## Data flow

Unchanged. Each sub-route is still its own server component:

- `/planning` → `fetchWNPPlanning` (revalidate 300)
- `/planning/performance` → `fetchProductionInput` + `fetchProductionReports` + `fetchSkus` → `computePerformance` (revalidate 300)
- `/planning/yield` → `fetchProductionReportRows` → `computeInternalYield` (revalidate 60)
- `/planning/readiness` → 7 fetchers → `computeReadiness` (revalidate 0)

Because each route keeps its own `revalidate`, freshness semantics are preserved
and no single page fans out all fetchers at once (respects the 60-reads/min
Sheets quota).

## Error handling

No new failure modes. The tab bar is static links; navigation uses existing
routes. Existing `app/planning/loading.tsx` still covers the schedule route.

## Testing / verification

1. `npx tsc --noEmit` clean.
2. `next build` passes.
3. Browser preview:
   - Sidebar shows one "Internal Production" entry; the 3 old links are gone.
   - `/planning` shows the tab bar with **Schedule** active + the WNP schedule.
   - Clicking Performance / Yield / Readiness navigates and highlights the right
     tab; each view renders its existing content.
   - `/planning/report` shows the form with **no** sub-tab bar.
   - No console errors; each view's filters still work.

## Out of scope / non-goals

- Not merging the four views' data or logic into one query.
- Not touching the Report form, External Production, Goods In, Packing, or POs.
- Not adding Report as a sub-tab.
