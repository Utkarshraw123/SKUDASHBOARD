# Supervisor Production App — Phase 3: Dashboard Reflection (read the DB) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the Phase-2 production data on the manager dashboard: three read-only Internal Production tabs — **Appraisals** (per-operator & per-machine performance), **Runs register** (one row per run, voids flagged/excluded from totals), and **SU04 compliance** (each day's start/end signers, cross-checks, and Denies) — reading the standalone Turso DB instead of the retired `INPUT` sheet.

**Architecture:** New pure aggregation engines (`lib/floor/appraisals.ts`, `lib/floor/compliance.ts`) are unit-tested offline. Two read-only DB queries are added — a date-range run list (extends `runsRepo.listRuns`) and a range readiness reader (`readinessRepo.listReadinessDaysInRange`). Three server components under `app/planning/*` read the DB, resolve machine/operator names via the Phase-2 catalog, run the pure engines, and render client `*View` components. They reuse the dashboard's existing `FilterBar` (date range via `searchParams`) and `ExportCsvButton` (exports the nearest `<table>`). Three tabs are added to `InternalProductionTabs`.

**Tech Stack:** Next.js 14.2.5 App Router (TypeScript). No new dependencies. Reuses Phase-1/2 DB + repos and existing dashboard components.

## Global Constraints

- **Builds on Phase 1 + 2** — reuse: `getClient()`; `listMachines`/`listOperators` (`lib/floor/catalog.ts`); `Run`/`ReadinessDay`/`ReadinessCheck`/`ChecklistItem` types; `efficiency`/`throughput`/`summarizeRuns` (`lib/floor/metrics.ts`); `listRuns` (`lib/floor/runsRepo.ts`). Do not redefine these.
- **Read-only** — Phase 3 only READS the DB. No writes, no mutations, no auth changes. The dashboard stays unauthenticated exactly like every other `/planning/*` page today (internal-use dashboard); only supervisors create data, through `/floor`. Do not add login to the dashboard.
- **Voids** — excluded from all totals/aggregates; shown in the Runs register with a flag.
- **Efficiency/throughput are derived** at read time via the Phase-1 `metrics.ts` helpers; never stored.
- **DB access is server-only** — pages/`lib/floor/*Repo` import `getClient`; never import them into a client component. Client `*View` components receive plain serializable props.
- **Dates:** run/readiness dates are `YYYY-MM-DD`; range filters compare these ISO strings directly (lexicographic == chronological). Default range = current calendar month when `searchParams` omits it.
- **libSQL access pattern:** `client.execute({ sql, args })`; rows in `res.rows`. Use `?` placeholders.
- **House style:** page shell `max-w-7xl`; serif `h1` (`font-serif text-3xl font-medium text-charcoal`); muted subtitle (`text-text-muted text-sm`); reuse `FilterBar` and `ExportCsvButton`.
- **Tests** run with `npm test` (vitest); DB tests use `freshTestDb()` from `test/setup-db.ts`.

---

## File Structure

**Created — pure logic (unit-tested):**
- `lib/floor/appraisals.ts` — `aggregateByOperator(runs)`, `aggregateByMachine(runs)`.
- `lib/floor/compliance.ts` — `summarizeCompliance(bundles)`.

**Modified — repositories (add read-only range queries):**
- `lib/floor/runsRepo.ts` — extend `listRuns` opts with `{ from?, to? }`.
- `lib/floor/readinessRepo.ts` — add `listReadinessDaysInRange(from, to)`.

**Created — dashboard pages + views:**
- `app/planning/appraisals/page.tsx` + `components/AppraisalsView.tsx`.
- `app/planning/runs/page.tsx` + `components/RunsRegisterView.tsx`.
- `app/planning/compliance/page.tsx` + `components/ComplianceView.tsx`.

**Modified:**
- `components/InternalProductionTabs.tsx` — add the three tabs.

**Interfaces produced (Phase 4 admin may reuse):**
- `aggregateByOperator(runs: Run[]): OperatorAppraisal[]`, `aggregateByMachine(runs: Run[]): MachineAppraisal[]`.
- `summarizeCompliance(bundles: DayBundle[]): ComplianceDay[]`.
- `listReadinessDaysInRange(from: string, to: string): Promise<ReadinessDayView[]>`.

---

### Task 1: Appraisals aggregation (pure)

**Files:**
- Create: `lib/floor/appraisals.ts`
- Test: `lib/floor/__tests__/appraisals.test.ts`

**Interfaces:**
- Consumes: `Run` (Phase 1 types); `efficiency`, `throughput` (Phase 1 metrics).
- Produces: `OperatorAppraisal`, `MachineAppraisal`; `aggregateByOperator(runs)`, `aggregateByMachine(runs)`.

- [ ] **Step 1: Write the failing test**

Create `lib/floor/__tests__/appraisals.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { aggregateByOperator, aggregateByMachine } from "../appraisals";
import type { Run } from "../types";

function run(p: Partial<Run>): Run {
  return {
    id: 1, date: "2026-07-30", shift: "1", machineId: 1, operatorId: 1,
    productSku: "X", productDesc: "X", plannedQty: 100, actualQty: 90,
    startTime: "2026-07-30T06:00:00Z", endTime: "2026-07-30T10:00:00Z",
    downtimeMin: 0, comments: null, loggedBy: 1, createdAt: "", updatedAt: "",
    void: false, voidReason: null, voidedBy: null, voidedAt: null, ...p,
  };
}

describe("aggregateByOperator", () => {
  it("sums output/downtime, derives efficiency, counts distinct days, excludes voids", () => {
    const runs = [
      run({ id: 1, operatorId: 10, date: "2026-07-30", actualQty: 90, plannedQty: 100, downtimeMin: 10 }),
      run({ id: 2, operatorId: 10, date: "2026-07-31", actualQty: 60, plannedQty: 100, downtimeMin: 5 }),
      run({ id: 3, operatorId: 20, date: "2026-07-30", actualQty: 40, plannedQty: 50 }),
      run({ id: 4, operatorId: 10, date: "2026-07-30", actualQty: 999, plannedQty: 999, void: true }),
    ];
    const rows = aggregateByOperator(runs);
    const op10 = rows.find((r) => r.operatorId === 10)!;
    expect(op10.runCount).toBe(2);
    expect(op10.totalActual).toBe(150);
    expect(op10.totalPlanned).toBe(200);
    expect(op10.efficiency).toBeCloseTo(0.75);
    expect(op10.totalDowntimeMin).toBe(15);
    expect(op10.daysWorked).toBe(2);
    expect(rows.length).toBe(2);
  });
});

describe("aggregateByMachine", () => {
  it("groups by machine and derives efficiency", () => {
    const runs = [
      run({ id: 1, machineId: 5, actualQty: 90, plannedQty: 100 }),
      run({ id: 2, machineId: 5, actualQty: 80, plannedQty: 100 }),
      run({ id: 3, machineId: 6, actualQty: 10, plannedQty: 40 }),
    ];
    const rows = aggregateByMachine(runs);
    expect(rows.find((r) => r.machineId === 5)!.efficiency).toBeCloseTo(170 / 200);
    expect(rows.find((r) => r.machineId === 6)!.totalActual).toBe(10);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/floor/__tests__/appraisals.test.ts`
Expected: FAIL — cannot find module `../appraisals`.

- [ ] **Step 3: Implement `lib/floor/appraisals.ts`**

```typescript
import type { Run } from "./types";
import { efficiency, throughput } from "./metrics";

export interface OperatorAppraisal {
  operatorId: number;
  runCount: number;
  totalActual: number;
  totalPlanned: number;
  efficiency: number | null;
  totalDowntimeMin: number;
  daysWorked: number;
  avgThroughput: number | null; // mean of per-run throughput where computable
}

export interface MachineAppraisal {
  machineId: number;
  runCount: number;
  totalActual: number;
  totalPlanned: number;
  efficiency: number | null;
  totalDowntimeMin: number;
  avgThroughput: number | null;
}

interface Acc {
  runCount: number;
  totalActual: number;
  totalPlanned: number;
  totalDowntimeMin: number;
  days: Set<string>;
  tputSum: number;
  tputCount: number;
}

function newAcc(): Acc {
  return { runCount: 0, totalActual: 0, totalPlanned: 0, totalDowntimeMin: 0, days: new Set(), tputSum: 0, tputCount: 0 };
}

function fold(acc: Acc, r: Run): void {
  acc.runCount += 1;
  acc.totalActual += r.actualQty ?? 0;
  acc.totalPlanned += r.plannedQty ?? 0;
  acc.totalDowntimeMin += r.downtimeMin ?? 0;
  acc.days.add(r.date);
  const tp = throughput(r.actualQty, r.startTime, r.endTime, r.downtimeMin);
  if (tp != null) { acc.tputSum += tp; acc.tputCount += 1; }
}

function avgTput(acc: Acc): number | null {
  return acc.tputCount > 0 ? acc.tputSum / acc.tputCount : null;
}

export function aggregateByOperator(runs: Run[]): OperatorAppraisal[] {
  const map = new Map<number, Acc>();
  for (const r of runs) {
    if (r.void) continue;
    const acc = map.get(r.operatorId) ?? newAcc();
    fold(acc, r);
    map.set(r.operatorId, acc);
  }
  return Array.from(map.entries()).map(([operatorId, a]) => ({
    operatorId,
    runCount: a.runCount,
    totalActual: a.totalActual,
    totalPlanned: a.totalPlanned,
    efficiency: efficiency(a.totalActual, a.totalPlanned),
    totalDowntimeMin: a.totalDowntimeMin,
    daysWorked: a.days.size,
    avgThroughput: avgTput(a),
  }));
}

export function aggregateByMachine(runs: Run[]): MachineAppraisal[] {
  const map = new Map<number, Acc>();
  for (const r of runs) {
    if (r.void) continue;
    const acc = map.get(r.machineId) ?? newAcc();
    fold(acc, r);
    map.set(r.machineId, acc);
  }
  return Array.from(map.entries()).map(([machineId, a]) => ({
    machineId,
    runCount: a.runCount,
    totalActual: a.totalActual,
    totalPlanned: a.totalPlanned,
    efficiency: efficiency(a.totalActual, a.totalPlanned),
    totalDowntimeMin: a.totalDowntimeMin,
    avgThroughput: avgTput(a),
  }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/floor/__tests__/appraisals.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/floor/appraisals.ts lib/floor/__tests__/appraisals.test.ts
git commit -m "feat(floor): per-operator/machine appraisal aggregation"
```

---

### Task 2: Date-range run query

**Files:**
- Modify: `lib/floor/runsRepo.ts`
- Test: `lib/floor/__tests__/runsRepoRange.test.ts`

**Interfaces:**
- Consumes: `getClient` (Phase 1).
- Produces: `listRuns({ from?, to? })` (extends the existing `{ date? }` signature; `from`/`to` inclusive on `date`).

- [ ] **Step 1: Write the failing test**

Create `lib/floor/__tests__/runsRepoRange.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { freshTestDb } from "@/test/setup-db";
import { createRun, listRuns } from "../runsRepo";
import type { RunInput } from "../types";

async function seedRefs() {
  const { getClient } = await import("@/lib/db/client");
  const now = new Date().toISOString();
  await getClient().execute({ sql: "INSERT INTO users (username,password_hash,name,role,active,created_at) VALUES ('s','x','S','supervisor',1,?)", args: [now] });
  await getClient().execute({ sql: "INSERT INTO machines (name,active,created_at) VALUES ('M',1,?)", args: [now] });
  await getClient().execute({ sql: "INSERT INTO operators (name,active,created_at) VALUES ('O',1,?)", args: [now] });
}
function input(date: string): RunInput {
  return { date, shift: "1", machineId: 1, operatorId: 1, productSku: "X", productDesc: "X",
    plannedQty: 100, actualQty: 90, startTime: null, endTime: null, downtimeMin: 0, comments: null };
}

describe("listRuns range", () => {
  it("filters inclusively by from/to", async () => {
    await freshTestDb();
    await seedRefs();
    await createRun(input("2026-07-29"), 1);
    await createRun(input("2026-07-30"), 1);
    await createRun(input("2026-08-01"), 1);
    expect((await listRuns({ from: "2026-07-30", to: "2026-07-31" })).length).toBe(1);
    expect((await listRuns({ from: "2026-07-29", to: "2026-08-01" })).length).toBe(3);
    expect((await listRuns({ from: "2026-07-01", to: "2026-07-31" })).length).toBe(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/floor/__tests__/runsRepoRange.test.ts`
Expected: FAIL — `listRuns({from,to})` currently ignores `from`/`to`, returning all 3 rows for the first assertion.

- [ ] **Step 3: Update `listRuns` in `lib/floor/runsRepo.ts`**

Replace the existing `listRuns` function with:
```typescript
export async function listRuns(opts: { date?: string; from?: string; to?: string } = {}): Promise<Run[]> {
  if (opts.date) {
    const res = await getClient().execute({ sql: "SELECT * FROM runs WHERE date = ? ORDER BY id DESC", args: [opts.date] });
    return res.rows.map((r) => rowToRun(r as Record<string, unknown>));
  }
  if (opts.from || opts.to) {
    const from = opts.from ?? "0000-00-00";
    const to = opts.to ?? "9999-99-99";
    const res = await getClient().execute({
      sql: "SELECT * FROM runs WHERE date >= ? AND date <= ? ORDER BY date DESC, id DESC",
      args: [from, to],
    });
    return res.rows.map((r) => rowToRun(r as Record<string, unknown>));
  }
  const res = await getClient().execute("SELECT * FROM runs ORDER BY id DESC");
  return res.rows.map((r) => rowToRun(r as Record<string, unknown>));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/floor/__tests__/runsRepoRange.test.ts && npx vitest run lib/floor/__tests__/runsRepo.test.ts`
Expected: PASS (range test + the original Task-4 runsRepo test still green).

- [ ] **Step 5: Commit**

```bash
git add lib/floor/runsRepo.ts lib/floor/__tests__/runsRepoRange.test.ts
git commit -m "feat(floor): date-range filter on listRuns"
```

---

### Task 3: SU04 compliance summarization (pure)

**Files:**
- Create: `lib/floor/compliance.ts`
- Test: `lib/floor/__tests__/compliance.test.ts`

**Interfaces:**
- Consumes: `ReadinessDay`, `ChecklistItem`, `ReadinessCheck` (Phase 1 types).
- Produces: `DayBundle`, `ComplianceDay`, `Deny`; `summarizeCompliance(bundles)`.

- [ ] **Step 1: Write the failing test**

Create `lib/floor/__tests__/compliance.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { summarizeCompliance, type DayBundle } from "../compliance";
import type { ChecklistItem, ReadinessCheck, ReadinessDay } from "../types";

const items: ChecklistItem[] = [
  { id: 1, sortOrder: 1, category: "Env", label: "Area clear", critical: false },
  { id: 2, sortOrder: 2, category: "Env", label: "Pest-free", critical: true },
];
function day(p: Partial<ReadinessDay>): ReadinessDay {
  return { id: 1, date: "2026-07-30", templateId: 1, startCompletedBy: null, startCompletedAt: null,
    startCrossCheckBy: null, endCompletedBy: null, endCompletedAt: null, endCrossCheckBy: null, status: "open", ...p };
}
function check(p: Partial<ReadinessCheck>): ReadinessCheck {
  return { itemId: 1, phase: "start", result: "confirm", comment: null, checkedBy: 1, checkedAt: "", ...p };
}

describe("summarizeCompliance", () => {
  it("reports signers, answered counts, and surfaces denies with comments", () => {
    const bundles: DayBundle[] = [{
      day: day({ startCompletedBy: 1, startCrossCheckBy: 2, status: "started" }),
      items,
      checks: [
        check({ itemId: 1, phase: "start", result: "confirm" }),
        check({ itemId: 2, phase: "start", result: "deny", comment: "droppings seen" }),
      ],
    }];
    const [row] = summarizeCompliance(bundles);
    expect(row.date).toBe("2026-07-30");
    expect(row.startCompletedBy).toBe(1);
    expect(row.startCrossCheckBy).toBe(2);
    expect(row.startAnswered).toBe(2);
    expect(row.total).toBe(2);
    expect(row.endAnswered).toBe(0);
    expect(row.startDenies).toEqual([{ itemLabel: "Pest-free", comment: "droppings seen", critical: true }]);
    expect(row.hasDeny).toBe(true);
  });

  it("orders rows by date descending", () => {
    const rows = summarizeCompliance([
      { day: day({ date: "2026-07-29" }), items, checks: [] },
      { day: day({ date: "2026-07-31" }), items, checks: [] },
    ]);
    expect(rows.map((r) => r.date)).toEqual(["2026-07-31", "2026-07-29"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/floor/__tests__/compliance.test.ts`
Expected: FAIL — cannot find module `../compliance`.

- [ ] **Step 3: Implement `lib/floor/compliance.ts`**

```typescript
import type { ChecklistItem, ReadinessCheck, ReadinessDay, Phase } from "./types";

export interface DayBundle {
  day: ReadinessDay;
  items: ChecklistItem[];
  checks: ReadinessCheck[];
}

export interface Deny {
  itemLabel: string;
  comment: string;
  critical: boolean;
}

export interface ComplianceDay {
  date: string;
  status: ReadinessDay["status"];
  startCompletedBy: number | null;
  startCompletedAt: string | null;
  startCrossCheckBy: number | null;
  endCompletedBy: number | null;
  endCompletedAt: string | null;
  endCrossCheckBy: number | null;
  total: number;
  startAnswered: number;
  endAnswered: number;
  startDenies: Deny[];
  endDenies: Deny[];
  hasDeny: boolean;
}

function deniesFor(items: ChecklistItem[], checks: ReadinessCheck[], phase: Phase): Deny[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return checks
    .filter((c) => c.phase === phase && c.result === "deny")
    .map((c) => ({
      itemLabel: byId.get(c.itemId)?.label ?? `#${c.itemId}`,
      comment: c.comment ?? "",
      critical: byId.get(c.itemId)?.critical ?? false,
    }));
}

function answered(checks: ReadinessCheck[], phase: Phase): number {
  return new Set(checks.filter((c) => c.phase === phase).map((c) => c.itemId)).size;
}

export function summarizeCompliance(bundles: DayBundle[]): ComplianceDay[] {
  return bundles
    .map(({ day, items, checks }) => {
      const startDenies = deniesFor(items, checks, "start");
      const endDenies = deniesFor(items, checks, "end");
      return {
        date: day.date,
        status: day.status,
        startCompletedBy: day.startCompletedBy,
        startCompletedAt: day.startCompletedAt,
        startCrossCheckBy: day.startCrossCheckBy,
        endCompletedBy: day.endCompletedBy,
        endCompletedAt: day.endCompletedAt,
        endCrossCheckBy: day.endCrossCheckBy,
        total: items.length,
        startAnswered: answered(checks, "start"),
        endAnswered: answered(checks, "end"),
        startDenies,
        endDenies,
        hasDeny: startDenies.length + endDenies.length > 0,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/floor/__tests__/compliance.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/floor/compliance.ts lib/floor/__tests__/compliance.test.ts
git commit -m "feat(floor): SU04 compliance summarization"
```

---

### Task 4: Range readiness reader (read-only)

**Files:**
- Modify: `lib/floor/readinessRepo.ts`
- Test: `lib/floor/__tests__/readinessRange.test.ts`

**Interfaces:**
- Consumes: `getClient` (Phase 1); existing `ReadinessDayView` shape.
- Produces: `listReadinessDaysInRange(from, to): Promise<ReadinessDayView[]>` — read-only (does NOT create missing days, unlike `getOrCreateDay`).

- [ ] **Step 1: Write the failing test**

Create `lib/floor/__tests__/readinessRange.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { freshTestDb } from "@/test/setup-db";
import { seed } from "@/lib/db/seed";
import { getOrCreateDay, saveCheck, listReadinessDaysInRange } from "../readinessRepo";

describe("listReadinessDaysInRange", () => {
  it("returns only days in range, each with its items + checks, newest first", async () => {
    const db = await freshTestDb();
    await seed(db, { adminPassword: "x" });
    const { getClient } = await import("@/lib/db/client");
    await getClient().execute({ sql: "INSERT INTO users (username,password_hash,name,role,active,created_at) VALUES ('u','x','U','supervisor',1,?)", args: [new Date().toISOString()] });

    await getOrCreateDay("2026-07-29");
    await getOrCreateDay("2026-07-30");
    await getOrCreateDay("2026-08-02");

    // Add one check to the 30th using a real item id
    const item = await getClient().execute("SELECT id FROM checklist_items ORDER BY sort_order LIMIT 1");
    await saveCheck("2026-07-30", { itemId: item.rows[0].id as number, phase: "start", result: "confirm", comment: null }, 1);

    const rows = await listReadinessDaysInRange("2026-07-29", "2026-07-31");
    expect(rows.map((r) => r.day.date)).toEqual(["2026-07-30", "2026-07-29"]);
    const checked = rows.find((r) => r.day.date === "2026-07-30")!;
    expect(checked.items.length).toBe(15);
    expect(checked.checks.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/floor/__tests__/readinessRange.test.ts`
Expected: FAIL — `listReadinessDaysInRange` is not exported.

- [ ] **Step 3: Add `listReadinessDaysInRange` to `lib/floor/readinessRepo.ts`**

Add these exports (reusing the existing private `rowToDay` and `itemsForTemplate` helpers already in the file):
```typescript
export async function listReadinessDaysInRange(from: string, to: string): Promise<ReadinessDayView[]> {
  const daysRes = await getClient().execute({
    sql: "SELECT * FROM readiness_days WHERE date >= ? AND date <= ? ORDER BY date DESC",
    args: [from, to],
  });
  const out: ReadinessDayView[] = [];
  for (const row of daysRes.rows) {
    const day = rowToDay(row as Record<string, unknown>);
    const items = await itemsForTemplate(day.templateId);
    const checksRes = await getClient().execute({
      sql: "SELECT item_id, phase, result, comment, checked_by, checked_at FROM readiness_checks WHERE readiness_day_id=?",
      args: [day.id],
    });
    const checks = checksRes.rows.map((r) => ({
      itemId: r.item_id as number,
      phase: r.phase as ReadinessCheck["phase"],
      result: r.result as ReadinessCheck["result"],
      comment: (r.comment as string) ?? null,
      checkedBy: r.checked_by as number,
      checkedAt: r.checked_at as string,
    }));
    out.push({ day, items, checks });
  }
  return out;
}
```
If `ReadinessCheck` is not already imported in the file, it is (Task 5 of Phase 2 imported the type set); confirm the top-of-file import line includes `ReadinessCheck`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/floor/__tests__/readinessRange.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/floor/readinessRepo.ts lib/floor/__tests__/readinessRange.test.ts
git commit -m "feat(floor): read-only readiness range reader"
```

---

### Task 5: Appraisals dashboard tab

**Files:**
- Create: `app/planning/appraisals/page.tsx`
- Create: `components/AppraisalsView.tsx`

**Interfaces:**
- Consumes: `listRuns({from,to})` (Task 2); `aggregateByOperator`/`aggregateByMachine` (Task 1); `listMachines`/`listOperators` (Phase 2 catalog).
- Produces: the Appraisals view (per-operator + per-machine tables, CSV, date range).

- [ ] **Step 1: Create the page `app/planning/appraisals/page.tsx`** (server)

```tsx
import { listRuns } from "@/lib/floor/runsRepo";
import { listMachines, listOperators } from "@/lib/floor/catalog";
import { aggregateByOperator, aggregateByMachine } from "@/lib/floor/appraisals";
import AppraisalsView from "@/components/AppraisalsView";
import FilterBar from "@/components/FilterBar";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

function monthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

export default async function AppraisalsPage({
  searchParams,
}: {
  searchParams: { dateFrom?: string; dateTo?: string };
}) {
  const def = monthRange();
  const from = searchParams.dateFrom ?? def.from;
  const to = searchParams.dateTo ?? def.to;

  const [runs, machines, operators] = await Promise.all([
    listRuns({ from, to }),
    listMachines(),
    listOperators(),
  ]);

  const opName = new Map(operators.map((o) => [o.id, o.name]));
  const mName = new Map(machines.map((m) => [m.id, m.name]));

  const byOperator = aggregateByOperator(runs).map((r) => ({ ...r, name: opName.get(r.operatorId) ?? `#${r.operatorId}` }));
  const byMachine = aggregateByMachine(runs).map((r) => ({ ...r, name: mName.get(r.machineId) ?? `#${r.machineId}` }));

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">Appraisals</h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">
          Per-operator and per-machine output, efficiency, throughput and downtime from logged production runs. Voids excluded.
        </p>
      </div>
      <Suspense>
        <FilterBar
          periodKeys={{ from: "dateFrom", to: "dateTo" }}
          filters={[
            { key: "dateFrom", label: "From", type: "date" },
            { key: "dateTo", label: "To", type: "date" },
          ]}
        />
      </Suspense>
      <AppraisalsView byOperator={byOperator} byMachine={byMachine} range={{ from, to }} />
    </div>
  );
}
```

- [ ] **Step 2: Create `components/AppraisalsView.tsx`** (client)

```tsx
"use client";

import ExportCsvButton from "@/components/ExportCsvButton";

interface OpRow { operatorId: number; name: string; runCount: number; totalActual: number; totalPlanned: number; efficiency: number | null; totalDowntimeMin: number; daysWorked: number; avgThroughput: number | null; }
interface McRow { machineId: number; name: string; runCount: number; totalActual: number; totalPlanned: number; efficiency: number | null; totalDowntimeMin: number; avgThroughput: number | null; }

const pct = (e: number | null) => (e == null ? "—" : `${Math.round(e * 100)}%`);
const num = (n: number | null) => (n == null ? "—" : Math.round(n).toLocaleString());

export default function AppraisalsView({
  byOperator, byMachine, range,
}: { byOperator: OpRow[]; byMachine: McRow[]; range: { from: string; to: string } }) {
  return (
    <div className="space-y-10">
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-xl text-charcoal">By operator</h2>
          <ExportCsvButton filename={`appraisals-operator-${range.from}_${range.to}`} />
        </div>
        <div className="overflow-x-auto rounded-xl border border-[#e4ddd4]">
          <table className="min-w-full text-sm">
            <thead className="bg-[#f6f1ea] text-text-muted">
              <tr>
                <th className="text-left px-4 py-2">Operator</th>
                <th className="text-right px-4 py-2">Runs</th>
                <th className="text-right px-4 py-2">Days</th>
                <th className="text-right px-4 py-2">Actual</th>
                <th className="text-right px-4 py-2">Planned</th>
                <th className="text-right px-4 py-2">Efficiency</th>
                <th className="text-right px-4 py-2">Throughput/hr</th>
                <th className="text-right px-4 py-2">Downtime (min)</th>
              </tr>
            </thead>
            <tbody>
              {byOperator.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-text-muted">No runs in range.</td></tr>}
              {byOperator.map((r) => (
                <tr key={r.operatorId} className="border-t border-[#efe8df]">
                  <td className="px-4 py-2 text-charcoal">{r.name}</td>
                  <td className="px-4 py-2 text-right">{r.runCount}</td>
                  <td className="px-4 py-2 text-right">{r.daysWorked}</td>
                  <td className="px-4 py-2 text-right">{num(r.totalActual)}</td>
                  <td className="px-4 py-2 text-right">{num(r.totalPlanned)}</td>
                  <td className="px-4 py-2 text-right">{pct(r.efficiency)}</td>
                  <td className="px-4 py-2 text-right">{num(r.avgThroughput)}</td>
                  <td className="px-4 py-2 text-right">{num(r.totalDowntimeMin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-xl text-charcoal">By machine</h2>
          <ExportCsvButton filename={`appraisals-machine-${range.from}_${range.to}`} />
        </div>
        <div className="overflow-x-auto rounded-xl border border-[#e4ddd4]">
          <table className="min-w-full text-sm">
            <thead className="bg-[#f6f1ea] text-text-muted">
              <tr>
                <th className="text-left px-4 py-2">Machine</th>
                <th className="text-right px-4 py-2">Runs</th>
                <th className="text-right px-4 py-2">Actual</th>
                <th className="text-right px-4 py-2">Planned</th>
                <th className="text-right px-4 py-2">Efficiency</th>
                <th className="text-right px-4 py-2">Throughput/hr</th>
                <th className="text-right px-4 py-2">Downtime (min)</th>
              </tr>
            </thead>
            <tbody>
              {byMachine.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-text-muted">No runs in range.</td></tr>}
              {byMachine.map((r) => (
                <tr key={r.machineId} className="border-t border-[#efe8df]">
                  <td className="px-4 py-2 text-charcoal">{r.name}</td>
                  <td className="px-4 py-2 text-right">{r.runCount}</td>
                  <td className="px-4 py-2 text-right">{num(r.totalActual)}</td>
                  <td className="px-4 py-2 text-right">{num(r.totalPlanned)}</td>
                  <td className="px-4 py-2 text-right">{pct(r.efficiency)}</td>
                  <td className="px-4 py-2 text-right">{num(r.avgThroughput)}</td>
                  <td className="px-4 py-2 text-right">{num(r.totalDowntimeMin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Build + typecheck**

Run: `npx tsc --noEmit && npx next build`
Expected: clean; `/planning/appraisals` compiles.

- [ ] **Step 4: Commit**

```bash
git add app/planning/appraisals components/AppraisalsView.tsx
git commit -m "feat(dashboard): Appraisals tab (per-operator/machine from DB)"
```

---

### Task 6: Runs register dashboard tab

**Files:**
- Create: `app/planning/runs/page.tsx`
- Create: `components/RunsRegisterView.tsx`

**Interfaces:**
- Consumes: `listRuns({from,to})` (Task 2); `listMachines`/`listOperators` (catalog); `efficiency` (metrics).
- Produces: the runs register (one row per run, voids flagged, CSV, date range).

- [ ] **Step 1: Create the page `app/planning/runs/page.tsx`** (server)

```tsx
import { listRuns } from "@/lib/floor/runsRepo";
import { listMachines, listOperators } from "@/lib/floor/catalog";
import { efficiency } from "@/lib/floor/metrics";
import RunsRegisterView from "@/components/RunsRegisterView";
import FilterBar from "@/components/FilterBar";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

function monthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

export default async function RunsRegisterPage({
  searchParams,
}: {
  searchParams: { dateFrom?: string; dateTo?: string };
}) {
  const def = monthRange();
  const from = searchParams.dateFrom ?? def.from;
  const to = searchParams.dateTo ?? def.to;

  const [runs, machines, operators] = await Promise.all([
    listRuns({ from, to }),
    listMachines(),
    listOperators(),
  ]);
  const mName = new Map(machines.map((m) => [m.id, m.name]));
  const opName = new Map(operators.map((o) => [o.id, o.name]));

  const rows = runs.map((r) => ({
    id: r.id,
    date: r.date,
    shift: r.shift,
    machine: mName.get(r.machineId) ?? `#${r.machineId}`,
    operator: opName.get(r.operatorId) ?? `#${r.operatorId}`,
    product: r.productDesc,
    planned: r.plannedQty,
    actual: r.actualQty,
    efficiency: efficiency(r.actualQty, r.plannedQty),
    downtimeMin: r.downtimeMin,
    void: r.void,
    voidReason: r.voidReason,
  }));

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">Runs register</h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">
          Every logged machine run — one row each. Voided runs are flagged and excluded from appraisal totals.
        </p>
      </div>
      <Suspense>
        <FilterBar
          periodKeys={{ from: "dateFrom", to: "dateTo" }}
          filters={[
            { key: "dateFrom", label: "From", type: "date" },
            { key: "dateTo", label: "To", type: "date" },
          ]}
        />
      </Suspense>
      <RunsRegisterView rows={rows} range={{ from, to }} />
    </div>
  );
}
```

- [ ] **Step 2: Create `components/RunsRegisterView.tsx`** (client)

```tsx
"use client";

import ExportCsvButton from "@/components/ExportCsvButton";

interface Row {
  id: number; date: string; shift: string; machine: string; operator: string; product: string;
  planned: number | null; actual: number | null; efficiency: number | null; downtimeMin: number | null;
  void: boolean; voidReason: string | null;
}

const pct = (e: number | null) => (e == null ? "—" : `${Math.round(e * 100)}%`);
const num = (n: number | null) => (n == null ? "—" : Math.round(n).toLocaleString());

export default function RunsRegisterView({ rows, range }: { rows: Row[]; range: { from: string; to: string } }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-text-muted">{rows.filter((r) => !r.void).length} active · {rows.filter((r) => r.void).length} void</p>
        <ExportCsvButton filename={`runs-${range.from}_${range.to}`} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#e4ddd4]">
        <table className="min-w-full text-sm">
          <thead className="bg-[#f6f1ea] text-text-muted">
            <tr>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">Shift</th>
              <th className="text-left px-3 py-2">Machine</th>
              <th className="text-left px-3 py-2">Operator</th>
              <th className="text-left px-3 py-2">Product</th>
              <th className="text-right px-3 py-2">Planned</th>
              <th className="text-right px-3 py-2">Actual</th>
              <th className="text-right px-3 py-2">Efficiency</th>
              <th className="text-right px-3 py-2">Downtime</th>
              <th className="text-left px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={10} className="px-3 py-6 text-center text-text-muted">No runs in range.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className={`border-t border-[#efe8df] ${r.void ? "text-text-muted line-through" : "text-charcoal"}`}>
                <td className="px-3 py-2">{r.date}</td>
                <td className="px-3 py-2">{r.shift}</td>
                <td className="px-3 py-2">{r.machine}</td>
                <td className="px-3 py-2">{r.operator}</td>
                <td className="px-3 py-2">{r.product}</td>
                <td className="px-3 py-2 text-right">{num(r.planned)}</td>
                <td className="px-3 py-2 text-right">{num(r.actual)}</td>
                <td className="px-3 py-2 text-right">{pct(r.efficiency)}</td>
                <td className="px-3 py-2 text-right">{num(r.downtimeMin)}</td>
                <td className="px-3 py-2 no-underline">{r.void ? `Void — ${r.voidReason ?? ""}` : "Active"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build + typecheck**

Run: `npx tsc --noEmit && npx next build`
Expected: clean; `/planning/runs` compiles.

- [ ] **Step 4: Commit**

```bash
git add app/planning/runs components/RunsRegisterView.tsx
git commit -m "feat(dashboard): Runs register tab (from DB, voids flagged)"
```

---

### Task 7: SU04 compliance dashboard tab

**Files:**
- Create: `app/planning/compliance/page.tsx`
- Create: `components/ComplianceView.tsx`

**Interfaces:**
- Consumes: `listReadinessDaysInRange` (Task 4); `summarizeCompliance` (Task 3); a user-id→name map (queried in the page).
- Produces: the SU04 compliance view (per day, signers, denies amber-flagged, CSV, date range).

- [ ] **Step 1: Create the page `app/planning/compliance/page.tsx`** (server)

```tsx
import { listReadinessDaysInRange } from "@/lib/floor/readinessRepo";
import { summarizeCompliance } from "@/lib/floor/compliance";
import { getClient } from "@/lib/db/client";
import ComplianceView from "@/components/ComplianceView";
import FilterBar from "@/components/FilterBar";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

function monthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

export default async function CompliancePage({
  searchParams,
}: {
  searchParams: { dateFrom?: string; dateTo?: string };
}) {
  const def = monthRange();
  const from = searchParams.dateFrom ?? def.from;
  const to = searchParams.dateTo ?? def.to;

  const bundles = await listReadinessDaysInRange(from, to);
  const days = summarizeCompliance(bundles);

  const usersRes = await getClient().execute("SELECT id, name FROM users");
  const uName = new Map(usersRes.rows.map((r) => [r.id as number, r.name as string]));
  const name = (id: number | null) => (id == null ? "—" : uName.get(id) ?? `#${id}`);

  const rows = days.map((d) => ({
    ...d,
    startCompletedName: name(d.startCompletedBy),
    startCrossCheckName: name(d.startCrossCheckBy),
    endCompletedName: name(d.endCompletedBy),
    endCrossCheckName: name(d.endCrossCheckBy),
  }));

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">SU04 compliance</h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">
          Warehouse Start-Up checks by day — who completed and cross-checked each phase, and any denied items (flagged amber).
        </p>
      </div>
      <Suspense>
        <FilterBar
          periodKeys={{ from: "dateFrom", to: "dateTo" }}
          filters={[
            { key: "dateFrom", label: "From", type: "date" },
            { key: "dateTo", label: "To", type: "date" },
          ]}
        />
      </Suspense>
      <ComplianceView rows={rows} range={{ from, to }} />
    </div>
  );
}
```

- [ ] **Step 2: Create `components/ComplianceView.tsx`** (client)

```tsx
"use client";

import ExportCsvButton from "@/components/ExportCsvButton";

interface Deny { itemLabel: string; comment: string; critical: boolean; }
interface Row {
  date: string; status: string;
  total: number; startAnswered: number; endAnswered: number;
  startCompletedName: string; startCrossCheckName: string;
  endCompletedName: string; endCrossCheckName: string;
  startDenies: Deny[]; endDenies: Deny[]; hasDeny: boolean;
}

export default function ComplianceView({ rows, range }: { rows: Row[]; range: { from: string; to: string } }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-text-muted">{rows.length} day(s) · {rows.filter((r) => r.hasDeny).length} with denials</p>
        <ExportCsvButton filename={`su04-compliance-${range.from}_${range.to}`} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#e4ddd4]">
        <table className="min-w-full text-sm">
          <thead className="bg-[#f6f1ea] text-text-muted">
            <tr>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Start (by / cross-check)</th>
              <th className="text-right px-3 py-2">Start</th>
              <th className="text-left px-3 py-2">End (by / cross-check)</th>
              <th className="text-right px-3 py-2">End</th>
              <th className="text-left px-3 py-2">Denials</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-text-muted">No checklist days in range.</td></tr>}
            {rows.map((r) => {
              const denies = [...r.startDenies.map((d) => ({ ...d, phase: "Start" })), ...r.endDenies.map((d) => ({ ...d, phase: "End" }))];
              return (
                <tr key={r.date} className={`border-t border-[#efe8df] ${r.hasDeny ? "bg-amber-50" : ""}`}>
                  <td className="px-3 py-2 text-charcoal">{r.date}</td>
                  <td className="px-3 py-2 capitalize">{r.status}</td>
                  <td className="px-3 py-2">{r.startCompletedName} / {r.startCrossCheckName}</td>
                  <td className="px-3 py-2 text-right">{r.startAnswered}/{r.total}</td>
                  <td className="px-3 py-2">{r.endCompletedName} / {r.endCrossCheckName}</td>
                  <td className="px-3 py-2 text-right">{r.endAnswered}/{r.total}</td>
                  <td className="px-3 py-2">
                    {denies.length === 0 ? "—" : (
                      <ul className="space-y-0.5">
                        {denies.map((d, i) => (
                          <li key={i} className="text-amber-700">
                            {d.phase}: {d.itemLabel}{d.critical ? " (critical)" : ""} — {d.comment}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build + typecheck**

Run: `npx tsc --noEmit && npx next build`
Expected: clean; `/planning/compliance` compiles.

- [ ] **Step 4: Commit**

```bash
git add app/planning/compliance components/ComplianceView.tsx
git commit -m "feat(dashboard): SU04 compliance tab (from DB, denials flagged)"
```

---

### Task 8: Wire tabs + end-to-end verification + docs

**Files:**
- Modify: `components/InternalProductionTabs.tsx`
- Modify: `docs/supervisor-app-setup.md`

- [ ] **Step 1: Add the three tabs to `components/InternalProductionTabs.tsx`**

Replace the `tabs` array with:
```typescript
const tabs = [
  { href: "/planning", label: "Schedule" },
  { href: "/planning/performance", label: "Performance" },
  { href: "/planning/appraisals", label: "Appraisals" },
  { href: "/planning/runs", label: "Runs" },
  { href: "/planning/compliance", label: "SU04" },
  { href: "/planning/yield", label: "Yield" },
  { href: "/planning/readiness", label: "Readiness" },
  { href: "/planning/reports", label: "Reports" },
];
```
(The legacy sheet-based **Performance** tab stays for now; **Appraisals/Runs/SU04** are the new DB-backed views. Performance can be retired once the DB views are trusted — a later cleanup.)

- [ ] **Step 2: Full suite + typecheck + build**

Run:
```bash
npm test && npx tsc --noEmit && npx next build
```
Expected: all tests PASS (Phase 1/2 + Tasks 1–4 here); `tsc` clean; build succeeds with `/planning/appraisals`, `/planning/runs`, `/planning/compliance`.

- [ ] **Step 3: Seed a local DB with data and verify in the browser**

Seed + add a second supervisor + drive `/floor` to create at least one completed checklist day and one run (or reuse the Phase-2 verification DB). Then, in the Browser pane (desktop viewport):
1. `preview_start` the `wild-dash` dev server.
2. Navigate to `/planning/appraisals` → the operator/machine tables show the logged run(s), efficiency %, voids excluded. Change the date range → totals update.
3. Navigate to `/planning/runs` → one row per run; a voided run shows struck-through with its reason and is not in the active count.
4. Navigate to `/planning/compliance` → the day appears with start signer + cross-check names and start `15/15`; a denied item row is amber with its comment.
Capture a screenshot of each as proof.

- [ ] **Step 4: Append the Phase-3 section to `docs/supervisor-app-setup.md`**

```markdown

## Phase 3 — Dashboard reflection
Internal Production tabs that read the standalone Turso DB (read-only):
- **Appraisals** (`/planning/appraisals`) — per-operator & per-machine output, efficiency,
  throughput, downtime, days worked; date-range filter; CSV. Voids excluded.
- **Runs** (`/planning/runs`) — one row per logged run; voided runs struck-through with reason,
  excluded from active totals; CSV.
- **SU04** (`/planning/compliance`) — each day's start/end signers + cross-checks, answered
  counts, and any denied items (amber, with comments); CSV.
The dashboard is unauthenticated like the rest of the app; only `/floor` writes data.
The legacy sheet-based **Performance** tab remains until the DB views are trusted.
```

- [ ] **Step 5: Commit**

```bash
git add components/InternalProductionTabs.tsx docs/supervisor-app-setup.md
git commit -m "feat(dashboard): wire Appraisals/Runs/SU04 tabs + docs"
```

---

## Phase 3 Self-Review

- **Spec coverage (§8):** Performance/Appraisals per-operator + per-machine with efficiency/throughput/downtime + date range + CSV ✓ Tasks 1/2/5; Runs register one row per run, voids flagged + excluded from totals, exportable ✓ Tasks 2/6; SU04 compliance per-day signers + cross-checks + Denies amber-flagged + export ✓ Tasks 3/4/7; Yield/Reports unchanged ✓ (untouched); dashboard read-only over the DB ✓ (no writes, no auth change). Deferred: retiring the legacy sheet Performance tab (kept intentionally); admin CRUD = Phase 4.
- **Placeholder scan:** none — every step has runnable code/commands.
- **Type consistency:** `OperatorAppraisal`/`MachineAppraisal` (Task 1) reused verbatim in Task 5; `DayBundle`/`ComplianceDay`/`Deny` (Task 3) reused in Tasks 4/7; `listRuns({from,to})` (Task 2) called consistently in Tasks 5/6; `listReadinessDaysInRange` returns the Phase-2 `ReadinessDayView` shape consumed by `summarizeCompliance`. `efficiency`/`throughput` reused from Phase-1 `metrics.ts`.

## Follow-on plans (not this document)
- **Phase 4:** Admin UI — manage `users` (create/deactivate, reset password), `operators`, `machines`, and SU04 `checklist_templates`/`checklist_items` (new versions), all writing `audit_log`.
