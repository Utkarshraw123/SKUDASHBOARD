import { fetchWNPPlanning, fetchSkus, fetchCurrentInventory, fetchProductionReportRows } from "@/lib/sheets";
import { computeInternalYield } from "@/lib/internal-yield";
import type { WorkOrderOption, EditReport } from "@/components/ProductionReportForm";

const numStr = (n: number) => (n ? String(n) : "");

// Load an existing production report and build the edit-prefill payload (all
// numerics as strings to match the form inputs). Shared by the dashboard edit
// page and the /floor app edit flow. Returns undefined if the id is unknown.
export async function buildEditReport(editId: string): Promise<EditReport | undefined> {
  const id = editId.trim();
  if (!id) return undefined;
  const rows = await fetchProductionReportRows();
  const report = computeInternalYield(rows).reports.find((r) => r.reportId === id);
  if (!report) return undefined;

  const nBatch = Math.max(report.productBatches.length, report.productBBDs.length, 1);
  const batches = Array.from({ length: nBatch }, (_, i) => ({
    batch: report.productBatches[i] ?? "",
    bbd: report.productBBDs[i] ?? "",
  }));
  const bulks = report.bulks.map((b) => ({
    bulkCode: b.bulkCode,
    bulkDescription: b.bulkDescription,
    bulkBatch: b.bulkBatch,
    bulkBBD: b.bulkBBD,
    used: numStr(b.used),
    wasteCapsules: numStr(b.wasteCapsules),
  }));

  return {
    reportId: report.reportId,
    timestamp: report.timestamp,
    workOrder: report.workOrder,
    sku: report.sku,
    description: report.description,
    productType: report.productType,
    batches,
    bulks: bulks.length ? bulks : [{ bulkCode: "", bulkDescription: "", bulkBatch: "", bulkBBD: "", used: "", wasteCapsules: "" }],
    made: numStr(report.made),
    people: numStr(report.people),
    woStatus: report.woStatus || "complete",
    anc: {
      jars: numStr(report.ancWaste.jars),
      lids: numStr(report.ancWaste.lids),
      labels: numStr(report.ancWaste.labels),
      box: numStr(report.ancWaste.box),
      pouches: numStr(report.ancWaste.pouches),
      desiccants: numStr(report.ancWaste.desiccants),
    },
    disposalNumber: report.disposalNumber,
    comments: report.comments,
  };
}

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
