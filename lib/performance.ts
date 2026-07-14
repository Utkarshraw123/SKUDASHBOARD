import type { ProductionInputRow, ProductionReportRecord } from "./sheets";

// ---- Config ----------------------------------------------------------------
export const RAG = { green: 90, amber: 75 }; // efficiency % thresholds

export function ragOf(effPct: number): "green" | "amber" | "red" {
  if (effPct >= RAG.green) return "green";
  if (effPct >= RAG.amber) return "amber";
  return "red";
}

// ---- Types -----------------------------------------------------------------
export interface GroupStat {
  key: string;
  label: string;
  planned: number;
  actual: number;
  efficiency: number;   // weighted %, actual/planned
  tasks: number;
  belowTarget: number;  // tasks under RAG.amber
  rows: ProductionInputRow[];
}

export interface TrendPoint {
  label: string;        // date or week
  actual: number;
  planned: number;
  efficiency: number;
}

export interface WastageSummary {
  reportsCount: number;
  avgBlendedWaste: number;   // %
  yieldPct: number | null;   // 100 - avgBlendedWaste, null if no reports
  bySku: { sku: string; description: string; reports: number; avgWaste: number; totalMade: number }[];
}

export interface PerformanceData {
  totalOutput: number;
  totalPlanned: number;
  weightedEfficiency: number;
  headcountPresent: number;
  tasksBelowTarget: number;
  totalTasks: number;
  byMachine: GroupStat[];
  byEmployee: GroupStat[];
  byShift: GroupStat[];
  byProduct: GroupStat[];
  trend: TrendPoint[];
  wastage: WastageSummary;
}

// ---- Helpers ---------------------------------------------------------------
function parseDMY(s: string): Date | null {
  if (!s || !s.trim()) return null;
  const p = s.trim().split("/");
  if (p.length === 3) {
    const d = new Date(`${p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function eff(planned: number, actual: number): number {
  return planned > 0 ? Math.round((actual / planned) * 1000) / 10 : 0;
}

function groupBy(
  rows: ProductionInputRow[],
  keyFn: (r: ProductionInputRow) => string,
  labelFn?: (r: ProductionInputRow) => string,
): GroupStat[] {
  const map = new Map<string, ProductionInputRow[]>();
  for (const r of rows) {
    const k = keyFn(r);
    if (!k) continue;
    (map.get(k) ?? map.set(k, []).get(k)!).push(r);
  }
  const stats: GroupStat[] = [];
  map.forEach((rs, key) => {
    const planned = rs.reduce((s, r) => s + (r.plannedQty ?? 0), 0);
    const actual = rs.reduce((s, r) => s + (r.actualQty ?? 0), 0);
    const belowTarget = rs.filter(r => eff(r.plannedQty ?? 0, r.actualQty ?? 0) < RAG.amber && (r.plannedQty ?? 0) > 0).length;
    stats.push({
      key,
      label: labelFn ? labelFn(rs[0]) : key,
      planned,
      actual,
      efficiency: eff(planned, actual),
      tasks: rs.length,
      belowTarget,
      rows: rs,
    });
  });
  return stats;
}

// ---- Main ------------------------------------------------------------------
export function computePerformance(
  input: ProductionInputRow[],
  reports: ProductionReportRecord[],
  skuDesc: Map<string, string>,
): PerformanceData {
  const totalPlanned = input.reduce((s, r) => s + (r.plannedQty ?? 0), 0);
  const totalOutput = input.reduce((s, r) => s + (r.actualQty ?? 0), 0);
  const totalTasks = input.length;
  const tasksBelowTarget = input.filter(r => eff(r.plannedQty ?? 0, r.actualQty ?? 0) < RAG.amber && (r.plannedQty ?? 0) > 0).length;
  const headcountPresent = new Set(input.filter(r => r.present).map(r => r.employee)).size;

  const byMachine = groupBy(input, r => r.machine).sort((a, b) => a.efficiency - b.efficiency);
  const byEmployee = groupBy(input, r => r.employee).sort((a, b) => b.actual - a.actual);
  const byShift = groupBy(input, r => r.shift).sort((a, b) => a.key.localeCompare(b.key));
  const byProduct = groupBy(input, r => r.product, r => skuDesc.get(r.product) || r.description || r.product)
    .sort((a, b) => b.actual - a.actual);

  // employee days-worked shown via distinct dates (attach via label trick not needed; compute in view)

  // Trend: decide daily vs weekly by span
  const dates = input.map(r => parseDMY(r.date)).filter((d): d is Date => d !== null);
  const spanDays = dates.length > 1
    ? (Math.max(...dates.map(d => d.getTime())) - Math.min(...dates.map(d => d.getTime()))) / 86400000
    : 0;
  const weekly = spanDays > 45;

  const trendMap = new Map<string, { planned: number; actual: number; sort: number }>();
  for (const r of input) {
    const d = parseDMY(r.date);
    if (!d) continue;
    const label = weekly ? r.weekNumber : r.date;
    const sort = weekly ? weekNum(r.weekNumber) : d.getTime();
    const cur = trendMap.get(label) ?? { planned: 0, actual: 0, sort };
    cur.planned += r.plannedQty ?? 0;
    cur.actual += r.actualQty ?? 0;
    trendMap.set(label, cur);
  }
  const trend: TrendPoint[] = Array.from(trendMap.entries())
    .map(([label, v]) => ({ label, planned: v.planned, actual: v.actual, efficiency: eff(v.planned, v.actual), sort: v.sort }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ label, planned, actual, efficiency }) => ({ label, planned, actual, efficiency }));

  // Wastage summary from reports
  const wastage = summarizeWastage(reports, skuDesc);

  return {
    totalOutput, totalPlanned,
    weightedEfficiency: eff(totalPlanned, totalOutput),
    headcountPresent, tasksBelowTarget, totalTasks,
    byMachine, byEmployee, byShift, byProduct, trend, wastage,
  };
}

function weekNum(w: string): number {
  const m = w.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function summarizeWastage(reports: ProductionReportRecord[], skuDesc: Map<string, string>): WastageSummary {
  if (reports.length === 0) {
    return { reportsCount: 0, avgBlendedWaste: 0, yieldPct: null, bySku: [] };
  }
  const avgBlendedWaste = Math.round((reports.reduce((s, r) => s + r.blendedWastePct, 0) / reports.length) * 100) / 100;
  const skuMap = new Map<string, { reports: number; wasteSum: number; made: number; description: string }>();
  for (const r of reports) {
    const cur = skuMap.get(r.sku) ?? { reports: 0, wasteSum: 0, made: 0, description: skuDesc.get(r.sku) || r.description || r.sku };
    cur.reports += 1;
    cur.wasteSum += r.blendedWastePct;
    cur.made += r.made;
    skuMap.set(r.sku, cur);
  }
  const bySku = Array.from(skuMap.entries()).map(([sku, v]) => ({
    sku, description: v.description, reports: v.reports,
    avgWaste: Math.round((v.wasteSum / v.reports) * 100) / 100,
    totalMade: v.made,
  })).sort((a, b) => b.avgWaste - a.avgWaste);

  return {
    reportsCount: reports.length,
    avgBlendedWaste,
    yieldPct: Math.round((100 - avgBlendedWaste) * 100) / 100,
    bySku,
  };
}
