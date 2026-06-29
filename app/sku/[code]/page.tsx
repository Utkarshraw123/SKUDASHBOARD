import { fetchSkus } from "@/lib/sheets";
import CoverBadge from "@/components/CoverBadge";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 300;

export default async function SkuDetailPage({ params }: { params: { code: string } }) {
  const skus = await fetchSkus();
  const sku = skus.find((s) => s.skuCode === params.code);
  if (!sku) notFound();

  function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
    if (value === null || value === undefined || value === "") return null;
    return (
      <div className="flex items-start justify-between py-2.5 border-b border-gray-100">
        <span className="text-sm text-gray-500 w-1/2">{label}</span>
        <span className="text-sm font-medium text-gray-900 text-right">{typeof value === "number" ? value.toLocaleString() : value}</span>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/risk" className="text-sm text-brand-green hover:underline">← Back to Risk</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">{sku.description}</h1>
        <div className="flex items-center gap-3 mt-2">
          <span className="font-mono text-sm text-gray-500">{sku.skuCode}</span>
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{sku.type}</span>
          <CoverBadge cover={sku.cover} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inventory */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Inventory</h2>
          <Row label="Total Inventory" value={sku.inventory} />
          <Row label="WNP Stock" value={sku.wnpStock} />
          <Row label="External Stock (EXG)" value={sku.externalStock} />
          <Row label="Fill %" value={sku.fill !== null ? `${sku.fill}%` : null} />
          <Row label="Cover at WNP" value={sku.coverAtWNP !== null ? `${sku.coverAtWNP} weeks` : null} />
          <Row label="Projected Cover" value={sku.projectedCover !== null ? `${sku.projectedCover} weeks` : null} />
        </div>

        {/* Demand */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Demand</h2>
          <Row label="Monthly Demand (Avg)" value={sku.monthlyDemandAvg} />
          <Row label="Monthly Demand (Last Qtr)" value={sku.monthlyDemandLastQtr} />
          <Row label="Sales Variance" value={sku.salesVariance !== null ? `${sku.salesVariance}%` : null} />
          <Row label="12-Week Demand" value={sku.demand12Week} />
          <Row label="3-Month Demand" value={sku.demand3Month} />
          <Row label="16-Week Cover" value={sku.demand16WeekCover !== null ? `${sku.demand16WeekCover} weeks` : null} />
        </div>

        {/* Bulk Potential */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Bulk Potential</h2>
          <Row label="Potential Bulk → Units @ WNP" value={sku.potentialBulkToUnits} />
          <Row label="Potential FG @ WNC" value={sku.potentialFGWNC} />
          <Row label="Bulk at WNC" value={sku.bulkAtWNC} />
          <Row label="Total Potential Units" value={sku.totalPotentialUnits} />
          <Row label="Total Weeks Potential Cover" value={sku.totalWeeksCover !== null ? `${sku.totalWeeksCover} weeks` : null} />
          <Row label="Potential Units at Other Locations" value={sku.potentialUnitsOther} />
          <Row label="Bulk at Other" value={sku.bulkAtOther} />
        </div>

        {/* Planned Deliveries */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Planned Deliveries</h2>
          <p className="text-xs text-gray-400 mb-2">Bulk</p>
          <Row label="Next Bulk Delivery" value={sku.nextBulkDelivery} />
          <Row label="Bulk Quantity" value={sku.bulkDeliveryQty} />
          <Row label="Bulk ETA (week commencing)" value={sku.bulkETA} />
          <Row label="Bulk Planned Qty" value={sku.bulkPlannedQty} />
          <Row label="Packer / Vendor" value={sku.packerVendor} />
          <Row label="Total Planned (Ts)" value={sku.totalPlannedTs} />

          <p className="text-xs text-gray-400 mt-4 mb-2">Packing</p>
          <Row label="Next Packing Delivery" value={sku.nextPackingDelivery} />
          <Row label="Packing Quantity" value={sku.packingDeliveryQty} />
          <Row label="Packing ETA" value={sku.packingETA} />
          <Row label="Packing Vendor" value={sku.packingVendor} />
          <Row label="Total Packing Planned" value={sku.totalPackingPlanned} />

          <p className="text-xs text-gray-400 mt-4 mb-2">Planning Gap</p>
          <Row label="Units to be Planned" value={sku.unitsToBePlanned} />
          <Row label="Units Not Planned" value={sku.unitsNotPlanned} />
        </div>
      </div>
    </div>
  );
}
