// Component low-stock view: weeks-of-cover for bulk / RM / ancillary components,
// driven by finished-goods demand exploded through the BOMs. Pure & unit-testable.
// (Finished goods themselves are covered by the Cover Risk page.)

import type { SkuRow, BomSheet } from "./types";
import type { InventoryRow } from "./sheets";

const WEEKS_PER_MONTH = 4.33;
const CRITICAL_WEEKS = 4;
const LOW_WEEKS = 8;
const BULK_ACTUAL_THRESHOLD = 100000; // bulk stock is in thousands unless already >= this

// Ancillary subset that we plan/track (matches procurement & readiness); scoops/
// shippers/unmatched are skipped.
const ANC_MATCH = /box|label|pouch|jar|lid/i;

export type ComponentType = "bulk" | "rm" | "ancillary";
export type CoverStatus = "critical" | "low" | "ok";

export interface ComponentCoverRow {
  type: ComponentType;
  code: string;
  name: string;
  stock: number;
  unit: string;        // "caps" | "kg" | "units"
  weeklyUse: number;
  weeksCover: number;  // stock / weeklyUse
  status: CoverStatus;
  drivenBy: string;
}

export interface ComponentCoverResult {
  rows: ComponentCoverRow[];
  summary: { critical: number; low: number; ok: number; total: number };
  thresholds: { critical: number; low: number };
}

function bulkCaps(v: number): number {
  if (!v) return 0;
  return Math.abs(v) < BULK_ACTUAL_THRESHOLD ? v * 1000 : v;
}

function sumStockAll(inv: InventoryRow[], part: string, bulk = false): number {
  return inv
    .filter(r => r.partNumber === part)
    .reduce((s, r) => s + (bulk ? bulkCaps(r.balance) : r.balance), 0);
}

function statusFor(weeks: number): CoverStatus {
  if (weeks < CRITICAL_WEEKS) return "critical";
  if (weeks < LOW_WEEKS) return "low";
  return "ok";
}

function topDrivers(m: Map<string, number>, n = 3): string {
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k)
    .join(", ");
}

export function computeComponentCover(inputs: {
  skus: SkuRow[];
  inventory: InventoryRow[];
  rmBom: BomSheet;
  ancBom: BomSheet;
}): ComponentCoverResult {
  const { skus, inventory, rmBom, ancBom } = inputs;

  // 1. Finished-goods weekly demand (3-codes with demand).
  const fgWeekly = skus
    .filter(s => s.skuCode.startsWith("3") && (s.monthlyDemandAvg ?? 0) > 0)
    .map(s => ({ sku: s, weekly: (s.monthlyDemandAvg ?? 0) / WEEKS_PER_MONTH }));

  // 2. Bulk weekly capsule consumption, grouped by bulk code.
  const bulkWeekly = new Map<string, number>();
  const bulkDrivers = new Map<string, Map<string, number>>();
  for (const { sku, weekly } of fgWeekly) {
    if (!sku.bulk || !sku.bulk.startsWith("1") || sku.fill === null || sku.fill <= 0) continue; // real 1-codes only (skips "N/A"/blank)
    const caps = weekly * sku.fill;
    bulkWeekly.set(sku.bulk, (bulkWeekly.get(sku.bulk) ?? 0) + caps);
    if (!bulkDrivers.has(sku.bulk)) bulkDrivers.set(sku.bulk, new Map());
    bulkDrivers.get(sku.bulk)!.set(sku.skuCode, caps);
  }

  // 3. RM weekly kg — explode bulk weekly caps through the RM BOM.
  const rmWeekly = new Map<string, number>();
  const rmName = new Map<string, string>();
  const rmDrivers = new Map<string, Map<string, number>>();
  bulkWeekly.forEach((caps, bulkCode) => {
    const product = rmBom.products.find(p => p.code === bulkCode);
    if (!product) return;
    for (const comp of product.components) {
      const kg = (caps / 1000) * comp.qty;
      if (kg <= 0) continue;
      rmWeekly.set(comp.code, (rmWeekly.get(comp.code) ?? 0) + kg);
      rmName.set(comp.code, comp.name);
      if (!rmDrivers.has(comp.code)) rmDrivers.set(comp.code, new Map());
      rmDrivers.get(comp.code)!.set(bulkCode, kg);
    }
  });

  // 4. Ancillary weekly units — explode FG weekly demand through the Ancillary BOM.
  const ancWeekly = new Map<string, number>();
  const ancName = new Map<string, string>();
  const ancDrivers = new Map<string, Map<string, number>>();
  for (const { sku, weekly } of fgWeekly) {
    const product = ancBom.products.find(p => p.code === sku.skuCode);
    if (!product) continue;
    for (const comp of product.components) {
      if (!ANC_MATCH.test(comp.name)) continue; // skip scoops/shippers/unmatched
      const units = weekly * comp.qty;
      if (units <= 0) continue;
      ancWeekly.set(comp.code, (ancWeekly.get(comp.code) ?? 0) + units);
      ancName.set(comp.code, comp.name);
      if (!ancDrivers.has(comp.code)) ancDrivers.set(comp.code, new Map());
      ancDrivers.get(comp.code)!.set(sku.skuCode, units);
    }
  }

  const rows: ComponentCoverRow[] = [];
  const nameOf = (code: string) => inventory.find(r => r.partNumber === code)?.description ?? "";

  bulkWeekly.forEach((weeklyUse, code) => {
    if (weeklyUse <= 0) return;
    const stock = sumStockAll(inventory, code, true);
    const weeksCover = stock / weeklyUse;
    rows.push({ type: "bulk", code, name: nameOf(code), stock, unit: "caps", weeklyUse, weeksCover, status: statusFor(weeksCover), drivenBy: topDrivers(bulkDrivers.get(code) ?? new Map()) });
  });
  rmWeekly.forEach((weeklyUse, code) => {
    if (weeklyUse <= 0) return;
    const stock = sumStockAll(inventory, code);
    const weeksCover = stock / weeklyUse;
    rows.push({ type: "rm", code, name: rmName.get(code) || nameOf(code), stock, unit: "kg", weeklyUse, weeksCover, status: statusFor(weeksCover), drivenBy: topDrivers(rmDrivers.get(code) ?? new Map()) });
  });
  ancWeekly.forEach((weeklyUse, code) => {
    if (weeklyUse <= 0) return;
    const stock = sumStockAll(inventory, code);
    const weeksCover = stock / weeklyUse;
    rows.push({ type: "ancillary", code, name: ancName.get(code) || nameOf(code), stock, unit: "units", weeklyUse, weeksCover, status: statusFor(weeksCover), drivenBy: topDrivers(ancDrivers.get(code) ?? new Map()) });
  });

  rows.sort((a, b) => a.weeksCover - b.weeksCover);

  return {
    rows,
    summary: {
      critical: rows.filter(r => r.status === "critical").length,
      low: rows.filter(r => r.status === "low").length,
      ok: rows.filter(r => r.status === "ok").length,
      total: rows.length,
    },
    thresholds: { critical: CRITICAL_WEEKS, low: LOW_WEEKS },
  };
}
