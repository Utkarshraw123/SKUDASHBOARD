import { fetchProductionReportRows } from "@/lib/sheets";
import { computeInternalYield } from "@/lib/internal-yield";
import ProductionRecordsView from "@/components/ProductionRecordsView";

// Near-real-time: reports appear here shortly after the form is submitted.
export const revalidate = 60;

export default async function ProductionReportsPage() {
  const rows = await fetchProductionReportRows();
  const { reports } = computeInternalYield(rows);

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">Production Reports</h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">
          Every internal production report submitted on the form &mdash; one row per report, with usage, output,
          batches, wastage and disposal. Search and export the full record.
        </p>
      </div>
      <ProductionRecordsView reports={reports} />
    </div>
  );
}
