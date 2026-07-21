import { fetchProductionReportRows } from "@/lib/sheets";
import { computeInternalYield } from "@/lib/internal-yield";
import InternalYieldView from "@/components/InternalYieldView";

// Near-real-time: reports appear here shortly after the form is submitted.
export const revalidate = 60;

export default async function InternalYieldPage() {
  const rows = await fetchProductionReportRows();
  const data = computeInternalYield(rows);

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">Internal Production Yield</h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">
          Every production run reported on the form &mdash; line items, wastage by work order, week, month &amp; ancillary type, and batch-level traceability for compliance.
        </p>
      </div>
      <InternalYieldView data={data} />
    </div>
  );
}
