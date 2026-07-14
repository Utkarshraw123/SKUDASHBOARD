import { fetchWNPPlanning, fetchSkus, fetchCurrentInventory } from "@/lib/sheets";
import ProductionReportForm, { type WorkOrderOption } from "@/components/ProductionReportForm";

export const revalidate = 300;

export default async function ProductionReportPage() {
  const [planning, skus, inventory] = await Promise.all([
    fetchWNPPlanning(),
    fetchSkus(),
    fetchCurrentInventory(),
  ]);

  const skuDesc = new Map(skus.map(s => [s.skuCode, s.description]));
  const partDesc = new Map<string, string>();
  for (const r of inventory) if (!partDesc.has(r.partNumber)) partDesc.set(r.partNumber, r.description);

  // newest first, only rows with a work order
  const options: WorkOrderOption[] = planning
    .filter(r => r.workOrderNo && r.workOrderNo.trim() !== "")
    .reverse()
    .map(r => ({
      workOrder: r.workOrderNo,
      sku: r.productCode,
      description: r.description || skuDesc.get(r.productCode) || "",
      productBatch: r.batch || "",
      productBBD: r.bbd || "",
      bulkCode: r.bulkCode || "",
      bulkDescription: r.bulkCode ? (partDesc.get(r.bulkCode) || "") : "",
    }));

  // de-dup by work order (keep first / newest)
  const seen = new Set<string>();
  const unique = options.filter(o => (seen.has(o.workOrder) ? false : (seen.add(o.workOrder), true)));

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">Production Report</h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">
          Internal production reporting — select a work order, confirm the details, and record usage &amp; waste.
        </p>
      </div>
      <ProductionReportForm options={unique} />
    </div>
  );
}
