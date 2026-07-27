import { fetchSkus, fetchProduction, fetchBulkOpenPOs, fetchRmBom, fetchAncillaryBom, fetchCurrentInventory, fetchWowDemand, fetchPackingSchedule } from "@/lib/sheets";
import { computePlan } from "@/lib/procurement";
import { buildOrderActions } from "@/lib/procurement-actions";
import ProcurementView from "@/components/ProcurementView";
import Link from "next/link";

export const revalidate = 0;

// Default cycle: a two-month (bimonthly) window starting the 1st of next month.
function defaultCycle(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 3, 0); // last day of month+2
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: iso(start), end: iso(end) };
}

// Parse per-SKU overrides "sku:wks,sku:wks" → { sku: weeks }.
function parsePerSku(s?: string): Record<string, number> {
  const out: Record<string, number> = {};
  if (!s) return out;
  for (const pair of s.split(",")) {
    const [sku, wks] = pair.split(":");
    const n = Number(wks);
    if (sku && !isNaN(n) && n > 0) out[sku.trim()] = n;
  }
  return out;
}

export default async function ProcurementPage({
  searchParams,
}: {
  searchParams: { start?: string; end?: string; cover?: string; coverCM?: string; cov?: string };
}) {
  const def = defaultCycle();
  const startStr = searchParams.start ?? def.start;
  const endStr = searchParams.end ?? def.end;
  const cycleStart = new Date(startStr);
  const cycleEnd = new Date(endStr);
  const globalCover = Number(searchParams.cover) || 16;
  const cmCover = Number(searchParams.coverCM) || 20;
  const perSku = parsePerSku(searchParams.cov);

  const [skus, production, bulkPOs, packing, rmBom, ancBom, inventory, wow] = await Promise.all([
    fetchSkus(),
    fetchProduction(),
    fetchBulkOpenPOs(),
    fetchPackingSchedule(),
    fetchRmBom(),
    fetchAncillaryBom(),
    fetchCurrentInventory(),
    fetchWowDemand(),
  ]);

  const plan = computePlan({ skus, inventory, production, bulkPOs, packing, rmBom, ancBom, wow, cycleStart, cycleEnd, globalCover, cmCover, perSku });
  const orders = buildOrderActions(plan, bulkPOs, production);

  return (
    <div className="max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">Procurement Planner <span className="text-text-muted text-base font-sans">· MRP</span></h1>
          <Link href="/procurement/actions" className="text-xs tracking-widest uppercase text-copper border border-copper/30 rounded-full px-3.5 py-1.5 hover:bg-copper hover:text-white transition-colors">
            Order action list →
          </Link>
        </div>
        <p className="text-text-muted text-sm mt-2 tracking-wide">
          Weekly-forecast MRP — plan a cycle to a target cover; finished goods built from scratch (stock + open POs only), cascaded to bulk → raw materials → ancillaries.
        </p>
      </div>

      <ProcurementView plan={plan} orders={orders} start={startStr} end={endStr} cover={globalCover} coverCM={cmCover} perSkuOverrides={perSku} />
    </div>
  );
}
