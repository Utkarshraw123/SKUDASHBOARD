import { fetchProductionReportRows } from "@/lib/sheets";
import { buildWorkOrderOptions } from "@/lib/report-options";
import { computeInternalYield } from "@/lib/internal-yield";
import ProductionReportForm, { type EditReport } from "@/components/ProductionReportForm";

export const revalidate = 300;

const numStr = (n: number) => (n ? String(n) : "");

export default async function ProductionReportPage({
  searchParams,
}: {
  searchParams: { edit?: string };
}) {
  const editId = searchParams.edit?.trim() || "";

  const unique = await buildWorkOrderOptions();

  // Edit mode: load the report and build a pre-fill payload from the yield engine.
  let editReport: EditReport | undefined;
  if (editId) {
    const rows = await fetchProductionReportRows();
    const report = computeInternalYield(rows).reports.find(r => r.reportId === editId);
    if (report) {
      const nBatch = Math.max(report.productBatches.length, report.productBBDs.length, 1);
      const batches = Array.from({ length: nBatch }, (_, i) => ({
        batch: report.productBatches[i] ?? "",
        bbd: report.productBBDs[i] ?? "",
      }));
      const bulks = report.bulks.map(b => ({
        bulkCode: b.bulkCode,
        bulkDescription: b.bulkDescription,
        bulkBatch: b.bulkBatch,
        bulkBBD: b.bulkBBD,
        used: numStr(b.used),
        wasteCapsules: numStr(b.wasteCapsules),
      }));
      editReport = {
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
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">
          {editReport ? "Edit Production Report" : "Production Report"}
        </h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">
          {editReport
            ? "Update this internal production report and save — the record is overwritten in place."
            : "Internal production reporting — select a work order, confirm the details, and record usage & waste."}
        </p>
      </div>
      <ProductionReportForm options={unique} editReport={editReport} />
    </div>
  );
}
