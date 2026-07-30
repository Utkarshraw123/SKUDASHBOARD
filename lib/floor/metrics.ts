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
    perOperator: Array.from(byOp.entries()).map(([operatorId, v]) => ({
      operatorId,
      actual: v.actual,
      planned: v.planned,
      efficiency: efficiency(v.actual, v.planned),
    })),
  };
}
