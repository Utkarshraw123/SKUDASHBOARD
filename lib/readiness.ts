// Production Readiness (MRP-lite): for WNP work orders in the next N days, check
// each component (bulk + ancillaries) is available in time. Pure & unit-testable.
// Reuses the explosion / stock-netting shape of lib/procurement.ts.

import type { SkuRow, ProductionRow, PlanningRow, BulkPoRow, BomSheet } from "./types";
import type { InventoryRow } from "./sheets";

// ---- Config ----------------------------------------------------------------

const PACKING_WAREHOUSES = ["WNP", "WNC"]; // components must be at the packing site
const DEFAULT_HORIZON_DAYS = 10;

// Bulk (1-code) quantities are recorded in THOUSANDS of capsules across the DB
// (stock AND POs): e.g. 487 means 487,000. Some rows are already written in full
// (e.g. 487000). Values at/above this threshold are treated as already-actual;
// anything below is multiplied ×1000. The live data has a clean gap — largest
// "thousands" value ≈ 3,360, smallest already-actual ≈ 748,755.
const BULK_ACTUAL_THRESHOLD = 100000;
function bulkCaps(v: number): number {
  if (!v) return 0;
  return Math.abs(v) < BULK_ACTUAL_THRESHOLD ? v * 1000 : v;
}

// Only these ancillary types are checked (matches procurement); scoops/shippers/
// unmatched are skipped.
const ANCILLARY_TYPES: { match: RegExp; label: string }[] = [
  { match: /box/i, label: "Box" },
  { match: /label/i, label: "Label" },
  { match: /pouch/i, label: "Pouch" },
  { match: /jar/i, label: "Jar" },
  { match: /lid/i, label: "Lid" },
];

// Monday-first so the EARLIEST day named in a fuzzy string ("Thursday - Friday")
// wins → most conservative deadline.
const WEEKDAYS: { name: string; offset: number }[] = [
  { name: "monday", offset: 0 },
  { name: "tuesday", offset: 1 },
  { name: "wednesday", offset: 2 },
  { name: "thursday", offset: 3 },
  { name: "friday", offset: 4 },
  { name: "saturday", offset: 5 },
  { name: "sunday", offset: 6 },
];

// ---- Types -----------------------------------------------------------------

export interface ReadinessPoRef {
  po: string;
  qty: number;
  dueDate: string;
}

export type ComponentStatus = "ok" | "at_risk" | "short" | "unknown";

export interface ComponentCheck {
  kind: "bulk" | "ancillary";
  code: string;
  name: string;
  need: number;
  onHand: number;          // total packing-warehouse stock today (display)
  availableBefore: number; // stock-only balance before this WO (after earlier WOs)
  inboundQty: number;      // inbound counted as arriving by this WO's date
  inboundRefs: ReadinessPoRef[];
  shortfall: number;       // >0 when short
  status: ComponentStatus;
  note?: string;
}

export type WoStatus = "ready" | "at_risk" | "short";

export interface WoReadiness {
  workOrder: string;
  productCode: string;
  description: string;
  plannedDateISO: string;
  plannedDateLabel: string;
  plannedDaysLabel: string;
  netQty: number;
  bulkCode: string;
  fill: number | null;
  status: WoStatus;
  components: ComponentCheck[];
}

export interface ReadinessResult {
  horizonDays: number;
  generatedAtISO: string;
  fromLabel: string;
  toLabel: string;
  summary: { total: number; ready: number; atRisk: number; short: number };
  workOrders: WoReadiness[];
  excludedNon3: number;
}

// ---- Helpers ---------------------------------------------------------------

function parseDMY(s: string): Date | null {
  if (!s || !s.trim()) return null;
  const p = s.trim().split("/");
  if (p.length !== 3) return null;
  const [dd, mm, yyyy] = [Number(p[0]), Number(p[1]), Number(p[2])];
  if (!dd || !mm || !yyyy) return null;
  const d = new Date(yyyy, mm - 1, dd); // local midnight, consistent with `today`
  return isNaN(d.getTime()) ? null : d;
}

function fmtDMY(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// Derive a WO's planned date from PLANNED WEEK (week-commencing Monday) + PLANNED DAYS.
export function deriveWoDate(weekWC: string, days: string): Date | null {
  const base = parseDMY(weekWC);
  if (!base) return null;
  const lower = (days ?? "").toLowerCase();
  const hit = WEEKDAYS.find(w => lower.includes(w.name));
  const d = new Date(base);
  if (hit) d.setDate(d.getDate() + hit.offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function ancillaryLabel(name: string): string | null {
  for (const t of ANCILLARY_TYPES) if (t.match.test(name)) return t.label;
  return null;
}

function sumStock(inv: InventoryRow[], part: string, warehouses: string[]): number {
  return inv
    .filter(r => r.partNumber === part && warehouses.includes(r.warehouse))
    .reduce((s, r) => s + r.balance, 0);
}

// Bulk stock: convert each line thousands→caps before summing (handles a mix of
// thousands-notation and already-actual lines correctly).
function sumBulkStock(inv: InventoryRow[], part: string, warehouses: string[]): number {
  return inv
    .filter(r => r.partNumber === part && warehouses.includes(r.warehouse))
    .reduce((s, r) => s + bulkCaps(r.balance), 0);
}

// ---- Component supply state (one per component code) ------------------------

interface CompState {
  code: string;
  name: string;
  kind: "bulk" | "ancillary";
  onHand: number;
  stockBalance: number;   // on-hand minus consumption so far (no inbound)
  inboundBalance: number; // on-hand + inbound arrived so far minus consumption
  receipts: ReadinessPoRef[]; // future inbound, sorted by dueDate
  addedIdx: number;       // how many receipts already folded into inboundBalance
}

// ---- Main ------------------------------------------------------------------

export function computeReadiness(inputs: {
  planning: PlanningRow[];
  skus: SkuRow[];
  inventory: InventoryRow[];
  production: ProductionRow[]; // New Production Master (inbound)
  bulkPOs: BulkPoRow[];        // Open Purchase Orders (inbound)
  ancBom: BomSheet;
  today?: Date;
  horizonDays?: number;
}): ReadinessResult {
  const { planning, skus, inventory, production, bulkPOs, ancBom } = inputs;
  const horizonDays = inputs.horizonDays ?? DEFAULT_HORIZON_DAYS;
  const today = inputs.today ? new Date(inputs.today) : new Date();
  today.setHours(0, 0, 0, 0);
  const to = new Date(today);
  to.setDate(to.getDate() + horizonDays);

  const skuByCode = new Map(skus.map(s => [s.skuCode, s]));

  // Inbound receipts for a part, due on/before `by` — Open POs + open production rows.
  // Bulk POs are also recorded in thousands → normalise with bulkCaps().
  const conv = (isBulk: boolean, v: number) => (isBulk ? bulkCaps(v) : v);
  const inboundFor = (part: string, isBulk: boolean, by: Date): ReadinessPoRef[] => {
    const fromPO = bulkPOs
      .filter(p => p.partNumber === part && p.orderQuantity !== null)
      .map(p => ({ po: p.order, qty: conv(isBulk, p.orderQuantity!), dueDate: p.dueDate }));
    const fromProd = production
      .filter(p => p.partNumber === part && p.status !== "complete" && p.quantity !== null)
      .map(p => ({ po: p.order, qty: conv(isBulk, (p.quantity ?? 0) - (p.received ?? 0)), dueDate: p.dueDate }))
      .filter(p => p.qty > 0);
    const seen = new Set<string>();
    const all: ReadinessPoRef[] = [];
    for (const p of [...fromPO, ...fromProd]) {
      const d = parseDMY(p.dueDate);
      if (!d || d > by) continue; // must arrive by the run date
      const key = `${p.po}-${p.qty}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(p);
    }
    return all;
  };

  // 1. Select in-scope work orders.
  interface ScopedWo {
    row: PlanningRow;
    date: Date;
    netQty: number;
    bulkCode: string;
    fill: number | null;
  }
  const scoped: ScopedWo[] = [];
  let excludedNon3 = 0;
  for (const row of planning) {
    if (row.status === "complete") continue;
    if (!row.productCode.startsWith("3")) { if (row.workOrderNo) excludedNon3++; continue; }
    const date = deriveWoDate(row.plannedWeek, row.plannedDays);
    if (!date || date < today || date > to) continue;
    const netQty = (row.quantity ?? 0) - (row.quantityProduced ?? 0);
    if (netQty <= 0) continue;
    const sku = skuByCode.get(row.productCode);
    const bulkCode = row.bulkCode || sku?.bulk || "";
    const fill = row.fill ?? sku?.fill ?? null;
    scoped.push({ row, date, netQty, bulkCode, fill });
  }

  // Sort by date, then WO number (stable allocation order for netting).
  scoped.sort((a, b) => a.date.getTime() - b.date.getTime() || a.row.workOrderNo.localeCompare(b.row.workOrderNo));

  // Component states, created lazily so on-hand/inbound are computed once.
  const states = new Map<string, CompState>();
  const getState = (code: string, name: string, kind: "bulk" | "ancillary"): CompState => {
    let st = states.get(code);
    if (!st) {
      const onHand = kind === "bulk"
        ? sumBulkStock(inventory, code, PACKING_WAREHOUSES)
        : sumStock(inventory, code, PACKING_WAREHOUSES);
      // gather all inbound over the whole horizon (due <= to); fold in by date as WOs advance
      const receipts = inboundFor(code, kind === "bulk", to)
        .slice()
        .sort((a, b) => (parseDMY(a.dueDate)?.getTime() ?? 0) - (parseDMY(b.dueDate)?.getTime() ?? 0));
      st = { code, name, kind, onHand, stockBalance: onHand, inboundBalance: onHand, receipts, addedIdx: 0 };
      states.set(code, st);
    }
    return st;
  };

  const advance = (st: CompState, date: Date) => {
    while (st.addedIdx < st.receipts.length) {
      const r = st.receipts[st.addedIdx];
      const d = parseDMY(r.dueDate);
      if (d && d <= date) { st.inboundBalance += r.qty; st.addedIdx++; }
      else break;
    }
  };

  // 2 + 3 + 4. Requirements, supply, time-phased netting.
  const workOrders: WoReadiness[] = [];
  for (const wo of scoped) {
    const components: ComponentCheck[] = [];

    // --- bulk requirement ---
    if (wo.bulkCode) {
      if (wo.fill === null || wo.fill <= 0) {
        components.push({
          kind: "bulk", code: wo.bulkCode, name: bulkName(inventory, wo.bulkCode),
          need: 0, onHand: 0, availableBefore: 0, inboundQty: 0, inboundRefs: [],
          shortfall: 0, status: "unknown", note: "Fill missing — cannot compute capsules",
        });
      } else {
        const need = wo.netQty * wo.fill;
        const st = getState(wo.bulkCode, bulkName(inventory, wo.bulkCode), "bulk");
        components.push(evaluate(st, need, wo.date, advance));
      }
    }

    // --- ancillary requirements (from BOM) ---
    const product = ancBom.products.find(p => p.code === wo.row.productCode);
    if (product) {
      for (const comp of product.components) {
        const label = ancillaryLabel(comp.name);
        if (!label) continue; // skip scoops/shippers/unmatched
        const need = wo.netQty * comp.qty;
        if (need <= 0) continue;
        const st = getState(comp.code, comp.name, "ancillary");
        components.push(evaluate(st, need, wo.date, advance));
      }
    }

    const status: WoStatus = components.some(c => c.status === "short")
      ? "short"
      : components.some(c => c.status === "at_risk" || c.status === "unknown")
        ? "at_risk"
        : "ready";

    workOrders.push({
      workOrder: wo.row.workOrderNo,
      productCode: wo.row.productCode,
      description: wo.row.description || skuByCode.get(wo.row.productCode)?.description || "",
      plannedDateISO: wo.date.toISOString(),
      plannedDateLabel: fmtDMY(wo.date),
      plannedDaysLabel: wo.row.plannedDays,
      netQty: wo.netQty,
      bulkCode: wo.bulkCode,
      fill: wo.fill,
      status,
      components,
    });
  }

  const summary = {
    total: workOrders.length,
    ready: workOrders.filter(w => w.status === "ready").length,
    atRisk: workOrders.filter(w => w.status === "at_risk").length,
    short: workOrders.filter(w => w.status === "short").length,
  };

  return {
    horizonDays,
    generatedAtISO: new Date().toISOString(),
    fromLabel: fmtDMY(today),
    toLabel: fmtDMY(to),
    summary,
    workOrders,
    excludedNon3,
  };
}

function bulkName(inv: InventoryRow[], code: string): string {
  return inv.find(r => r.partNumber === code)?.description ?? "";
}

// Classify one component against its running state, then consume `need`.
function evaluate(st: CompState, need: number, date: Date, advance: (s: CompState, d: Date) => void): ComponentCheck {
  advance(st, date);
  const stockBefore = st.stockBalance;
  const inboundBefore = st.inboundBalance;
  const inboundQty = inboundBefore - stockBefore; // future inbound folded in so far

  let status: ComponentStatus;
  let shortfall = 0;
  if (stockBefore >= need) status = "ok";
  else if (inboundBefore >= need) status = "at_risk";
  else { status = "short"; shortfall = need - inboundBefore; }

  // consume regardless so shortages cascade to later WOs sharing the part
  st.stockBalance -= need;
  st.inboundBalance -= need;

  return {
    kind: st.kind,
    code: st.code,
    name: st.name,
    need,
    onHand: st.onHand,
    availableBefore: stockBefore,
    inboundQty: Math.max(0, inboundQty),
    inboundRefs: status === "at_risk" ? st.receipts.slice(0, st.addedIdx) : [],
    shortfall,
    status,
  };
}
