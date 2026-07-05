import type { SkuRow, ProductionRow, PlanningRow, BulkPoRow, PackingRow, BomSheet } from "./types";
import type { InventoryRow } from "./sheets";

// ---- Config ----------------------------------------------------------------

const FG_WAREHOUSES = ["EXG", "BCA", "WNP", "WNC"]; // finished goods stock
const RM_WAREHOUSES = ["WNP", "WNC"]; // raw material excess stock
const WEEKS_PER_MONTH = 4.33;
const DEFAULT_TARGET_COVER = 16;
const HIGH_TARGET_COVER = 20; // collagen & magnesium

const RM_BUFFER = 0.08;
// ancillary buffers by keyword; only these types are planned
const ANCILLARY_TYPES: { match: RegExp; buffer: number; label: string }[] = [
  { match: /box/i, buffer: 0.05, label: "Box" },
  { match: /label/i, buffer: 0.10, label: "Label" },
  { match: /pouch/i, buffer: 0.10, label: "Pouch" },
  { match: /jar/i, buffer: 0.10, label: "Jar" },
  { match: /lid/i, buffer: 0.10, label: "Lid" },
];

// ---- Types -----------------------------------------------------------------

export interface PoRef {
  po: string;
  qty: number;
  dueDate: string;
}

export interface FgPlanRow {
  skuCode: string;
  description: string;
  bulkCode: string;
  fill: number | null;
  weeklyDemand: number;
  currentStock: number;
  currentCover: number | null;
  targetCover: number;
  incomingPOs: PoRef[];
  incomingQty: number;
  projectedStockAtCycleEnd: number;
  targetStock: number;
  unitsToProduce: number;
}

export interface BulkPlanRow {
  bulkCode: string;
  description: string;
  capsulesNeeded: number; // for the cycle production plan
  stock: number;
  openPOs: PoRef[];
  openPoQty: number;
  committedCapsules: number; // consumed by packing orders before cycle start
  availableBulk: number;
  capsulesToOrder: number;
  skus: { skuCode: string; units: number; fill: number }[];
}

export interface RmPlanRow {
  code: string;
  name: string;
  kgNeeded: number;
  excessStock: number;
  openPOs: PoRef[];
  openPoQty: number;
  netRequired: number;
  orderQty: number; // with buffer
  usedIn: { bulkCode: string; kg: number }[];
}

export interface AncPlanRow {
  code: string;
  name: string;
  type: string;
  buffer: number;
  unitsNeeded: number;
  stock: number;
  committedUsage: number;
  openPOs: PoRef[];
  openPoQty: number;
  netRequired: number;
  orderQty: number;
  usedIn: { skuCode: string; units: number }[];
}

export interface ProcurementPlan {
  fg: FgPlanRow[];
  bulk: BulkPlanRow[];
  rm: RmPlanRow[];
  ancillary: AncPlanRow[];
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

function inWindow(dateStr: string, from: Date, to: Date): boolean {
  const d = parseDMY(dateStr);
  if (!d) return false;
  return d >= from && d <= to;
}

function sumStock(inv: InventoryRow[], part: string, warehouses: string[]): number {
  return inv
    .filter(r => r.partNumber === part && warehouses.includes(r.warehouse))
    .reduce((s, r) => s + r.balance, 0);
}

function sumStockAll(inv: InventoryRow[], part: string): number {
  return inv.filter(r => r.partNumber === part).reduce((s, r) => s + r.balance, 0);
}

function isHighTarget(description: string): boolean {
  return /collagen|magnesium/i.test(description);
}

function ancillaryType(name: string): { label: string; buffer: number } | null {
  for (const t of ANCILLARY_TYPES) {
    if (t.match.test(name)) return { label: t.label, buffer: t.buffer };
  }
  return null;
}

// ---- Main ------------------------------------------------------------------

export function computePlan(inputs: {
  skus: SkuRow[];
  inventory: InventoryRow[];
  production: ProductionRow[]; // New Production Master
  planning: PlanningRow[]; // WNP planning
  bulkPOs: BulkPoRow[]; // Open Purchase Orders
  packing: PackingRow[]; // Packing Schedule
  rmBom: BomSheet;
  ancBom: BomSheet;
  cycleStart: Date;
  cycleEnd: Date;
  today?: Date;
}): ProcurementPlan {
  const { skus, inventory, production, planning, bulkPOs, packing, rmBom, ancBom, cycleStart, cycleEnd } = inputs;
  const today = inputs.today ?? new Date();
  today.setHours(0, 0, 0, 0);

  const weeksUntilCycleEnd = Math.max(0, (cycleEnd.getTime() - today.getTime()) / (7 * 86400000));

  // --- Open PO helpers (only POs due on/before cycle end count) -------------
  // From Open Purchase Orders sheet
  const openPoFor = (part: string): PoRef[] => {
    const fromBulkSheet = bulkPOs
      .filter(p => p.partNumber === part && p.orderQuantity !== null && inWindow(p.dueDate, today, cycleEnd))
      .map(p => ({ po: p.order, qty: p.orderQuantity!, dueDate: p.dueDate }));
    // From New Production Master: open external orders (remaining qty)
    const fromProduction = production
      .filter(p => p.partNumber === part && p.status !== "complete" && p.quantity !== null && inWindow(p.dueDate, today, cycleEnd))
      .map(p => ({ po: p.order, qty: (p.quantity ?? 0) - (p.received ?? 0), dueDate: p.dueDate }))
      .filter(p => p.qty > 0);
    // de-dup by PO number (same PO may appear in both sheets)
    const seen = new Set<string>();
    const all: PoRef[] = [];
    for (const p of [...fromBulkSheet, ...fromProduction]) {
      const key = `${p.po}-${p.qty}`;
      if (!seen.has(key)) { seen.add(key); all.push(p); }
    }
    return all;
  };

  // --- 1. Finished Goods ------------------------------------------------------
  const fg: FgPlanRow[] = [];
  for (const s of skus) {
    if (!s.skuCode.startsWith("3")) continue;
    const weeklyDemand = (s.monthlyDemandAvg ?? 0) / WEEKS_PER_MONTH;
    if (weeklyDemand <= 0) continue;

    const stock = sumStock(inventory, s.skuCode, FG_WAREHOUSES);
    const incomingPOs = openPoFor(s.skuCode);
    const incomingQty = incomingPOs.reduce((t, p) => t + p.qty, 0);
    const targetCover = isHighTarget(s.description) ? HIGH_TARGET_COVER : DEFAULT_TARGET_COVER;

    const projectedStockAtCycleEnd = stock + incomingQty - weeklyDemand * weeksUntilCycleEnd;
    const targetStock = targetCover * weeklyDemand;
    const unitsToProduce = Math.max(0, Math.ceil(targetStock - projectedStockAtCycleEnd));

    const currentCover = weeklyDemand > 0 ? stock / weeklyDemand : null;

    // include row if action needed OR cover currently below target (visibility)
    if (unitsToProduce > 0 || (currentCover !== null && currentCover < targetCover)) {
      fg.push({
        skuCode: s.skuCode,
        description: s.description,
        bulkCode: s.bulk,
        fill: s.fill,
        weeklyDemand,
        currentStock: stock,
        currentCover,
        targetCover,
        incomingPOs,
        incomingQty,
        projectedStockAtCycleEnd,
        targetStock,
        unitsToProduce,
      });
    }
  }
  fg.sort((a, b) => b.unitsToProduce - a.unitsToProduce);

  // --- 2. Bulk / Capsules -----------------------------------------------------
  // committed 3-code production between today and cycle start (packing schedule + WNP planning)
  const skuByCode = new Map(skus.map(s => [s.skuCode, s]));

  const committedFg = new Map<string, number>(); // skuCode -> units planned before cycle start
  for (const p of packing) {
    if (!p.partNumber.startsWith("3") || p.balance === null) continue;
    if (!inWindow(p.dueDate, today, cycleStart)) continue;
    committedFg.set(p.partNumber, (committedFg.get(p.partNumber) ?? 0) + p.balance);
  }
  for (const p of planning) {
    if (p.status === "complete" || !p.productCode.startsWith("3") || p.quantity === null) continue;
    const d = parseDMY(p.plannedWeek);
    if (!d || d < today || d > cycleStart) continue;
    committedFg.set(p.productCode, (committedFg.get(p.productCode) ?? 0) + p.quantity);
  }

  // committed capsule consumption grouped by bulk code
  const committedCapsByBulk = new Map<string, number>();
  committedFg.forEach((units, skuCode) => {
    const sku = skuByCode.get(skuCode);
    if (!sku || !sku.bulk || sku.fill === null) return;
    committedCapsByBulk.set(sku.bulk, (committedCapsByBulk.get(sku.bulk) ?? 0) + units * sku.fill);
  });

  const bulkMap = new Map<string, BulkPlanRow>();
  for (const row of fg) {
    if (!row.bulkCode || row.fill === null || row.unitsToProduce <= 0) continue;
    const caps = row.unitsToProduce * row.fill;
    let b = bulkMap.get(row.bulkCode);
    if (!b) {
      const stock = sumStockAll(inventory, row.bulkCode);
      const openPOs = openPoFor(row.bulkCode);
      const openPoQty = openPOs.reduce((t, p) => t + p.qty, 0) * 1000; // bulk POs are in units of 1,000 caps
      const committed = committedCapsByBulk.get(row.bulkCode) ?? 0;
      b = {
        bulkCode: row.bulkCode,
        description: "",
        capsulesNeeded: 0,
        stock,
        openPOs,
        openPoQty,
        committedCapsules: committed,
        availableBulk: Math.max(0, stock + openPoQty - committed),
        capsulesToOrder: 0,
        skus: [],
      };
      bulkMap.set(row.bulkCode, b);
    }
    b.capsulesNeeded += caps;
    b.skus.push({ skuCode: row.skuCode, units: row.unitsToProduce, fill: row.fill });
  }
  // bulk descriptions from inventory
  for (const b of Array.from(bulkMap.values())) {
    const invRow = inventory.find(r => r.partNumber === b.bulkCode);
    b.description = invRow?.description ?? "";
    b.capsulesToOrder = Math.max(0, Math.ceil(b.capsulesNeeded - b.availableBulk));
  }
  const bulk = Array.from(bulkMap.values()).sort((a, b) => b.capsulesToOrder - a.capsulesToOrder);

  // --- 3. Raw Materials ---------------------------------------------------------
  const rmMap = new Map<string, RmPlanRow>();
  for (const b of bulk) {
    if (b.capsulesToOrder <= 0) continue;
    const product = rmBom.products.find(p => p.code === b.bulkCode);
    if (!product) continue;
    for (const comp of product.components) {
      const kg = (b.capsulesToOrder / 1000) * comp.qty;
      let r = rmMap.get(comp.code);
      if (!r) {
        const excessStock = sumStock(inventory, comp.code, RM_WAREHOUSES);
        const openPOs = openPoFor(comp.code);
        const openPoQty = openPOs.reduce((t, p) => t + p.qty, 0);
        r = {
          code: comp.code,
          name: comp.name,
          kgNeeded: 0,
          excessStock,
          openPOs,
          openPoQty,
          netRequired: 0,
          orderQty: 0,
          usedIn: [],
        };
        rmMap.set(comp.code, r);
      }
      r.kgNeeded += kg;
      r.usedIn.push({ bulkCode: b.bulkCode, kg });
    }
  }
  for (const r of Array.from(rmMap.values())) {
    r.netRequired = Math.max(0, r.kgNeeded - r.excessStock - r.openPoQty);
    r.orderQty = r.netRequired > 0 ? Math.ceil(r.netRequired * (1 + RM_BUFFER) * 100) / 100 : 0;
  }
  const rm = Array.from(rmMap.values()).sort((a, b) => b.orderQty - a.orderQty);

  // --- 4. Ancillaries -------------------------------------------------------------
  // committed ancillary usage: committed FG production before cycle start × ancillary BOM
  const committedAncUsage = new Map<string, number>();
  committedFg.forEach((units, skuCode) => {
    const product = ancBom.products.find(p => p.code === skuCode);
    if (!product) return;
    for (const comp of product.components) {
      committedAncUsage.set(comp.code, (committedAncUsage.get(comp.code) ?? 0) + units * comp.qty);
    }
  });

  const ancMap = new Map<string, AncPlanRow>();
  for (const row of fg) {
    if (row.unitsToProduce <= 0) continue;
    const product = ancBom.products.find(p => p.code === row.skuCode);
    if (!product) continue;
    for (const comp of product.components) {
      const t = ancillaryType(comp.name);
      if (!t) continue; // skip scoops, shippers, anything unmatched
      const units = row.unitsToProduce * comp.qty;
      let a = ancMap.get(comp.code);
      if (!a) {
        const stock = sumStockAll(inventory, comp.code);
        const committedUsage = committedAncUsage.get(comp.code) ?? 0;
        const openPOs = openPoFor(comp.code);
        const openPoQty = openPOs.reduce((tt, p) => tt + p.qty, 0);
        a = {
          code: comp.code,
          name: comp.name,
          type: t.label,
          buffer: t.buffer,
          unitsNeeded: 0,
          stock,
          committedUsage,
          openPOs,
          openPoQty,
          netRequired: 0,
          orderQty: 0,
          usedIn: [],
        };
        ancMap.set(comp.code, a);
      }
      a.unitsNeeded += units;
      a.usedIn.push({ skuCode: row.skuCode, units });
    }
  }
  for (const a of Array.from(ancMap.values())) {
    const available = Math.max(0, a.stock - a.committedUsage) + a.openPoQty;
    a.netRequired = Math.max(0, a.unitsNeeded - available);
    a.orderQty = a.netRequired > 0 ? Math.ceil(a.netRequired * (1 + a.buffer)) : 0;
  }
  const ancillary = Array.from(ancMap.values()).sort((a, b) => b.orderQty - a.orderQty);

  return { fg, bulk, rm, ancillary };
}
