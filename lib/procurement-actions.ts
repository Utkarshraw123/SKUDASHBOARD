// Flatten a ProcurementPlan into a single actionable "what to order now" list,
// grouped by (inferred) supplier — the draft PO handed to purchasing. Pure.

import type { ProcurementPlan } from "./procurement";
import type { BulkPoRow, ProductionRow } from "./types";

export type ActionType = "bulk" | "rm" | "ancillary";

export interface OrderAction {
  partType: ActionType;
  code: string;
  name: string;
  qty: number;          // amount to order, in `unit`
  unit: string;         // "×1,000 caps" | "kg" | "units"
  supplier: string;     // inferred from most-recent PO, else "—"
  onOrder: number;      // already on order (same unit)
  note: string;         // short "driven by" trail
}

export interface SupplierGroup {
  supplier: string;
  actions: OrderAction[];
  lineCount: number;
}

export interface OrderActionList {
  actions: OrderAction[];
  bySupplier: SupplierGroup[];
  summary: { totalLines: number; bulk: number; rm: number; ancillary: number; suppliers: number };
}

function parseDMY(s: string): number {
  if (!s || !s.trim()) return 0;
  const p = s.trim().split("/");
  if (p.length !== 3) return 0;
  const t = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0])).getTime();
  return isNaN(t) ? 0 : t;
}

// Infer each part's supplier from the most recent PO/production row that names it.
function buildSupplierMap(bulkPOs: BulkPoRow[], production: ProductionRow[]): Map<string, string> {
  const best = new Map<string, { when: number; vendor: string }>();
  const consider = (part: string, vendor: string, when: number) => {
    if (!part || !vendor || !vendor.trim()) return;
    const cur = best.get(part);
    if (!cur || when >= cur.when) best.set(part, { when, vendor: vendor.trim() });
  };
  for (const p of bulkPOs) consider(p.partNumber, p.vendorName, parseDMY(p.date));
  for (const p of production) consider(p.partNumber, p.vendorName, parseDMY(p.raisedDate));
  const out = new Map<string, string>();
  best.forEach((v, k) => out.set(k, v.vendor));
  return out;
}

export function buildOrderActions(
  plan: ProcurementPlan,
  bulkPOs: BulkPoRow[],
  production: ProductionRow[],
): OrderActionList {
  const supplierOf = buildSupplierMap(bulkPOs, production);
  const actions: OrderAction[] = [];

  // Bulk — ordered in units of 1,000 capsules
  for (const b of plan.bulk) {
    if (b.capsulesToOrder <= 0) continue;
    actions.push({
      partType: "bulk",
      code: b.bulkCode,
      name: b.description || "Bulk",
      qty: Math.ceil(b.capsulesToOrder / 1000),
      unit: "×1,000 caps",
      supplier: supplierOf.get(b.bulkCode) ?? "—",
      onOrder: Math.round(b.openPoQty / 1000),
      note: `${Math.round(b.capsulesNeeded).toLocaleString()} caps needed for ${b.skus.map(s => s.skuCode).join(", ")}`,
    });
  }

  // Raw materials — kg (+8% already in orderQty)
  for (const r of plan.rm) {
    if (r.orderQty <= 0) continue;
    actions.push({
      partType: "rm",
      code: r.code,
      name: r.name || "Raw material",
      qty: r.orderQty,
      unit: "kg",
      supplier: supplierOf.get(r.code) ?? "—",
      onOrder: r.openPoQty,
      note: `for bulk ${r.usedIn.map(u => u.bulkCode).join(", ")}`,
    });
  }

  // Ancillaries — units (+buffer already in orderQty)
  for (const a of plan.ancillary) {
    if (a.orderQty <= 0) continue;
    actions.push({
      partType: "ancillary",
      code: a.code,
      name: a.name || "Ancillary",
      qty: a.orderQty,
      unit: "units",
      supplier: supplierOf.get(a.code) ?? "—",
      onOrder: a.openPoQty,
      note: `${a.type} for ${a.usedIn.map(u => u.skuCode).join(", ")}`,
    });
  }

  // Group by supplier (unknown "—" last), suppliers alphabetical, lines by qty desc.
  const groups = new Map<string, OrderAction[]>();
  for (const a of actions) {
    if (!groups.has(a.supplier)) groups.set(a.supplier, []);
    groups.get(a.supplier)!.push(a);
  }
  const bySupplier: SupplierGroup[] = Array.from(groups.entries())
    .map(([supplier, list]) => ({ supplier, actions: list.sort((x, y) => y.qty - x.qty), lineCount: list.length }))
    .sort((a, b) => {
      if (a.supplier === "—") return 1;
      if (b.supplier === "—") return -1;
      return a.supplier.localeCompare(b.supplier);
    });

  return {
    actions,
    bySupplier,
    summary: {
      totalLines: actions.length,
      bulk: actions.filter(a => a.partType === "bulk").length,
      rm: actions.filter(a => a.partType === "rm").length,
      ancillary: actions.filter(a => a.partType === "ancillary").length,
      suppliers: bySupplier.filter(g => g.supplier !== "—").length,
    },
  };
}
