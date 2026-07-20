import { fetchSkus, fetchProduction, fetchWNPPlanning, fetchBulkOpenPOs, fetchPackingSchedule, fetchRmBom, fetchAncillaryBom, fetchCurrentInventory } from "@/lib/sheets";
import { computePlan } from "@/lib/procurement";
import { buildOrderActions } from "@/lib/procurement-actions";
import ProcurementActionsView from "@/components/ProcurementActionsView";
import Link from "next/link";

export const revalidate = 0;

function isoPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export default async function ProcurementActionsPage({
  searchParams,
}: {
  searchParams: { start?: string; end?: string };
}) {
  const startStr = searchParams.start ?? isoPlusDays(56);
  const endStr = searchParams.end ?? isoPlusDays(112);
  const cycleStart = new Date(startStr);
  const cycleEnd = new Date(endStr);

  const [skus, production, planning, bulkPOs, packing, rmBom, ancBom, inventory] = await Promise.all([
    fetchSkus(), fetchProduction(), fetchWNPPlanning(), fetchBulkOpenPOs(),
    fetchPackingSchedule(), fetchRmBom(), fetchAncillaryBom(), fetchCurrentInventory(),
  ]);

  const plan = computePlan({ skus, inventory, production, planning, bulkPOs, packing, rmBom, ancBom, cycleStart, cycleEnd });
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
