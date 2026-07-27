import { fetchSkus, fetchProduction, fetchBulkOpenPOs, fetchRmBom, fetchAncillaryBom, fetchCurrentInventory, fetchWowDemand, fetchPackingSchedule } from "@/lib/sheets";
import { computePlan } from "@/lib/procurement";
import { buildOrderActions } from "@/lib/procurement-actions";
import ProcurementActionsView from "@/components/ProcurementActionsView";
import Link from "next/link";

export const revalidate = 0;

function defaultCycle(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 3, 0);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: iso(start), end: iso(end) };
}

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

export default async function ProcurementActionsPage({
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
    fetchSkus(), fetchProduction(), fetchBulkOpenPOs(), fetchPackingSchedule(),
    fetchRmBom(), fetchAncillaryBom(), fetchCurrentInventory(), fetchWowDemand(),
  ]);

  const plan = computePlan({ skus, inventory, production, bulkPOs, packing, rmBom, ancBom, wow, cycleStart, cycleEnd, globalCover, cmCover, perSku });
  const list = buildOrderActions(plan, bulkPOs, production);

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">Procurement Actions</h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">
          Everything to order for the cycle {startStr} → {endStr}, grouped by supplier — the draft order list to hand to purchasing.{" "}
          <Link href="/procurement" className="text-copper hover:opacity-70">← full plan &amp; workings</Link>
        </p>
      </div>
      <ProcurementActionsView list={list} />
    </div>
  );
}
