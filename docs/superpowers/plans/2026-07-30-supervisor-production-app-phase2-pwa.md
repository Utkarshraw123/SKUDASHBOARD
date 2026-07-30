# Supervisor Production App — Phase 2: Supervisor PWA (SU04 flow, run logging, audit, install) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give supervisors a mobile-first, installable PWA at `/floor` to complete the SU04 Start/End-of-Day checklist and log per-machine production runs, with server-computed efficiency, per-entry attribution, editable/void-able records, and a full audit trail.

**Architecture:** Pure domain logic (metrics, checklist rules, audit diffing, validation) is unit-tested offline with vitest. Server-only repository modules wrap the Phase-1 libSQL client for runs and readiness, writing an `audit_log` row on every mutation. Thin API route handlers under `/api/floor/*` guard by session (Phase-1 `requireUser`), validate input, stamp `logged_by`, and delegate to the repositories. A mobile-first client UI under `/floor` consumes those routes; a web manifest + a dedicated `/floor` layout make it installable and chrome-free.

**Tech Stack:** Next.js 14.2.5 App Router (TypeScript), Phase-1 `@libsql/client` + auth, `vitest`. No new dependencies.

## Global Constraints

- **Builds on Phase 1** — reuse exactly: `getClient()` (`lib/db/client.ts`), `applySchema` (`lib/db/migrate.ts`), `hashPassword`/`verifyPassword`, `createSession`/`getSessionUser`/`destroySession` + `SessionUser`/`Role` + `SESSION_COOKIE`, `getCurrentUser`/`requireUser`/`requireRole`, `authenticate`. Do not redefine these.
- **Standalone DB** — same standalone Turso DB as Phase 1; no new env vars; nothing shared with practitioner-portal.
- **Server is the source of trust** — the client submits raw numbers; the server validates, computes efficiency/throughput, and stamps `logged_by` + timestamps. Never trust a client-sent efficiency or `logged_by`.
- **DB access is server-only** — never import `lib/db/client.ts` or `lib/floor/*Repo` modules into a client component. Client components talk to the API routes via `fetch`.
- **libSQL access pattern:** `client.execute({ sql, args })`; rows in `res.rows` (objects keyed by column). `RETURNING id` yields the new id in `res.rows[0].id`. Use `?` placeholders, never string interpolation.
- **Timestamps:** ISO-8601 UTC strings (`new Date().toISOString()`). **Dates** (a production day) are `YYYY-MM-DD`.
- **Efficiency is derived, never stored** (`actual_qty / planned_qty`); throughput derived from times minus downtime.
- **Soft delete only** — runs are voided (`void=1` + reason + `voided_by`/`voided_at`), never `DELETE`d. GMP/production records stay auditable.
- **Deny requires a non-empty comment** (server-enforced). **Cross-check must be a different user** than the phase completer (server-enforced).
- **Route prefixes:** supervisor UI under `/floor`; API under `/api/floor/*`.
- **Tests** run with `npm test` (vitest); DB tests use Phase-1's `freshTestDb()` from `test/setup-db.ts` (private in-memory DB per call).

---

## File Structure

**Created — pure logic (unit-tested, no DB):**
- `lib/floor/types.ts` — shared TS types for runs, readiness, checklist, metrics.
- `lib/floor/metrics.ts` — `efficiency`, `effectiveHours`, `throughput`, `summarizeRuns`.
- `lib/floor/checklist.ts` — `checklistProgress`, `validateCheckResult`, `phaseComplete`, `canLogRuns`.
- `lib/floor/audit.ts` — `diffFields`.
- `lib/floor/validate.ts` — `validateRunInput`.

**Created — server repositories (DB, integration-tested):**
- `lib/floor/runsRepo.ts` — `createRun`, `getRun`, `listRuns`, `updateRun`, `voidRun` (+ audit writes).
- `lib/floor/readinessRepo.ts` — `getOrCreateDay`, `getDayChecks`, `saveCheck`, `completePhase`.
- `lib/floor/catalog.ts` — `listMachines`, `listOperators`, `listSkuOptions` (SKUs via `fetchSkus`).

**Created — API routes:**
- `app/api/floor/catalog/route.ts` — GET machines + operators + SKU options.
- `app/api/floor/runs/route.ts` — GET (list by date) + POST (create).
- `app/api/floor/runs/[id]/route.ts` — PATCH (edit).
- `app/api/floor/runs/[id]/void/route.ts` — POST (void).
- `app/api/floor/readiness/route.ts` — GET (day + items + checks for a date).
- `app/api/floor/readiness/check/route.ts` — POST (save one item result).
- `app/api/floor/readiness/complete/route.ts` — POST (complete a phase with cross-check).

**Created — UI:**
- `app/floor/layout.tsx` — floor shell: full-screen, PWA meta, replaces the Phase-1 overlay hack.
- `app/floor/page.tsx` — day home (server): SU04 status + entry points.
- `app/floor/checklist/[phase]/page.tsx` + `components/floor/ChecklistForm.tsx` — SU04 start/end flow.
- `app/floor/runs/page.tsx` + `components/floor/RunLogger.tsx` — run list + new/edit run.
- `components/floor/LogoutButton.tsx` — client logout (POST + redirect).

**Created — PWA:**
- `public/manifest.webmanifest`, `public/icons/icon-192.png`, `public/icons/icon-512.png`.

**Modified:**
- `app/floor/login/page.tsx` — drop the `fixed inset-0` overlay hack now that `/floor` has its own layout (keep centered card).
- `lib/db/seed.ts` — (Task 12 only) optionally seed a demo supervisor for manual testing.

**Interfaces produced (Phase 3 dashboard relies on these):**
- `summarizeRuns(runs: Run[]): RunTotals`, `efficiency`, `throughput` — `lib/floor/metrics.ts`.
- `listRuns(opts): Promise<Run[]>` — `lib/floor/runsRepo.ts`.
- `getDayChecks(date): Promise<ReadinessDayView>` — `lib/floor/readinessRepo.ts`.

---

### Task 1: Domain types + metrics (pure)

**Files:**
- Create: `lib/floor/types.ts`
- Create: `lib/floor/metrics.ts`
- Test: `lib/floor/__tests__/metrics.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: types `Run`, `RunInput`, `RunTotals`, `ChecklistItem`, `ReadinessCheck`, `ReadinessDay`, `Phase`; functions `efficiency(actual, planned)`, `effectiveHours(start, end, downtimeMin)`, `throughput(actual, start, end, downtimeMin)`, `summarizeRuns(runs)`.

- [ ] **Step 1: Write `lib/floor/types.ts`**

```typescript
export type Phase = "start" | "end";
export type CheckResult = "confirm" | "deny";

export interface Run {
  id: number;
  date: string;          // YYYY-MM-DD
  shift: string;
  machineId: number;
  operatorId: number;
  productSku: string;
  productDesc: string;
  plannedQty: number | null;
  actualQty: number | null;
  startTime: string | null;   // ISO or HH:MM
  endTime: string | null;
  downtimeMin: number | null;
  comments: string | null;
  loggedBy: number;
  createdAt: string;
  updatedAt: string;
  void: boolean;
  voidReason: string | null;
  voidedBy: number | null;
  voidedAt: string | null;
}

// Client-submitted fields for create/edit (server stamps identity + timestamps).
export interface RunInput {
  date: string;
  shift: string;
  machineId: number;
  operatorId: number;
  productSku: string;
  productDesc: string;
  plannedQty: number | null;
  actualQty: number | null;
  startTime: string | null;
  endTime: string | null;
  downtimeMin: number | null;
  comments: string | null;
}

export interface RunTotals {
  runCount: number;       // non-void runs
  totalActual: number;
  totalPlanned: number;
  avgEfficiency: number | null;   // totalActual / totalPlanned
  totalDowntimeMin: number;
  perOperator: { operatorId: number; actual: number; planned: number; efficiency: number | null }[];
}

export interface ChecklistItem {
  id: number;
  sortOrder: number;
  category: string;
  label: string;
  critical: boolean;
}

export interface ReadinessCheck {
  itemId: number;
  phase: Phase;
  result: CheckResult;
  comment: string | null;
  checkedBy: number;
  checkedAt: string;
}

export interface ReadinessDay {
  id: number;
  date: string;
  templateId: number;
  startCompletedBy: number | null;
  startCompletedAt: string | null;
  startCrossCheckBy: number | null;
  endCompletedBy: number | null;
  endCompletedAt: string | null;
  endCrossCheckBy: number | null;
  status: "open" | "started" | "closed";
}
```

- [ ] **Step 2: Write the failing test**

Create `lib/floor/__tests__/metrics.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { efficiency, effectiveHours, throughput, summarizeRuns } from "../metrics";
import type { Run } from "../types";

function run(partial: Partial<Run>): Run {
  return {
    id: 1, date: "2026-07-30", shift: "1", machineId: 1, operatorId: 1,
    productSku: "30000001", productDesc: "X", plannedQty: 100, actualQty: 90,
    startTime: "2026-07-30T06:00:00Z", endTime: "2026-07-30T10:00:00Z",
    downtimeMin: 0, comments: null, loggedBy: 1,
    createdAt: "", updatedAt: "", void: false,
    voidReason: null, voidedBy: null, voidedAt: null, ...partial,
  };
}

describe("efficiency", () => {
  it("is actual/planned", () => expect(efficiency(90, 100)).toBeCloseTo(0.9));
  it("is null when planned is 0 or missing", () => {
    expect(efficiency(90, 0)).toBeNull();
    expect(efficiency(90, null)).toBeNull();
    expect(efficiency(null, 100)).toBeNull();
  });
});

describe("effectiveHours", () => {
  it("subtracts downtime from elapsed", () => {
    expect(effectiveHours("2026-07-30T06:00:00Z", "2026-07-30T10:00:00Z", 30)).toBeCloseTo(3.5);
  });
  it("is null when times missing or end < start", () => {
    expect(effectiveHours(null, "2026-07-30T10:00:00Z", 0)).toBeNull();
    expect(effectiveHours("2026-07-30T10:00:00Z", "2026-07-30T06:00:00Z", 0)).toBeNull();
  });
});

describe("throughput", () => {
  it("is actual per effective hour", () => {
    expect(throughput(350, "2026-07-30T06:00:00Z", "2026-07-30T10:00:00Z", 30)).toBeCloseTo(100);
  });
  it("is null when effective hours is 0 or null", () => {
    expect(throughput(350, "2026-07-30T06:00:00Z", "2026-07-30T06:00:00Z", 0)).toBeNull();
  });
});

describe("summarizeRuns", () => {
  it("excludes void runs and totals per operator", () => {
    const runs = [
      run({ id: 1, operatorId: 10, actualQty: 90, plannedQty: 100, downtimeMin: 10 }),
      run({ id: 2, operatorId: 20, actualQty: 40, plannedQty: 50, downtimeMin: 5 }),
      run({ id: 3, operatorId: 10, actualQty: 999, plannedQty: 999, void: true }),
    ];
    const t = summarizeRuns(runs);
    expect(t.runCount).toBe(2);
    expect(t.totalActual).toBe(130);
    expect(t.totalPlanned).toBe(150);
    expect(t.avgEfficiency).toBeCloseTo(130 / 150);
    expect(t.totalDowntimeMin).toBe(15);
    expect(t.perOperator.find((p) => p.operatorId === 10)!.actual).toBe(90);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run lib/floor/__tests__/metrics.test.ts`
Expected: FAIL — cannot find module `../metrics`.

- [ ] **Step 4: Implement `lib/floor/metrics.ts`**

```typescript
import type { Run, RunTotals } from "./types";

export function efficiency(actual: number | null, planned: number | null): number | null {
  if (actual == null || planned == null || planned === 0) return null;
  return actual / planned;
}

export function effectiveHours(
  start: string | null,
  end: string | null,
  downtimeMin: number | null,
): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const hours = ms / 3.6e6 - (downtimeMin ?? 0) / 60;
  return hours > 0 ? hours : null;
}

export function throughput(
  actual: number | null,
  start: string | null,
  end: string | null,
  downtimeMin: number | null,
): number | null {
  const h = effectiveHours(start, end, downtimeMin);
  if (actual == null || h == null || h === 0) return null;
  return actual / h;
}

export function summarizeRuns(runs: Run[]): RunTotals {
  const live = runs.filter((r) => !r.void);
  const byOp = new Map<number, { actual: number; planned: number }>();
  let totalActual = 0;
  let totalPlanned = 0;
  let totalDowntimeMin = 0;
  for (const r of live) {
    const a = r.actualQty ?? 0;
    const p = r.plannedQty ?? 0;
    totalActual += a;
    totalPlanned += p;
    totalDowntimeMin += r.downtimeMin ?? 0;
    const acc = byOp.get(r.operatorId) ?? { actual: 0, planned: 0 };
    acc.actual += a;
    acc.planned += p;
    byOp.set(r.operatorId, acc);
  }
  return {
    runCount: live.length,
    totalActual,
    totalPlanned,
    avgEfficiency: efficiency(totalActual, totalPlanned),
    totalDowntimeMin,
    perOperator: [...byOp.entries()].map(([operatorId, v]) => ({
      operatorId,
      actual: v.actual,
      planned: v.planned,
      efficiency: efficiency(v.actual, v.planned),
    })),
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run lib/floor/__tests__/metrics.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/floor/types.ts lib/floor/metrics.ts lib/floor/__tests__/metrics.test.ts
git commit -m "feat(floor): domain types + run metrics (efficiency/throughput/totals)"
```

---

### Task 2: Checklist rules (pure)

**Files:**
- Create: `lib/floor/checklist.ts`
- Test: `lib/floor/__tests__/checklist.test.ts`

**Interfaces:**
- Consumes: types from Task 1.
- Produces: `checklistProgress(items, checks, phase)`, `validateCheckResult(result, comment)`, `phaseComplete(items, checks, phase)`, `canLogRuns(day)`.

- [ ] **Step 1: Write the failing test**

Create `lib/floor/__tests__/checklist.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { checklistProgress, validateCheckResult, phaseComplete, canLogRuns } from "../checklist";
import type { ChecklistItem, ReadinessCheck, ReadinessDay } from "../types";

const items: ChecklistItem[] = [
  { id: 1, sortOrder: 1, category: "Env", label: "A", critical: false },
  { id: 2, sortOrder: 2, category: "Env", label: "B", critical: true },
];
function check(p: Partial<ReadinessCheck>): ReadinessCheck {
  return { itemId: 1, phase: "start", result: "confirm", comment: null, checkedBy: 1, checkedAt: "", ...p };
}

describe("checklistProgress", () => {
  it("counts done/total and flags denies + missing-critical", () => {
    const checks = [check({ itemId: 1, result: "deny", comment: "x" })];
    const p = checklistProgress(items, checks, "start");
    expect(p.done).toBe(1);
    expect(p.total).toBe(2);
    expect(p.denyCount).toBe(1);
    expect(p.complete).toBe(false);
  });
  it("is complete when every item has a result for the phase", () => {
    const checks = [check({ itemId: 1 }), check({ itemId: 2 })];
    expect(checklistProgress(items, checks, "start").complete).toBe(true);
  });
  it("ignores checks from the other phase", () => {
    const checks = [check({ itemId: 1, phase: "end" }), check({ itemId: 2, phase: "end" })];
    expect(checklistProgress(items, checks, "start").done).toBe(0);
  });
});

describe("validateCheckResult", () => {
  it("requires a comment on deny", () => {
    expect(validateCheckResult("deny", "")).toBe("A comment is required when denying an item.");
    expect(validateCheckResult("deny", "spill")).toBeNull();
    expect(validateCheckResult("confirm", "")).toBeNull();
  });
});

describe("phaseComplete / canLogRuns", () => {
  it("phaseComplete mirrors progress.complete", () => {
    const checks = [check({ itemId: 1 }), check({ itemId: 2 })];
    expect(phaseComplete(items, checks, "start")).toBe(true);
  });
  it("canLogRuns true only when start phase is completed on the day", () => {
    const open: ReadinessDay = {
      id: 1, date: "2026-07-30", templateId: 1, startCompletedBy: null, startCompletedAt: null,
      startCrossCheckBy: null, endCompletedBy: null, endCompletedAt: null, endCrossCheckBy: null, status: "open",
    };
    expect(canLogRuns(open)).toBe(false);
    expect(canLogRuns({ ...open, startCompletedBy: 1, startCrossCheckBy: 2, status: "started" })).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/floor/__tests__/checklist.test.ts`
Expected: FAIL — cannot find module `../checklist`.

- [ ] **Step 3: Implement `lib/floor/checklist.ts`**

```typescript
import type { ChecklistItem, ReadinessCheck, ReadinessDay, Phase, CheckResult } from "./types";

export interface ChecklistProgress {
  done: number;
  total: number;
  denyCount: number;
  complete: boolean;
}

export function checklistProgress(
  items: ChecklistItem[],
  checks: ReadinessCheck[],
  phase: Phase,
): ChecklistProgress {
  const phaseChecks = checks.filter((c) => c.phase === phase);
  const answered = new Set(phaseChecks.map((c) => c.itemId));
  const denyCount = phaseChecks.filter((c) => c.result === "deny").length;
  const done = items.filter((i) => answered.has(i.id)).length;
  return { done, total: items.length, denyCount, complete: done === items.length && items.length > 0 };
}

export function validateCheckResult(result: CheckResult, comment: string): string | null {
  if (result === "deny" && comment.trim() === "") {
    return "A comment is required when denying an item.";
  }
  return null;
}

export function phaseComplete(items: ChecklistItem[], checks: ReadinessCheck[], phase: Phase): boolean {
  return checklistProgress(items, checks, phase).complete;
}

// Runs may be logged once the Start phase is signed off (a completer + a cross-check).
export function canLogRuns(day: ReadinessDay): boolean {
  return day.startCompletedBy != null && day.startCrossCheckBy != null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/floor/__tests__/checklist.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/floor/checklist.ts lib/floor/__tests__/checklist.test.ts
git commit -m "feat(floor): checklist progress + deny/gate rules"
```

---

### Task 3: Audit diffing + run validation (pure)

**Files:**
- Create: `lib/floor/audit.ts`
- Create: `lib/floor/validate.ts`
- Test: `lib/floor/__tests__/audit.test.ts`
- Test: `lib/floor/__tests__/validate.test.ts`

**Interfaces:**
- Consumes: types from Task 1.
- Produces: `diffFields(before, after, fields)` → `{ field, old, new }[]`; `validateRunInput(input)` → `string[]`.

- [ ] **Step 1: Write the failing tests**

Create `lib/floor/__tests__/audit.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { diffFields } from "../audit";

describe("diffFields", () => {
  it("returns only changed fields as string old/new", () => {
    const before = { actualQty: 90, comments: "ok", plannedQty: 100 };
    const after = { actualQty: 95, comments: "ok", plannedQty: 100 };
    expect(diffFields(before, after, ["actualQty", "comments", "plannedQty"])).toEqual([
      { field: "actualQty", old: "90", new: "95" },
    ]);
  });
  it("treats null/undefined as empty string", () => {
    expect(diffFields({ a: null }, { a: 5 }, ["a"])).toEqual([{ field: "a", old: "", new: "5" }]);
  });
});
```

Create `lib/floor/__tests__/validate.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { validateRunInput } from "../validate";
import type { RunInput } from "../types";

function input(p: Partial<RunInput> = {}): RunInput {
  return {
    date: "2026-07-30", shift: "1", machineId: 1, operatorId: 1,
    productSku: "30000001", productDesc: "X", plannedQty: 100, actualQty: 90,
    startTime: "2026-07-30T06:00:00Z", endTime: "2026-07-30T10:00:00Z",
    downtimeMin: 0, comments: null, ...p,
  };
}

describe("validateRunInput", () => {
  it("passes a well-formed run", () => expect(validateRunInput(input())).toEqual([]));
  it("requires date, shift, machine, operator, product", () => {
    const errs = validateRunInput(input({ date: "", shift: "", machineId: 0, operatorId: 0, productSku: "" }));
    expect(errs.length).toBeGreaterThanOrEqual(4);
  });
  it("rejects negatives and end<start", () => {
    expect(validateRunInput(input({ actualQty: -1 }))).toContain("Actual quantity must be 0 or more.");
    expect(validateRunInput(input({ plannedQty: -5 }))).toContain("Planned quantity must be 0 or more.");
    expect(validateRunInput(input({ downtimeMin: -1 }))).toContain("Downtime must be 0 or more.");
    expect(validateRunInput(input({ startTime: "2026-07-30T10:00:00Z", endTime: "2026-07-30T06:00:00Z" })))
      .toContain("End time must be after start time.");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/floor/__tests__/audit.test.ts lib/floor/__tests__/validate.test.ts`
Expected: FAIL — cannot find modules `../audit`, `../validate`.

- [ ] **Step 3: Implement `lib/floor/audit.ts`**

```typescript
export interface FieldDiff {
  field: string;
  old: string;
  new: string;
}

function asStr(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  fields: (keyof T)[],
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const f of fields) {
    const o = asStr(before[f]);
    const n = asStr(after[f]);
    if (o !== n) diffs.push({ field: String(f), old: o, new: n });
  }
  return diffs;
}
```

- [ ] **Step 4: Implement `lib/floor/validate.ts`**

```typescript
import type { RunInput } from "./types";

export function validateRunInput(input: RunInput): string[] {
  const errs: string[] = [];
  if (!input.date) errs.push("Date is required.");
  if (!input.shift) errs.push("Shift is required.");
  if (!input.machineId) errs.push("Machine is required.");
  if (!input.operatorId) errs.push("Operator is required.");
  if (!input.productSku) errs.push("Product is required.");
  if (input.actualQty != null && input.actualQty < 0) errs.push("Actual quantity must be 0 or more.");
  if (input.plannedQty != null && input.plannedQty < 0) errs.push("Planned quantity must be 0 or more.");
  if (input.downtimeMin != null && input.downtimeMin < 0) errs.push("Downtime must be 0 or more.");
  if (input.startTime && input.endTime && new Date(input.endTime) <= new Date(input.startTime)) {
    errs.push("End time must be after start time.");
  }
  return errs;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run lib/floor/__tests__/audit.test.ts lib/floor/__tests__/validate.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/floor/audit.ts lib/floor/validate.ts lib/floor/__tests__/audit.test.ts lib/floor/__tests__/validate.test.ts
git commit -m "feat(floor): audit field-diffing + run-input validation"
```

---

### Task 4: Runs repository (create / get / list / update / void + audit)

**Files:**
- Create: `lib/floor/runsRepo.ts`
- Test: `lib/floor/__tests__/runsRepo.test.ts`

**Interfaces:**
- Consumes: `getClient` (Phase 1); `Run`, `RunInput` (Task 1); `diffFields` (Task 3).
- Produces: `createRun(input, userId)`, `getRun(id)`, `listRuns({ date? })`, `updateRun(id, input, userId)`, `voidRun(id, reason, userId)`; all write `audit_log`.

- [ ] **Step 1: Write the failing test**

Create `lib/floor/__tests__/runsRepo.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { freshTestDb } from "@/test/setup-db";
import { createRun, getRun, listRuns, updateRun, voidRun } from "../runsRepo";
import type { RunInput } from "../types";

async function seedRefs() {
  const { getClient } = await import("@/lib/db/client");
  const now = new Date().toISOString();
  await getClient().execute({ sql: "INSERT INTO users (username,password_hash,name,role,active,created_at) VALUES ('sup','x','Sup','supervisor',1,?)", args: [now] });
  await getClient().execute({ sql: "INSERT INTO machines (name,active,created_at) VALUES ('M1',1,?)", args: [now] });
  await getClient().execute({ sql: "INSERT INTO operators (name,active,created_at) VALUES ('Op1',1,?)", args: [now] });
}

function input(p: Partial<RunInput> = {}): RunInput {
  return {
    date: "2026-07-30", shift: "1", machineId: 1, operatorId: 1,
    productSku: "30000001", productDesc: "Iron", plannedQty: 100, actualQty: 90,
    startTime: "2026-07-30T06:00:00Z", endTime: "2026-07-30T10:00:00Z",
    downtimeMin: 0, comments: null, ...p,
  };
}

describe("runsRepo", () => {
  it("creates a run, stamps logged_by, and writes a create audit row", async () => {
    await freshTestDb();
    await seedRefs();
    const id = await createRun(input(), 1);
    const run = await getRun(id);
    expect(run!.actualQty).toBe(90);
    expect(run!.loggedBy).toBe(1);
    expect(run!.void).toBe(false);
    const { getClient } = await import("@/lib/db/client");
    const audit = await getClient().execute("SELECT * FROM audit_log WHERE entity='run' AND action='create'");
    expect(audit.rows.length).toBe(1);
  });

  it("lists runs for a date", async () => {
    await freshTestDb();
    await seedRefs();
    await createRun(input({ date: "2026-07-30" }), 1);
    await createRun(input({ date: "2026-07-31" }), 1);
    expect((await listRuns({ date: "2026-07-30" })).length).toBe(1);
    expect((await listRuns({})).length).toBe(2);
  });

  it("updates a run and writes one audit row per changed field", async () => {
    await freshTestDb();
    await seedRefs();
    const id = await createRun(input({ actualQty: 90 }), 1);
    await updateRun(id, input({ actualQty: 95, comments: "reweighed" }), 1);
    const run = await getRun(id);
    expect(run!.actualQty).toBe(95);
    const { getClient } = await import("@/lib/db/client");
    const audit = await getClient().execute("SELECT field FROM audit_log WHERE entity='run' AND action='update'");
    const fields = audit.rows.map((r) => r.field);
    expect(fields).toContain("actualQty");
    expect(fields).toContain("comments");
  });

  it("voids a run softly (excluded from totals, still present) and audits it", async () => {
    await freshTestDb();
    await seedRefs();
    const id = await createRun(input(), 1);
    await voidRun(id, "duplicate", 1);
    const run = await getRun(id);
    expect(run!.void).toBe(true);
    expect(run!.voidReason).toBe("duplicate");
    const { getClient } = await import("@/lib/db/client");
    const audit = await getClient().execute("SELECT * FROM audit_log WHERE entity='run' AND action='void'");
    expect(audit.rows.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/floor/__tests__/runsRepo.test.ts`
Expected: FAIL — cannot find module `../runsRepo`.

- [ ] **Step 3: Implement `lib/floor/runsRepo.ts`**

```typescript
import { getClient } from "@/lib/db/client";
import type { Run, RunInput } from "./types";
import { diffFields } from "./audit";

const AUDITED_FIELDS: (keyof RunInput)[] = [
  "date", "shift", "machineId", "operatorId", "productSku", "productDesc",
  "plannedQty", "actualQty", "startTime", "endTime", "downtimeMin", "comments",
];

function rowToRun(r: Record<string, unknown>): Run {
  return {
    id: r.id as number,
    date: r.date as string,
    shift: r.shift as string,
    machineId: r.machine_id as number,
    operatorId: r.operator_id as number,
    productSku: r.product_sku as string,
    productDesc: r.product_desc as string,
    plannedQty: (r.planned_qty as number) ?? null,
    actualQty: (r.actual_qty as number) ?? null,
    startTime: (r.start_time as string) ?? null,
    endTime: (r.end_time as string) ?? null,
    downtimeMin: (r.downtime_min as number) ?? null,
    comments: (r.comments as string) ?? null,
    loggedBy: r.logged_by as number,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    void: !!(r.void as number),
    voidReason: (r.void_reason as string) ?? null,
    voidedBy: (r.voided_by as number) ?? null,
    voidedAt: (r.voided_at as string) ?? null,
  };
}

async function writeAudit(
  entityId: number,
  action: "create" | "update" | "void",
  field: string | null,
  oldVal: string | null,
  newVal: string | null,
  userId: number,
): Promise<void> {
  await getClient().execute({
    sql: `INSERT INTO audit_log (entity, entity_id, action, field, old_value, new_value, changed_by, changed_at)
          VALUES ('run', ?, ?, ?, ?, ?, ?, ?)`,
    args: [entityId, action, field, oldVal, newVal, userId, new Date().toISOString()],
  });
}

export async function createRun(input: RunInput, userId: number): Promise<number> {
  const now = new Date().toISOString();
  const res = await getClient().execute({
    sql: `INSERT INTO runs
      (date, shift, machine_id, operator_id, product_sku, product_desc,
       planned_qty, actual_qty, start_time, end_time, downtime_min, comments,
       logged_by, created_at, updated_at, void)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0) RETURNING id`,
    args: [
      input.date, input.shift, input.machineId, input.operatorId, input.productSku, input.productDesc,
      input.plannedQty, input.actualQty, input.startTime, input.endTime, input.downtimeMin, input.comments,
      userId, now, now,
    ],
  });
  const id = res.rows[0].id as number;
  await writeAudit(id, "create", null, null, null, userId);
  return id;
}

export async function getRun(id: number): Promise<Run | null> {
  const res = await getClient().execute({ sql: "SELECT * FROM runs WHERE id = ?", args: [id] });
  return res.rows[0] ? rowToRun(res.rows[0] as Record<string, unknown>) : null;
}

export async function listRuns(opts: { date?: string } = {}): Promise<Run[]> {
  const res = opts.date
    ? await getClient().execute({ sql: "SELECT * FROM runs WHERE date = ? ORDER BY id DESC", args: [opts.date] })
    : await getClient().execute("SELECT * FROM runs ORDER BY id DESC");
  return res.rows.map((r) => rowToRun(r as Record<string, unknown>));
}

export async function updateRun(id: number, input: RunInput, userId: number): Promise<void> {
  const before = await getRun(id);
  if (!before) throw new Error(`Run ${id} not found`);
  const now = new Date().toISOString();
  await getClient().execute({
    sql: `UPDATE runs SET date=?, shift=?, machine_id=?, operator_id=?, product_sku=?, product_desc=?,
      planned_qty=?, actual_qty=?, start_time=?, end_time=?, downtime_min=?, comments=?, updated_at=?
      WHERE id=?`,
    args: [
      input.date, input.shift, input.machineId, input.operatorId, input.productSku, input.productDesc,
      input.plannedQty, input.actualQty, input.startTime, input.endTime, input.downtimeMin, input.comments,
      now, id,
    ],
  });
  const beforeInput: RunInput = {
    date: before.date, shift: before.shift, machineId: before.machineId, operatorId: before.operatorId,
    productSku: before.productSku, productDesc: before.productDesc, plannedQty: before.plannedQty,
    actualQty: before.actualQty, startTime: before.startTime, endTime: before.endTime,
    downtimeMin: before.downtimeMin, comments: before.comments,
  };
  const diffs = diffFields(
    beforeInput as unknown as Record<string, unknown>,
    input as unknown as Record<string, unknown>,
    AUDITED_FIELDS as unknown as string[],
  );
  for (const d of diffs) await writeAudit(id, "update", d.field, d.old, d.new, userId);
}

export async function voidRun(id: number, reason: string, userId: number): Promise<void> {
  const now = new Date().toISOString();
  await getClient().execute({
    sql: "UPDATE runs SET void=1, void_reason=?, voided_by=?, voided_at=? WHERE id=?",
    args: [reason, userId, now, id],
  });
  await writeAudit(id, "void", "void", "0", "1", userId);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/floor/__tests__/runsRepo.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/floor/runsRepo.ts lib/floor/__tests__/runsRepo.test.ts
git commit -m "feat(floor): runs repository with soft-void + field-level audit"
```

---

### Task 5: Readiness repository (day, checks, complete-phase with cross-check)

**Files:**
- Create: `lib/floor/readinessRepo.ts`
- Test: `lib/floor/__tests__/readinessRepo.test.ts`

**Interfaces:**
- Consumes: `getClient` (Phase 1); types (Task 1); `validateCheckResult`, `phaseComplete` (Task 2).
- Produces: `getOrCreateDay(date)`, `getDayChecks(date)` → `ReadinessDayView`, `saveCheck(date, input, userId)`, `completePhase(date, phase, completerId, crossCheckId)`.

- [ ] **Step 1: Write the failing test**

Create `lib/floor/__tests__/readinessRepo.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { freshTestDb } from "@/test/setup-db";
import { seed } from "@/lib/db/seed";
import { getOrCreateDay, getDayChecks, saveCheck, completePhase } from "../readinessRepo";

async function twoUsers() {
  const { getClient } = await import("@/lib/db/client");
  const now = new Date().toISOString();
  await getClient().execute({ sql: "INSERT INTO users (username,password_hash,name,role,active,created_at) VALUES ('a','x','A','supervisor',1,?)", args: [now] });
  await getClient().execute({ sql: "INSERT INTO users (username,password_hash,name,role,active,created_at) VALUES ('b','x','B','supervisor',1,?)", args: [now] });
}

describe("readinessRepo", () => {
  it("creates a day bound to the active SU04 template", async () => {
    const db = await freshTestDb();
    await seed(db, { adminPassword: "x" });
    const day = await getOrCreateDay("2026-07-30");
    expect(day.date).toBe("2026-07-30");
    expect(day.status).toBe("open");
    // second call returns the same row
    expect((await getOrCreateDay("2026-07-30")).id).toBe(day.id);
  });

  it("saves a check and rejects a deny without comment", async () => {
    const db = await freshTestDb();
    await seed(db, { adminPassword: "x" });
    await twoUsers();
    const view = await getDayChecks("2026-07-30");
    const first = view.items[0];
    await expect(saveCheck("2026-07-30", { itemId: first.id, phase: "start", result: "deny", comment: "" }, 2))
      .rejects.toThrow(/comment is required/i);
    await saveCheck("2026-07-30", { itemId: first.id, phase: "start", result: "confirm", comment: null }, 2);
    const after = await getDayChecks("2026-07-30");
    expect(after.checks.find((c) => c.itemId === first.id && c.phase === "start")!.result).toBe("confirm");
  });

  it("completes a phase only when all items answered and cross-check differs", async () => {
    const db = await freshTestDb();
    await seed(db, { adminPassword: "x" });
    await twoUsers();
    const view = await getDayChecks("2026-07-30");
    for (const it of view.items) {
      await saveCheck("2026-07-30", { itemId: it.id, phase: "start", result: "confirm", comment: null }, 2);
    }
    await expect(completePhase("2026-07-30", "start", 2, 2)).rejects.toThrow(/different user/i);
    await completePhase("2026-07-30", "start", 2, 3);
    const day = await getOrCreateDay("2026-07-30");
    expect(day.startCompletedBy).toBe(2);
    expect(day.startCrossCheckBy).toBe(3);
    expect(day.status).toBe("started");
  });

  it("refuses to complete a phase with unanswered items", async () => {
    const db = await freshTestDb();
    await seed(db, { adminPassword: "x" });
    await twoUsers();
    await expect(completePhase("2026-07-30", "start", 2, 3)).rejects.toThrow(/all items/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/floor/__tests__/readinessRepo.test.ts`
Expected: FAIL — cannot find module `../readinessRepo`.

- [ ] **Step 3: Implement `lib/floor/readinessRepo.ts`**

```typescript
import { getClient } from "@/lib/db/client";
import type { ChecklistItem, ReadinessCheck, ReadinessDay, Phase, CheckResult } from "./types";
import { validateCheckResult, phaseComplete } from "./checklist";

export interface ReadinessDayView {
  day: ReadinessDay;
  items: ChecklistItem[];
  checks: ReadinessCheck[];
}

function rowToDay(r: Record<string, unknown>): ReadinessDay {
  return {
    id: r.id as number,
    date: r.date as string,
    templateId: r.template_id as number,
    startCompletedBy: (r.start_completed_by as number) ?? null,
    startCompletedAt: (r.start_completed_at as string) ?? null,
    startCrossCheckBy: (r.start_cross_check_by as number) ?? null,
    endCompletedBy: (r.end_completed_by as number) ?? null,
    endCompletedAt: (r.end_completed_at as string) ?? null,
    endCrossCheckBy: (r.end_cross_check_by as number) ?? null,
    status: r.status as ReadinessDay["status"],
  };
}

async function activeTemplateId(): Promise<number> {
  const res = await getClient().execute(
    "SELECT id FROM checklist_templates WHERE active=1 ORDER BY id DESC LIMIT 1",
  );
  if (!res.rows[0]) throw new Error("No active checklist template — seed the DB first.");
  return res.rows[0].id as number;
}

export async function getOrCreateDay(date: string): Promise<ReadinessDay> {
  const existing = await getClient().execute({ sql: "SELECT * FROM readiness_days WHERE date = ?", args: [date] });
  if (existing.rows[0]) return rowToDay(existing.rows[0] as Record<string, unknown>);
  const templateId = await activeTemplateId();
  await getClient().execute({
    sql: "INSERT INTO readiness_days (date, template_id, status) VALUES (?, ?, 'open')",
    args: [date, templateId],
  });
  const created = await getClient().execute({ sql: "SELECT * FROM readiness_days WHERE date = ?", args: [date] });
  return rowToDay(created.rows[0] as Record<string, unknown>);
}

async function itemsForTemplate(templateId: number): Promise<ChecklistItem[]> {
  const res = await getClient().execute({
    sql: "SELECT id, sort_order, category, label, critical FROM checklist_items WHERE template_id=? AND active=1 ORDER BY sort_order",
    args: [templateId],
  });
  return res.rows.map((r) => ({
    id: r.id as number,
    sortOrder: r.sort_order as number,
    category: r.category as string,
    label: r.label as string,
    critical: !!(r.critical as number),
  }));
}

export async function getDayChecks(date: string): Promise<ReadinessDayView> {
  const day = await getOrCreateDay(date);
  const items = await itemsForTemplate(day.templateId);
  const res = await getClient().execute({
    sql: "SELECT item_id, phase, result, comment, checked_by, checked_at FROM readiness_checks WHERE readiness_day_id=?",
    args: [day.id],
  });
  const checks: ReadinessCheck[] = res.rows.map((r) => ({
    itemId: r.item_id as number,
    phase: r.phase as Phase,
    result: r.result as CheckResult,
    comment: (r.comment as string) ?? null,
    checkedBy: r.checked_by as number,
    checkedAt: r.checked_at as string,
  }));
  return { day, items, checks };
}

export async function saveCheck(
  date: string,
  input: { itemId: number; phase: Phase; result: CheckResult; comment: string | null },
  userId: number,
): Promise<void> {
  const err = validateCheckResult(input.result, input.comment ?? "");
  if (err) throw new Error(err);
  const day = await getOrCreateDay(date);
  const now = new Date().toISOString();
  // Upsert on (day,item,phase) — the schema's UNIQUE constraint backs this.
  await getClient().execute({
    sql: `INSERT INTO readiness_checks (readiness_day_id, item_id, phase, result, comment, checked_by, checked_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (readiness_day_id, item_id, phase)
          DO UPDATE SET result=excluded.result, comment=excluded.comment,
                        checked_by=excluded.checked_by, checked_at=excluded.checked_at`,
    args: [day.id, input.itemId, input.phase, input.result, input.comment, userId, now],
  });
}

export async function completePhase(
  date: string,
  phase: Phase,
  completerId: number,
  crossCheckId: number,
): Promise<void> {
  if (completerId === crossCheckId) throw new Error("Cross-check must be a different user than the completer.");
  const view = await getDayChecks(date);
  if (!phaseComplete(view.items, view.checks, phase)) {
    throw new Error("All items must be answered before completing this phase.");
  }
  const now = new Date().toISOString();
  if (phase === "start") {
    await getClient().execute({
      sql: "UPDATE readiness_days SET start_completed_by=?, start_completed_at=?, start_cross_check_by=?, status='started' WHERE date=?",
      args: [completerId, now, crossCheckId, date],
    });
  } else {
    await getClient().execute({
      sql: "UPDATE readiness_days SET end_completed_by=?, end_completed_at=?, end_cross_check_by=?, status='closed' WHERE date=?",
      args: [completerId, now, crossCheckId, date],
    });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/floor/__tests__/readinessRepo.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/floor/readinessRepo.ts lib/floor/__tests__/readinessRepo.test.ts
git commit -m "feat(floor): readiness repository (day, checks upsert, cross-checked phase completion)"
```

---

### Task 6: Catalog (machines, operators, SKU options)

**Files:**
- Create: `lib/floor/catalog.ts`
- Test: `lib/floor/__tests__/catalog.test.ts`

**Interfaces:**
- Consumes: `getClient` (Phase 1); `fetchSkus` (`lib/sheets.ts`, returns `SkuRow[]` with `skuCode`, `description`).
- Produces: `listMachines()`, `listOperators()`, `skuOptionsFrom(rows)` (pure mapper, unit-tested), `listSkuOptions()`.

- [ ] **Step 1: Write the failing test** (only the DB lists + the pure mapper are tested; `listSkuOptions` wraps `fetchSkus` which hits Google Sheets and is exercised in the browser step)

Create `lib/floor/__tests__/catalog.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { freshTestDb } from "@/test/setup-db";
import { listMachines, listOperators, skuOptionsFrom } from "../catalog";

describe("catalog DB lists", () => {
  it("lists active machines and operators by name", async () => {
    await freshTestDb();
    const { getClient } = await import("@/lib/db/client");
    const now = new Date().toISOString();
    await getClient().execute({ sql: "INSERT INTO machines (name,active,created_at) VALUES ('Zeta',1,?)", args: [now] });
    await getClient().execute({ sql: "INSERT INTO machines (name,active,created_at) VALUES ('Alpha',1,?)", args: [now] });
    await getClient().execute({ sql: "INSERT INTO machines (name,active,created_at) VALUES ('Old',0,?)", args: [now] });
    await getClient().execute({ sql: "INSERT INTO operators (name,active,created_at) VALUES ('Bob',1,?)", args: [now] });
    const machines = await listMachines();
    expect(machines.map((m) => m.name)).toEqual(["Alpha", "Zeta"]);
    expect((await listOperators()).length).toBe(1);
  });
});

describe("skuOptionsFrom", () => {
  it("maps rows to {sku,desc} dropping blanks", () => {
    const opts = skuOptionsFrom([
      { skuCode: "30000001", description: "Iron" } as any,
      { skuCode: "", description: "junk" } as any,
      { skuCode: "30000002", description: "Zinc" } as any,
    ]);
    expect(opts).toEqual([
      { sku: "30000001", desc: "Iron" },
      { sku: "30000002", desc: "Zinc" },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/floor/__tests__/catalog.test.ts`
Expected: FAIL — cannot find module `../catalog`.

- [ ] **Step 3: Implement `lib/floor/catalog.ts`**

```typescript
import { getClient } from "@/lib/db/client";
import { fetchSkus } from "@/lib/sheets";
import type { SkuRow } from "@/lib/types";

export interface NamedRef { id: number; name: string; }
export interface SkuOption { sku: string; desc: string; }

export async function listMachines(): Promise<NamedRef[]> {
  const res = await getClient().execute("SELECT id, name FROM machines WHERE active=1 ORDER BY name");
  return res.rows.map((r) => ({ id: r.id as number, name: r.name as string }));
}

export async function listOperators(): Promise<NamedRef[]> {
  const res = await getClient().execute("SELECT id, name FROM operators WHERE active=1 ORDER BY name");
  return res.rows.map((r) => ({ id: r.id as number, name: r.name as string }));
}

// Pure mapper (unit-tested) — turns sheet rows into product-picker options.
export function skuOptionsFrom(rows: SkuRow[]): SkuOption[] {
  return rows
    .filter((r) => r.skuCode && r.skuCode.trim() !== "")
    .map((r) => ({ sku: r.skuCode, desc: r.description }));
}

export async function listSkuOptions(): Promise<SkuOption[]> {
  return skuOptionsFrom(await fetchSkus());
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/floor/__tests__/catalog.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/floor/catalog.ts lib/floor/__tests__/catalog.test.ts
git commit -m "feat(floor): catalog lists (machines, operators, SKU options)"
```

---

### Task 7: Run API routes (list/create/edit/void) with auth + validation

**Files:**
- Create: `app/api/floor/runs/route.ts`
- Create: `app/api/floor/runs/[id]/route.ts`
- Create: `app/api/floor/runs/[id]/void/route.ts`
- Create: `lib/floor/parseRunInput.ts`
- Test: `lib/floor/__tests__/parseRunInput.test.ts`

**Interfaces:**
- Consumes: `getCurrentUser` (Phase 1); `createRun`/`updateRun`/`voidRun`/`listRuns` (Task 4); `validateRunInput` (Task 3).
- Produces: `parseRunInput(body): { input?: RunInput; errors: string[] }` (pure, unit-tested); the three route handlers.

- [ ] **Step 1: Write the failing test for `parseRunInput`**

Create `lib/floor/__tests__/parseRunInput.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { parseRunInput } from "../parseRunInput";

describe("parseRunInput", () => {
  it("coerces numeric fields and returns a clean RunInput", () => {
    const { input, errors } = parseRunInput({
      date: "2026-07-30", shift: "1", machineId: "2", operatorId: "3",
      productSku: "30000001", productDesc: "Iron", plannedQty: "100", actualQty: "90",
      startTime: "2026-07-30T06:00:00Z", endTime: "2026-07-30T10:00:00Z", downtimeMin: "5", comments: "",
    });
    expect(errors).toEqual([]);
    expect(input).toMatchObject({ machineId: 2, operatorId: 3, plannedQty: 100, actualQty: 90, downtimeMin: 5 });
  });

  it("returns validation errors for a bad body", () => {
    const { input, errors } = parseRunInput({ date: "", shift: "", machineId: 0, operatorId: 0, productSku: "" });
    expect(input).toBeUndefined();
    expect(errors.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/floor/__tests__/parseRunInput.test.ts`
Expected: FAIL — cannot find module `../parseRunInput`.

- [ ] **Step 3: Implement `lib/floor/parseRunInput.ts`**

```typescript
import type { RunInput } from "./types";
import { validateRunInput } from "./validate";

function num(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export function parseRunInput(body: unknown): { input?: RunInput; errors: string[] } {
  const b = (body ?? {}) as Record<string, unknown>;
  const input: RunInput = {
    date: str(b.date),
    shift: str(b.shift),
    machineId: num(b.machineId) ?? 0,
    operatorId: num(b.operatorId) ?? 0,
    productSku: str(b.productSku),
    productDesc: str(b.productDesc),
    plannedQty: num(b.plannedQty),
    actualQty: num(b.actualQty),
    startTime: b.startTime ? str(b.startTime) : null,
    endTime: b.endTime ? str(b.endTime) : null,
    downtimeMin: num(b.downtimeMin),
    comments: b.comments ? str(b.comments) : null,
  };
  const errors = validateRunInput(input);
  return errors.length ? { errors } : { input, errors };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/floor/__tests__/parseRunInput.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement `app/api/floor/runs/route.ts`** (GET list + POST create)

```typescript
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/require";
import { listRuns, createRun } from "@/lib/floor/runsRepo";
import { parseRunInput } from "@/lib/floor/parseRunInput";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const date = new URL(req.url).searchParams.get("date") ?? undefined;
  return NextResponse.json({ runs: await listRuns({ date }) });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { input, errors } = parseRunInput(await req.json().catch(() => ({})));
  if (!input) return NextResponse.json({ errors }, { status: 400 });
  const id = await createRun(input, user.id);
  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 6: Implement `app/api/floor/runs/[id]/route.ts`** (PATCH edit)

```typescript
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/require";
import { updateRun, getRun } from "@/lib/floor/runsRepo";
import { parseRunInput } from "@/lib/floor/parseRunInput";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number(params.id);
  if (!(await getRun(id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { input, errors } = parseRunInput(await req.json().catch(() => ({})));
  if (!input) return NextResponse.json({ errors }, { status: 400 });
  await updateRun(id, input, user.id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: Implement `app/api/floor/runs/[id]/void/route.ts`** (POST void)

```typescript
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/require";
import { voidRun, getRun } from "@/lib/floor/runsRepo";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number(params.id);
  if (!(await getRun(id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { reason } = await req.json().catch(() => ({}));
  if (typeof reason !== "string" || reason.trim() === "") {
    return NextResponse.json({ error: "A reason is required to void a run." }, { status: 400 });
  }
  await voidRun(id, reason.trim(), user.id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: PASS (all tests from Phase 1 + Tasks 1–7).

- [ ] **Step 9: Commit**

```bash
git add lib/floor/parseRunInput.ts lib/floor/__tests__/parseRunInput.test.ts app/api/floor/runs
git commit -m "feat(floor): run API routes (list/create/edit/void) with auth + validation"
```

---

### Task 8: Readiness API routes (day, save check, complete phase)

**Files:**
- Create: `app/api/floor/readiness/route.ts`
- Create: `app/api/floor/readiness/check/route.ts`
- Create: `app/api/floor/readiness/complete/route.ts`

**Interfaces:**
- Consumes: `getCurrentUser` (Phase 1); `getDayChecks`/`saveCheck`/`completePhase` (Task 5).
- Produces: three route handlers. Errors from the repo (deny-comment, cross-check-differs, unanswered items) return 400 with the message.

- [ ] **Step 1: Implement `app/api/floor/readiness/route.ts`** (GET day + items + checks)

```typescript
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/require";
import { getDayChecks } from "@/lib/floor/readinessRepo";

export const dynamic = "force-dynamic";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const date = new URL(req.url).searchParams.get("date") ?? today();
  return NextResponse.json(await getDayChecks(date));
}
```

- [ ] **Step 2: Implement `app/api/floor/readiness/check/route.ts`** (POST save one item)

```typescript
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/require";
import { saveCheck } from "@/lib/floor/readinessRepo";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { date, itemId, phase, result, comment } = body ?? {};
  if (!date || !itemId || (phase !== "start" && phase !== "end") || (result !== "confirm" && result !== "deny")) {
    return NextResponse.json({ error: "date, itemId, phase(start|end) and result(confirm|deny) are required." }, { status: 400 });
  }
  try {
    await saveCheck(date, { itemId: Number(itemId), phase, result, comment: comment ?? null }, user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 3: Implement `app/api/floor/readiness/complete/route.ts`** (POST complete a phase)

```typescript
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/require";
import { completePhase } from "@/lib/floor/readinessRepo";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { date, phase, crossCheckId } = body ?? {};
  if (!date || (phase !== "start" && phase !== "end") || !crossCheckId) {
    return NextResponse.json({ error: "date, phase(start|end) and crossCheckId are required." }, { status: 400 });
  }
  try {
    await completePhase(date, phase, user.id, Number(crossCheckId));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 4: Implement `app/api/floor/catalog/route.ts`** (GET machines + operators + SKUs + supervisors for cross-check)

```typescript
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/require";
import { listMachines, listOperators, listSkuOptions } from "@/lib/floor/catalog";
import { getClient } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supervisors = await getClient().execute(
    "SELECT id, name FROM users WHERE active=1 AND role IN ('supervisor','admin') ORDER BY name",
  );
  return NextResponse.json({
    machines: await listMachines(),
    operators: await listOperators(),
    skus: await listSkuOptions(),
    supervisors: supervisors.rows.map((r) => ({ id: r.id as number, name: r.name as string })),
  });
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add app/api/floor/readiness app/api/floor/catalog
git commit -m "feat(floor): readiness + catalog API routes"
```

---

### Task 9: Floor layout + PWA manifest + login cleanup

**Files:**
- Create: `app/floor/layout.tsx`
- Create: `public/manifest.webmanifest`
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`
- Create: `components/floor/LogoutButton.tsx`
- Modify: `app/floor/login/page.tsx` (drop the `fixed inset-0` overlay), `app/floor/page.tsx` (drop the overlay wrapper — layout now owns full-screen)

**Interfaces:**
- Consumes: nothing new.
- Produces: a chrome-free, installable `/floor` shell used by all floor pages.

- [ ] **Step 1: Create the manifest `public/manifest.webmanifest`**

```json
{
  "name": "Wild Nutrition Production",
  "short_name": "WN Production",
  "start_url": "/floor",
  "scope": "/floor",
  "display": "standalone",
  "background_color": "#f7f3ee",
  "theme_color": "#b5673a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Generate placeholder PNG icons**

Run (creates solid copper squares as valid PNGs):
```bash
mkdir -p public/icons
npx tsx -e "import {writeFileSync} from 'node:fs'; const png=(sz:number)=>{const {PNG}=require('pngjs');const p=new PNG({width:sz,height:sz});for(let i=0;i<p.data.length;i+=4){p.data[i]=0xb5;p.data[i+1]=0x67;p.data[i+2]=0x3a;p.data[i+3]=0xff;}return PNG.sync.write(p);}; writeFileSync('public/icons/icon-192.png',png(192)); writeFileSync('public/icons/icon-512.png',png(512)); console.log('icons written');"
```
If `pngjs` is unavailable, install it dev-only first: `npm i -D pngjs`. (Icons are placeholders; replace with branded art later — out of scope.)
Expected: two PNG files exist under `public/icons/`.

- [ ] **Step 3: Create `app/floor/layout.tsx`** (full-screen shell + PWA metadata)

```tsx
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "WN Production",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "WN Production" },
};

export const viewport: Viewport = {
  themeColor: "#b5673a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// Full-screen overlay over the dashboard's root chrome (the root layout always
// wraps; z-50 covers the sidebar/chatbot). Phase 3 can extract a route group.
export default function FloorLayout({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 overflow-auto bg-cream">{children}</div>;
}
```

- [ ] **Step 4: Simplify `app/floor/login/page.tsx`** — the layout now owns full-screen, so the page is just a centered card

Replace the outer wrapper line:
```tsx
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-cream px-4 overflow-auto">
```
with:
```tsx
    <div className="min-h-full flex items-center justify-center px-4 py-10">
```

- [ ] **Step 5: Simplify `app/floor/page.tsx`** — drop the overlay wrapper (layout owns it)

Replace:
```tsx
    <div className="fixed inset-0 z-50 bg-cream p-6 overflow-auto">
```
with:
```tsx
    <div className="min-h-full p-6">
```

- [ ] **Step 6: Create `components/floor/LogoutButton.tsx`** (client logout)

```tsx
"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  async function signOut() {
    await fetch("/api/floor/logout", { method: "POST" });
    router.push("/floor/login");
    router.refresh();
  }
  return (
    <button onClick={signOut} className="rounded-xl border border-copper text-copper px-4 py-2">
      Sign out
    </button>
  );
}
```

- [ ] **Step 7: Wire the logout button into `app/floor/page.tsx`** — replace the `<form action="/api/floor/logout">…</form>` block with `<LogoutButton />` and add `import LogoutButton from "@/components/floor/LogoutButton";`

- [ ] **Step 8: Build + typecheck**

Run: `npx tsc --noEmit && npx next build`
Expected: clean; `/floor` routes compile; manifest served.

- [ ] **Step 9: Commit**

```bash
git add app/floor/layout.tsx public/manifest.webmanifest public/icons components/floor/LogoutButton.tsx app/floor/login/page.tsx app/floor/page.tsx package.json package-lock.json
git commit -m "feat(floor): installable PWA shell (manifest, floor layout, client logout)"
```

---

### Task 10: SU04 checklist UI (start/end flow)

**Files:**
- Create: `app/floor/checklist/[phase]/page.tsx`
- Create: `components/floor/ChecklistForm.tsx`
- Modify: `app/floor/page.tsx` (day home links into the checklist + run logging)

**Interfaces:**
- Consumes: `/api/floor/readiness`, `/api/floor/readiness/check`, `/api/floor/readiness/complete`, `/api/floor/catalog`.
- Produces: the supervisor checklist experience; completing Start unlocks run logging.

- [ ] **Step 1: Rebuild `app/floor/page.tsx` as the day home** (server component)

```tsx
import { requireUser } from "@/lib/auth/require";
import { getDayChecks } from "@/lib/floor/readinessRepo";
import { canLogRuns, checklistProgress } from "@/lib/floor/checklist";
import LogoutButton from "@/components/floor/LogoutButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function FloorHome() {
  const user = await requireUser();
  const date = new Date().toISOString().slice(0, 10);
  const view = await getDayChecks(date);
  const start = checklistProgress(view.items, view.checks, "start");
  const end = checklistProgress(view.items, view.checks, "end");
  const runsUnlocked = canLogRuns(view.day);

  return (
    <div className="min-h-full p-6 max-w-md mx-auto space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-charcoal">Production</h1>
          <p className="text-text-muted text-sm">{date} · {user.name}</p>
        </div>
        <LogoutButton />
      </header>

      <Link href="/floor/checklist/start" className="block rounded-2xl bg-white border border-[#e4ddd4] p-5">
        <div className="flex items-center justify-between">
          <span className="font-medium text-charcoal">Start-of-Day checks</span>
          <span className="text-sm text-text-muted">{start.done}/{start.total}{view.day.startCompletedBy ? " ✓" : ""}</span>
        </div>
        {start.denyCount > 0 && <p className="text-sm text-amber-600 mt-1">{start.denyCount} denied</p>}
      </Link>

      {runsUnlocked ? (
        <Link href="/floor/runs" className="block rounded-2xl bg-copper text-white p-5 font-medium">
          Log production runs →
        </Link>
      ) : (
        <div className="rounded-2xl bg-[#f0e9e0] text-text-muted p-5 text-sm">
          Complete Start-of-Day checks to unlock run logging.
        </div>
      )}

      <Link href="/floor/checklist/end" className="block rounded-2xl bg-white border border-[#e4ddd4] p-5">
        <div className="flex items-center justify-between">
          <span className="font-medium text-charcoal">End-of-Day checks</span>
          <span className="text-sm text-text-muted">{end.done}/{end.total}{view.day.endCompletedBy ? " ✓" : ""}</span>
        </div>
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/floor/ChecklistForm.tsx`** (client)

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Item { id: number; sortOrder: number; category: string; label: string; critical: boolean; }
interface Check { itemId: number; phase: string; result: "confirm" | "deny"; comment: string | null; }
interface Sup { id: number; name: string; }

export default function ChecklistForm({ phase }: { phase: "start" | "end" }) {
  const router = useRouter();
  const date = new Date().toISOString().slice(0, 10);
  const [items, setItems] = useState<Item[]>([]);
  const [checks, setChecks] = useState<Record<number, { result: "confirm" | "deny"; comment: string }>>({});
  const [supervisors, setSupervisors] = useState<Sup[]>([]);
  const [crossCheckId, setCrossCheckId] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/floor/readiness?date=${date}`).then((x) => x.json());
      setItems(r.items);
      const existing: Record<number, { result: "confirm" | "deny"; comment: string }> = {};
      for (const c of r.checks as Check[]) {
        if (c.phase === phase) existing[c.itemId] = { result: c.result, comment: c.comment ?? "" };
      }
      setChecks(existing);
      setDone(phase === "start" ? !!r.day.startCompletedBy : !!r.day.endCompletedBy);
      const cat = await fetch("/api/floor/catalog").then((x) => x.json());
      setSupervisors(cat.supervisors);
    })();
  }, [date, phase]);

  async function setResult(itemId: number, result: "confirm" | "deny") {
    const comment = checks[itemId]?.comment ?? "";
    setChecks((c) => ({ ...c, [itemId]: { result, comment } }));
    if (result === "deny" && comment.trim() === "") return; // wait for comment before saving
    await save(itemId, result, comment);
  }
  async function setComment(itemId: number, comment: string) {
    const result = checks[itemId]?.result ?? "confirm";
    setChecks((c) => ({ ...c, [itemId]: { result, comment } }));
  }
  async function save(itemId: number, result: "confirm" | "deny", comment: string) {
    const res = await fetch("/api/floor/readiness/check", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, itemId, phase, result, comment }),
    });
    if (!res.ok) setError((await res.json()).error ?? "Save failed.");
  }

  const answered = items.filter((i) => checks[i.id]).length;

  async function complete() {
    setError("");
    // ensure every deny has a saved comment
    for (const i of items) {
      const c = checks[i.id];
      if (c?.result === "deny" && c.comment.trim() === "") { setError(`Add a comment for "${i.label}".`); return; }
      if (c?.result === "deny") await save(i.id, "deny", c.comment);
    }
    const res = await fetch("/api/floor/readiness/complete", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, phase, crossCheckId }),
    });
    if (res.ok) { router.push("/floor"); router.refresh(); }
    else setError((await res.json()).error ?? "Could not complete.");
  }

  return (
    <div className="min-h-full p-5 max-w-md mx-auto space-y-4">
      <h1 className="font-serif text-2xl text-charcoal capitalize">{phase}-of-Day checks</h1>
      <p className="text-sm text-text-muted">{answered}/{items.length} answered</p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {items.map((it) => {
        const c = checks[it.id];
        return (
          <div key={it.id} className="rounded-xl bg-white border border-[#e4ddd4] p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <span className="text-charcoal">{it.label}{it.critical && <span className="text-red-500"> *</span>}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setResult(it.id, "confirm")}
                className={`flex-1 rounded-lg py-2 text-sm ${c?.result === "confirm" ? "bg-green-600 text-white" : "border border-[#e4ddd4]"}`}>Confirm</button>
              <button onClick={() => setResult(it.id, "deny")}
                className={`flex-1 rounded-lg py-2 text-sm ${c?.result === "deny" ? "bg-amber-600 text-white" : "border border-[#e4ddd4]"}`}>Deny</button>
            </div>
            {c?.result === "deny" && (
              <input value={c.comment} onChange={(e) => setComment(it.id, e.target.value)}
                onBlur={() => c.comment.trim() && save(it.id, "deny", c.comment)}
                placeholder="Reason (required)" className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm" />
            )}
          </div>
        );
      })}

      <div className="rounded-xl bg-white border border-[#e4ddd4] p-4 space-y-2">
        <label className="text-sm text-charcoal">Cross-check by (a different supervisor)</label>
        <select value={crossCheckId} onChange={(e) => setCrossCheckId(e.target.value)}
          className="w-full rounded-lg border border-[#e4ddd4] px-3 py-2 text-base">
          <option value="">Select…</option>
          {supervisors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <button onClick={complete} disabled={answered !== items.length || !crossCheckId || done}
        className="w-full rounded-xl bg-copper text-white py-3 font-medium disabled:opacity-50">
        {done ? "Completed ✓" : `Complete ${phase}-of-Day`}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create `app/floor/checklist/[phase]/page.tsx`** (guarded server wrapper)

```tsx
import { requireUser } from "@/lib/auth/require";
import ChecklistForm from "@/components/floor/ChecklistForm";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ChecklistPage({ params }: { params: { phase: string } }) {
  await requireUser();
  if (params.phase !== "start" && params.phase !== "end") notFound();
  return <ChecklistForm phase={params.phase} />;
}
```

- [ ] **Step 4: Build + typecheck**

Run: `npx tsc --noEmit && npx next build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add app/floor/page.tsx app/floor/checklist components/floor/ChecklistForm.tsx
git commit -m "feat(floor): SU04 start/end checklist UI + day home"
```

---

### Task 11: Run logging UI (list + new/edit + void)

**Files:**
- Create: `app/floor/runs/page.tsx`
- Create: `components/floor/RunLogger.tsx`

**Interfaces:**
- Consumes: `/api/floor/runs` (GET/POST), `/api/floor/runs/[id]` (PATCH), `/api/floor/runs/[id]/void` (POST), `/api/floor/catalog`; `efficiency` (Task 1) for display.
- Produces: the run-logging experience.

- [ ] **Step 1: Create `app/floor/runs/page.tsx`** (guarded; blocks if Start not done)

```tsx
import { requireUser } from "@/lib/auth/require";
import { getDayChecks } from "@/lib/floor/readinessRepo";
import { canLogRuns } from "@/lib/floor/checklist";
import RunLogger from "@/components/floor/RunLogger";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  await requireUser();
  const date = new Date().toISOString().slice(0, 10);
  const view = await getDayChecks(date);
  if (!canLogRuns(view.day)) {
    return (
      <div className="min-h-full p-6 max-w-md mx-auto space-y-4">
        <p className="text-text-muted">Start-of-Day checks must be completed before logging runs.</p>
        <Link href="/floor/checklist/start" className="text-copper underline">Go to Start-of-Day checks</Link>
      </div>
    );
  }
  return <RunLogger date={date} />;
}
```

- [ ] **Step 2: Create `components/floor/RunLogger.tsx`** (client)

```tsx
"use client";

import { useEffect, useState } from "react";
import { efficiency } from "@/lib/floor/metrics";

interface Ref { id: number; name: string; }
interface SkuOption { sku: string; desc: string; }
interface Run {
  id: number; shift: string; machineId: number; operatorId: number;
  productSku: string; productDesc: string; plannedQty: number | null; actualQty: number | null;
  downtimeMin: number | null; void: boolean;
}
const EMPTY = {
  shift: "1", machineId: "", operatorId: "", productSku: "", productDesc: "",
  plannedQty: "", actualQty: "", startTime: "", endTime: "", downtimeMin: "", comments: "",
};

export default function RunLogger({ date }: { date: string }) {
  const [machines, setMachines] = useState<Ref[]>([]);
  const [operators, setOperators] = useState<Ref[]>([]);
  const [skus, setSkus] = useState<SkuOption[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function loadRuns() {
    const r = await fetch(`/api/floor/runs?date=${date}`).then((x) => x.json());
    setRuns(r.runs);
  }
  useEffect(() => {
    (async () => {
      const cat = await fetch("/api/floor/catalog").then((x) => x.json());
      setMachines(cat.machines); setOperators(cat.operators); setSkus(cat.skus);
      await loadRuns();
    })();
  }, [date]);

  function set<K extends keyof typeof EMPTY>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit() {
    setSaving(true); setErrors([]);
    const desc = skus.find((s) => s.sku === form.productSku)?.desc ?? form.productDesc;
    const body = { date, ...form, productDesc: desc };
    const res = editId
      ? await fetch(`/api/floor/runs/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/floor/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) { setForm(EMPTY); setEditId(null); await loadRuns(); }
    else { const j = await res.json().catch(() => ({})); setErrors(j.errors ?? [j.error ?? "Save failed."]); }
  }

  function edit(r: Run) {
    setEditId(r.id);
    setForm({
      shift: r.shift, machineId: String(r.machineId), operatorId: String(r.operatorId),
      productSku: r.productSku, productDesc: r.productDesc,
      plannedQty: r.plannedQty?.toString() ?? "", actualQty: r.actualQty?.toString() ?? "",
      startTime: "", endTime: "", downtimeMin: r.downtimeMin?.toString() ?? "", comments: "",
    });
  }

  async function voidRun(id: number) {
    const reason = prompt("Reason for voiding this run?");
    if (!reason) return;
    const res = await fetch(`/api/floor/runs/${id}/void`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
    if (res.ok) await loadRuns();
  }

  const nameOf = (list: Ref[], id: number) => list.find((x) => x.id === id)?.name ?? `#${id}`;

  return (
    <div className="min-h-full p-5 max-w-md mx-auto space-y-4">
      <h1 className="font-serif text-2xl text-charcoal">Runs · {date}</h1>

      <div className="rounded-2xl bg-white border border-[#e4ddd4] p-4 space-y-3">
        <h2 className="font-medium text-charcoal">{editId ? "Edit run" : "New run"}</h2>
        {errors.length > 0 && <ul className="text-sm text-red-600 list-disc pl-5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
        <div className="grid grid-cols-2 gap-2">
          <select value={form.shift} onChange={(e) => set("shift", e.target.value)} className="rounded-lg border border-[#e4ddd4] px-3 py-2">
            <option value="1">Shift 1</option><option value="2">Shift 2</option>
          </select>
          <select value={form.machineId} onChange={(e) => set("machineId", e.target.value)} className="rounded-lg border border-[#e4ddd4] px-3 py-2">
            <option value="">Machine…</option>{machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select value={form.operatorId} onChange={(e) => set("operatorId", e.target.value)} className="rounded-lg border border-[#e4ddd4] px-3 py-2">
            <option value="">Operator…</option>{operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <select value={form.productSku} onChange={(e) => set("productSku", e.target.value)} className="rounded-lg border border-[#e4ddd4] px-3 py-2">
            <option value="">Product…</option>{skus.map((s) => <option key={s.sku} value={s.sku}>{s.desc}</option>)}
          </select>
          <input inputMode="numeric" placeholder="Planned" value={form.plannedQty} onChange={(e) => set("plannedQty", e.target.value)} className="rounded-lg border border-[#e4ddd4] px-3 py-2" />
          <input inputMode="numeric" placeholder="Actual" value={form.actualQty} onChange={(e) => set("actualQty", e.target.value)} className="rounded-lg border border-[#e4ddd4] px-3 py-2" />
          <input type="datetime-local" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} className="rounded-lg border border-[#e4ddd4] px-3 py-2" />
          <input type="datetime-local" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} className="rounded-lg border border-[#e4ddd4] px-3 py-2" />
          <input inputMode="numeric" placeholder="Downtime (min)" value={form.downtimeMin} onChange={(e) => set("downtimeMin", e.target.value)} className="rounded-lg border border-[#e4ddd4] px-3 py-2 col-span-2" />
          <input placeholder="Comments" value={form.comments} onChange={(e) => set("comments", e.target.value)} className="rounded-lg border border-[#e4ddd4] px-3 py-2 col-span-2" />
        </div>
        <button onClick={submit} disabled={saving} className="w-full rounded-xl bg-copper text-white py-3 font-medium disabled:opacity-50">
          {saving ? "Saving…" : editId ? "Save changes" : "Add run"}
        </button>
        {editId && <button onClick={() => { setEditId(null); setForm(EMPTY); }} className="w-full text-sm text-text-muted">Cancel edit</button>}
      </div>

      <div className="space-y-2">
        {runs.map((r) => {
          const eff = efficiency(r.actualQty, r.plannedQty);
          return (
            <div key={r.id} className={`rounded-xl border p-3 ${r.void ? "opacity-50 border-[#e4ddd4]" : "bg-white border-[#e4ddd4]"}`}>
              <div className="flex justify-between">
                <span className="text-charcoal">{r.productDesc}</span>
                <span className="text-sm text-text-muted">{eff != null ? `${Math.round(eff * 100)}%` : "—"}</span>
              </div>
              <p className="text-sm text-text-muted">
                {nameOf(machines, r.machineId)} · {nameOf(operators, r.operatorId)} · {r.actualQty ?? 0}/{r.plannedQty ?? 0}
                {r.void && " · VOID"}
              </p>
              {!r.void && (
                <div className="flex gap-3 mt-1 text-sm">
                  <button onClick={() => edit(r)} className="text-copper">Edit</button>
                  <button onClick={() => voidRun(r.id)} className="text-red-600">Void</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build + typecheck**

Run: `npx tsc --noEmit && npx next build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/floor/runs components/floor/RunLogger.tsx
git commit -m "feat(floor): run logging UI (list, new/edit, void)"
```

---

### Task 12: End-to-end browser verification + docs

**Files:**
- Modify: `docs/supervisor-app-setup.md` (add the Phase-2 flow)

**Interfaces:** none (documentation + manual verification).

- [ ] **Step 1: Reseed a local dev DB**

Run:
```bash
rm -f local.db && TURSO_DATABASE_URL=file:local.db SEED_ADMIN_PASSWORD=admin123 npm run db:seed
```
Then add a second supervisor so cross-check can be exercised (a throwaway):
```bash
TURSO_DATABASE_URL=file:local.db npx tsx -e "import {getClient} from './lib/db/client'; import {hashPassword} from './lib/auth/password'; (async()=>{const h=await hashPassword('admin123'); await getClient().execute({sql:\"INSERT INTO users (username,password_hash,name,role,active,created_at) VALUES ('sup2',?,?,'supervisor',1,?)\",args:[h,'Second Supervisor',new Date().toISOString()]}); console.log('sup2 added');})()"
```

- [ ] **Step 2: Start the dev server and verify the full flow on a mobile viewport (375×812)**

Using the Browser pane per the preview workflow:
1. `preview_start` the `wild-dash` dev server; navigate to `/floor`; resize to mobile.
2. Log in as `admin` / `admin123` → day home shows Start/End cards, run logging locked.
3. Open **Start-of-Day checks** → Confirm all 15 (Deny one, add a comment, re-Confirm to test the gate) → select cross-check = Second Supervisor → **Complete** → back at day home with Start ✓ and run logging unlocked.
4. Open **Log production runs** → add a run (machine/operator/product/planned/actual/times) → it appears with an efficiency % → **Edit** it (change actual) → **Void** it (reason) → confirm it greys out and drops its actions.
5. Confirm run logging is blocked before Start completion (log out, log in fresh on a new date if needed).
Capture a screenshot of the day home (Start ✓, runs unlocked) and of the runs list as proof.

- [ ] **Step 3: Verify audit + no-double-count via the DB**

Run:
```bash
TURSO_DATABASE_URL=file:local.db npx tsx -e "import {getClient} from './lib/db/client'; (async()=>{const a=await getClient().execute('SELECT action,COUNT(*) c FROM audit_log GROUP BY action'); const r=await getClient().execute('SELECT COUNT(*) total, SUM(void) voided FROM runs'); console.log('audit',a.rows,'runs',r.rows[0]);})()"
```
Expected: `create`/`update`/`void` audit rows present; each run counted once.

- [ ] **Step 4: Append the Phase-2 flow to `docs/supervisor-app-setup.md`**

```markdown

## Phase 2 — Supervisor PWA
- Install: open `/floor` on a phone → browser "Add to Home Screen" → launches full-screen.
- Daily flow: Start-of-Day SU04 (Shift-1, gates run logging) → log per-machine runs →
  End-of-Day SU04 (Shift-2). Deny needs a comment; each phase needs a different
  supervisor as cross-check. Runs are voided (never deleted); every change is in `audit_log`.
- Cross-check needs ≥2 active supervisor/admin users — add more via the (future) admin UI
  or a seed insert.
```

- [ ] **Step 5: Full suite + typecheck + build**

Run:
```bash
npm test && npx tsc --noEmit && npx next build
```
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add docs/supervisor-app-setup.md
git commit -m "docs: Phase 2 supervisor PWA flow + verification"
```

---

## Phase 2 Self-Review

- **Spec coverage:** mobile PWA install (§4, §6) ✓ Task 9; SU04 start/end flow with Confirm/Deny + required Deny comment + progress + cross-check-differs (§6, §7, §9) ✓ Tasks 2/5/8/10; run logging one-output-once-per-operator with server-computed efficiency/throughput (§4, §5, §8) ✓ Tasks 1/4/7/11; edit + soft void + field-level audit (§9) ✓ Tasks 3/4/7/11; SKUs from `fetchSkus`, machines/operators from DB (§4) ✓ Task 6; server-side validation + friendly errors (§9) ✓ Tasks 3/7/8/10/11; start gates run logging (§6) ✓ Tasks 2/10/11. Deferred (documented): dashboard reflection = Phase 3; admin CRUD = Phase 4; auto-captured times/throughput display polish and offline are out of scope (§2).
- **Placeholder scan:** none — every step has runnable code/commands. Icons are explicitly placeholder art (branded art deferred).
- **Type consistency:** `Run`/`RunInput`/`RunTotals`/`ChecklistItem`/`ReadinessCheck`/`ReadinessDay`/`Phase` defined once in Task 1 and reused verbatim; repo function names (`createRun`/`getRun`/`listRuns`/`updateRun`/`voidRun`, `getOrCreateDay`/`getDayChecks`/`saveCheck`/`completePhase`, `listMachines`/`listOperators`/`listSkuOptions`/`skuOptionsFrom`) match across tasks; `efficiency`/`throughput`/`summarizeRuns`/`checklistProgress`/`validateCheckResult`/`phaseComplete`/`canLogRuns`/`diffFields`/`validateRunInput`/`parseRunInput` names are consistent between definition and use.

## Follow-on plans (not this document)
- **Phase 3:** Dashboard reflection — per-operator/machine performance, runs register, SU04 compliance (read the DB via `listRuns`, `getDayChecks`, `summarizeRuns`).
- **Phase 4:** Admin UI — manage users/operators/machines/checklist templates.
