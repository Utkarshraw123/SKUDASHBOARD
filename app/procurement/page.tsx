import { fetchSkus, fetchProduction, fetchWNPPlanning, fetchBulkOpenPOs, fetchPackingSchedule, fetchRmBom, fetchAncillaryBom, fetchCurrentInventory } from "@/lib/sheets";
import { computePlan } from "@/lib/procurement";
import ProcurementView, { CyclePicker } from "@/components/ProcurementView";
import { Suspense } from "react";

export const revalidate = 0;

function isoPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export default async function ProcurementPage({
  searchParams,
}: {
  searchParams: { start?: string; end?: string };
}) {
  // default cycle: starts in 8 weeks, runs for 8 weeks
  const startStr = searchParams.start ?? isoPlusDays(56);
  const endStr = searchParams.end ?? isoPlusDays(112);

  const cycleStart = new Date(startStr);
  const cycleEnd = new Date(endStr);

  const [skus, production, planning, bulkPOs, packing, rmBom, ancBom, inventory] = await Promise.all([
    fetchSkus(),
    fetchProduction(),
    fetchWNPPlanning(),
    fetchBulkOpenPOs(),
    fetchPackingSchedule(),
    fetchRmBom(),
    fetchAncillaryBom(),
    fetchCurrentInventory(),
  ]);

  const plan = computePlan({ skus, inventory, production, planning, bulkPOs, packing, rmBom, ancBom, cycleStart, cycleEnd });

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">Procurement Planner</h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">
          Cycle planning — finished goods → bulk → raw materials → ancillaries, netted against stock, committed usage and open POs
        </p>
      </div>

      <Suspense>
        <CyclePicker start={startStr} end={endStr} />
      </Suspense>

      <ProcurementView plan={plan} />
    </div>
  );
}
