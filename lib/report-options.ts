import { fetchWNPPlanning, fetchSkus, fetchCurrentInventory } from "@/lib/sheets";
import type { WorkOrderOption } from "@/components/ProductionReportForm";

// Build the work-order picker options for the production report form.
// Shared by the dashboard page (app/planning/report) and the /floor app page
// (app/floor/report) so both always offer the exact same list. Newest work
// order first, de-duplicated by work-order number.
export async function buildWorkOrderOptions(): Promise<WorkOrderOption[]> {
  const [planning, skus, inventory] = await Promise.all([
    fetchWNPPlanning(),
    fetchSkus(),
    fetchCurrentInventory(),
  ]);

  const skuDesc = new Map(skus.map((s) => [s.skuCode, s.description]));
  const partDesc = new Map<string, string>();
  for (const r of inventory) if (!partDesc.has(r.partNumber)) partDesc.set(r.partNumber, r.description);

  const options: WorkOrderOption[] = planning
    .filter((r) => r.workOrderNo && r.workOrderNo.trim() !== "")
    .reverse()
    .map((r) => ({
      workOrder: r.workOrderNo,
      sku: r.productCode,
      description: r.description || skuDesc.get(r.productCode) || "",
      productBatch: r.batch || "",
      productBBD: r.bbd || "",
      bulkCode: r.bulkCode || "",
      bulkDescription: r.bulkCode ? partDesc.get(r.bulkCode) || "" : "",
    }));

  const seen = new Set<string>();
  return options.filter((o) => (seen.has(o.workOrder) ? false : (seen.add(o.workOrder), true)));
}
