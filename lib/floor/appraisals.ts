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
