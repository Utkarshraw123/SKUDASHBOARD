import { fetchWNPPlanning, fetchSkus, fetchCurrentInventory, fetchProduction, fetchBulkOpenPOs, fetchAncillaryBom, fetchRmBom } from "@/lib/sheets";
import { computeReadiness } from "@/lib/readiness";
import ReadinessView from "@/components/ReadinessView";

export const revalidate = 0;

export default async function ReadinessPage({
  searchParams,
}: {
  searchParams: { days?: string };
}) {
  const horizonDays = Math.min(60, Math.max(1, Number(searchParams.days) || 10));

  const [planning, skus, inventory, production, bulkPOs, ancBom, rmBom] = await Promise.all([
    fetchWNPPlanning(),
    fetchSkus(),
    fetchCurrentInventory(),
    fetchProduction(),
    fetchBulkOpenPOs(),
    fetchAncillaryBom(),
    fetchRmBom(),
  ]);

  const result = computeReadiness({ planning, skus, inventory, production, bulkPOs, ancBom, rmBom, horizonDays });

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">Production Readiness</h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">
          Work orders scheduled in the next {result.horizonDays} days ({result.fromLabel} – {result.toLabel}), checked
          for bulk &amp; ancillary availability so nothing halts the line.
        </p>
      </div>
      <ReadinessView result={result} />
    </div>
  );
}
