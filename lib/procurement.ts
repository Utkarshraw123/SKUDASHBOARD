import type { SkuRow, ProductionRow, PlanningRow, BulkPoRow, PackingRow, BomSheet } from "./types";
import type { InventoryRow, WowDemand } from "./sheets";

// ---- Config ----------------------------------------------------------------

const RM_WAREHOUSES = ["WNP", "WNC"]; // raw material excess stock
const DEFAULT_TARGET_COVER = 16;
const HIGH_TARGET_COVER = 20; // collagen & magnesium default

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
  targetCover: number;        // N weeks (resolved: per-SKU > collagen/mag > global)
  currentStock: number;       // ALL SKU DASHBOARD current inventory
  currentCover: number;       // weeks of forward cover from today (from WoW forecast)
  openingStock: number;       // projected stock at cycle start (S0)
  openingCover: number;       // weeks of forward cover at cycle start
  cycleDemand: number;        // Σ weekly forecast within the cycle
  incomingPOs: PoRef[];       // open POs due today..cycle end
  incomingQty: number;
  targetStock: number;        // Σ next N weeks' forecast after cycle end
  coverShort: boolean;        // forward cover ran past the last forecast week
  unitsToProduce: number;
}

export interface BulkPlanRow {
  bulkCode: string;
  description: string;
  capsulesNeeded: number;
  stock: number;
  openPOs: PoRef[];
  openPoQty: number;
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
  orderQty: number;
  usedIn: { bulkCode: string; kg: number }[];
}

export interface AncPlanRow {
  code: string;
  name: string;
  type: string;
  buffer: number;
  unitsNeeded: number;
  stock: number;
  openPOs: PoRef[];
  openPoQty: number;
  netRequired: number;
  orderQty: number;
  usedIn: { skuCode: string; units: number }[];
}

export interface UnmatchedRow {
  skuCode: string;
  product: string;
  cycleDemand: number;   // forecast demand in the cycle (can't plan — not in dashboard)
}

export interface PlanMeta {
  cycleStart: string;    // ISO
  cycleEnd: string;      // ISO
  firstForecastWeek: string | null;
  lastForecastWeek: string | null;
  outOfRange: boolean;   // cycle falls (partly) outside the forecast grid
  globalCover: number;
  cmCover: number;
  skusPlanned: number;
}

export interface ProcurementPlan {
  fg: FgPlanRow[];
  bulk: BulkPlanRow[];
  rm: RmPlanRow[];
  ancillary: AncPlanRow[];
  unmatched: UnmatchedRow[];
  meta: PlanMeta;
}

// ---- Helpers ---------------------------------------------------------------

function parseDMY(s: string): Date | null {
  if (!s || !s.trim()) return null;
  const p = s.trim().split("/");
  if (p.length === 3) {
    const d = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
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

// Sum a weekly series over an inclusive index range (clamped to the array).
function rangeSum(series: number[], a: number, b: number): number {
  let t = 0;
  const lo = Math.max(0, a), hi = Math.min(series.length - 1, b);
  for (let i = lo; i <= hi; i++) t += series[i] ?? 0;
  return t;
}

// Weeks of forward cover a given stock buys from `startIdx`, walking the forecast.
// Zero-demand weeks count as covered; a partial final week contributes a fraction.
function coverWeeks(series: number[], startIdx: number, stock: number): number {
  let remaining = stock, w = 0;
  for (let i = Math.max(0, startIdx); i < series.length; i++) {
    const d = series[i] ?? 0;
    if (d <= 0) { w += 1; continue; }
    if (remaining >= d) { remaining -= d; w += 1; }
    else { w += remaining / d; return w; }
  }
  return w; // stock outlasts the forecast horizon
}

// ---- Main ------------------------------------------------------------------

export function computePlan(inputs: {
  skus: SkuRow[];
  inventory: InventoryRow[];
  production: ProductionRow[];
  bulkPOs: BulkPoRow[];
  rmBom: BomSheet;
  ancBom: BomSheet;
  wow: WowDemand;
  cycleStart: Date;
  cycleEnd: Date;
  globalCover: number;
  cmCover: number;
  perSku: Record<string, number>;
  today?: Date;
}): ProcurementPlan {
  const { skus, inventory, production, bulkPOs, rmBom, ancBom, wow, cycleStart, cycleEnd } = inputs;
  const globalCover = inputs.globalCover > 0 ? inputs.globalCover : DEFAULT_TARGET_COVER;
  const cmCover = inputs.cmCover > 0 ? inputs.cmCover : HIGH_TARGET_COVER;
  const perSku = inputs.perSku ?? {};
  const today = inputs.today ?? new Date();
  today.setHours(0, 0, 0, 0);

  // --- Week index helpers over the WoW grid --------------------------------
  const weekDates = wow.weeks.map(w => w.date);
  const nWeeks = weekDates.length;
  const idxOnOrAfter = (d: Date) => { const i = weekDates.findIndex(w => w >= d); return i < 0 ? nWeeks : i; };
  const idxOnOrBefore = (d: Date) => { let i = -1; for (let k = 0; k < nWeeks; k++) if (weekDates[k] <= d) i = k; return i; };

  const todayIdx = idxOnOrAfter(today);
  const startIdx = idxOnOrAfter(cycleStart);
  const endIdx = idxOnOrBefore(cycleEnd);
  const outOfRange = nWeeks === 0 || startIdx >= nWeeks || endIdx < 0 || startIdx > endIdx;

  // --- Open PO helper (POs due today..cycle end) ---------------------------
  const openPoFor = (part: string): PoRef[] => {
    const fromBulkSheet = bulkPOs
      .filter(p => p.partNumber === part && p.orderQuantity !== null)
      .map(p => ({ po: p.order, qty: p.orderQuantity!, dueDate: p.dueDate }));
    const fromProduction = production
      .filter(p => p.partNumber === part && p.status !== "complete" && p.quantity !== null)
      .map(p => ({ po: p.order, qty: (p.quantity ?? 0) - (p.received ?? 0), dueDate: p.dueDate }))
      .filter(p => p.qty > 0);
    const seen = new Set<string>();
    const all: PoRef[] = [];
    for (const p of [...fromBulkSheet, ...fromProduction]) {
      const d = parseDMY(p.dueDate);
      if (!d || d < today || d > cycleEnd) continue; // only POs landing today..cycle end
      const key = `${p.po}-${p.qty}`;
      if (!seen.has(key)) { seen.add(key); all.push(p); }
    }
    return all;
  };
  const poQtyBefore = (pos: PoRef[], cut: Date) =>
    pos.reduce((t, p) => { const d = parseDMY(p.dueDate); return d && d <= cut ? t + p.qty : t; }, 0);
  const poQtyBetween = (pos: PoRef[], lo: Date, hi: Date) =>
    pos.reduce((t, p) => { const d = parseDMY(p.dueDate); return d && d > lo && d <= hi ? t + p.qty : t; }, 0);

  const skuByCode = new Map(skus.map(s => [s.skuCode, s]));

  // --- 1. Finished Goods (from WoW forecast) -------------------------------
  const fg: FgPlanRow[] = [];
  const unmatched: UnmatchedRow[] = [];

  for (const [skuCode, series] of Array.from(wow.demandBySku.entries())) {
    const cycleDemand = outOfRange ? 0 : rangeSum(series, startIdx, endIdx);
    const sku = skuByCode.get(skuCode);
    if (!sku) {
      // Forecast-only SKU: has demand but no dashboard record → can't plan parts.
      if (cycleDemand > 0) unmatched.push({ skuCode, product: wow.nameBySku.get(skuCode) ?? "", cycleDemand });
      continue;
    }

    const N = perSku[skuCode] ?? (isHighTarget(sku.description) ? cmCover : globalCover);
    const currentStock = sku.inventory ?? 0;
    const pos = openPoFor(skuCode);
    const posBeforeStart = poQtyBefore(pos, cycleStart);
    const posInCycle = poQtyBetween(pos, cycleStart, cycleEnd);
    const incomingQty = pos.reduce((t, p) => t + p.qty, 0);

    const salesToStart = outOfRange ? 0 : rangeSum(series, todayIdx, startIdx - 1);
    const openingStock = Math.max(0, currentStock + posBeforeStart - salesToStart);
    const targetStock = outOfRange ? 0 : rangeSum(series, endIdx + 1, endIdx + N);
    const coverShort = !outOfRange && endIdx + N >= nWeeks;
    const projectedEnd = openingStock + posInCycle - cycleDemand;
    const unitsToProduce = Math.max(0, Math.ceil(targetStock - projectedEnd));

    const currentCover = coverWeeks(series, todayIdx, currentStock);
    const openingCover = coverWeeks(series, startIdx, openingStock);

    // Show a row if there's something to make, or opening cover is short of target.
    if (unitsToProduce > 0 || openingCover < N) {
      fg.push({
        skuCode, description: sku.description, bulkCode: sku.bulk, fill: sku.fill,
        targetCover: N, currentStock, currentCover, openingStock, openingCover,
        cycleDemand, incomingPOs: pos, incomingQty, targetStock, coverShort, unitsToProduce,
      });
    }
  }
  fg.sort((a, b) => b.unitsToProduce - a.unitsToProduce);
  unmatched.sort((a, b) => b.cycleDemand - a.cycleDemand);

  // --- 2. Bulk / Capsules (supply = stock + open POs; no manual netting) ----
  const bulkMap = new Map<string, BulkPlanRow>();
  for (const row of fg) {
    if (!row.bulkCode || row.fill === null || row.unitsToProduce <= 0) continue;
    const caps = row.unitsToProduce * row.fill;
    let b = bulkMap.get(row.bulkCode);
    if (!b) {
      const stock = sumStockAll(inventory, row.bulkCode);
      const openPOs = openPoFor(row.bulkCode);
      const openPoQty = openPOs.reduce((t, p) => t + p.qty, 0) * 1000; // bulk POs in ×1,000 caps
      b = {
        bulkCode: row.bulkCode, description: "", capsulesNeeded: 0, stock,
        openPOs, openPoQty, availableBulk: Math.max(0, stock + openPoQty),
        capsulesToOrder: 0, skus: [],
      };
      bulkMap.set(row.bulkCode, b);
    }
    b.capsulesNeeded += caps;
    b.skus.push({ skuCode: row.skuCode, units: row.unitsToProduce, fill: row.fill });
  }
  for (const b of Array.from(bulkMap.values())) {
    const invRow = inventory.find(r => r.partNumber === b.bulkCode);
    b.description = invRow?.description ?? "";
    b.capsulesToOrder = Math.max(0, Math.ceil(b.capsulesNeeded - b.availableBulk));
  }
  const bulk = Array.from(bulkMap.values()).sort((a, b) => b.capsulesToOrder - a.capsulesToOrder);

  // --- 3. Raw Materials ----------------------------------------------------
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
        r = { code: comp.code, name: comp.name, kgNeeded: 0, excessStock, openPOs, openPoQty, netRequired: 0, orderQty: 0, usedIn: [] };
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

  // --- 4. Ancillaries (supply = stock + open POs; no manual netting) -------
  const ancMap = new Map<string, AncPlanRow>();
  for (const row of fg) {
    if (row.unitsToProduce <= 0) continue;
    const product = ancBom.products.find(p => p.code === row.skuCode);
    if (!product) continue;
    for (const comp of product.components) {
      const t = ancillaryType(comp.name);
      if (!t) continue;
      const units = row.unitsToProduce * comp.qty;
      let a = ancMap.get(comp.code);
      if (!a) {
        const stock = sumStockAll(inventory, comp.code);
        const openPOs = openPoFor(comp.code);
        const openPoQty = openPOs.reduce((tt, p) => tt + p.qty, 0);
        a = { code: comp.code, name: comp.name, type: t.label, buffer: t.buffer, unitsNeeded: 0, stock, openPOs, openPoQty, netRequired: 0, orderQty: 0, usedIn: [] };
        ancMap.set(comp.code, a);
      }
      a.unitsNeeded += units;
      a.usedIn.push({ skuCode: row.skuCode, units });
    }
  }
  for (const a of Array.from(ancMap.values())) {
    const available = a.stock + a.openPoQty;
    a.netRequired = Math.max(0, a.unitsNeeded - available);
    a.orderQty = a.netRequired > 0 ? Math.ceil(a.netRequired * (1 + a.buffer)) : 0;
  }
  const ancillary = Array.from(ancMap.values()).sort((a, b) => b.orderQty - a.orderQty);

  const meta: PlanMeta = {
    cycleStart: cycleStart.toISOString().slice(0, 10),
    cycleEnd: cycleEnd.toISOString().slice(0, 10),
    firstForecastWeek: wow.weeks[0]?.iso ?? null,
    lastForecastWeek: wow.weeks[nWeeks - 1]?.iso ?? null,
    outOfRange,
    globalCover, cmCover,
    skusPlanned: fg.length,
  };

  return { fg, bulk, rm, ancillary, unmatched, meta };
}
