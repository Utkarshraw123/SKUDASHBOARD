import { fetchSkus } from "@/lib/sheets";
import { futureDateOnly, futureDateFull } from "@/lib/markets";
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
      <div className="flex items-start justify-between py-3 border-b border-[#e4ddd4]/60">
        <span className="text-xs tracking-widest uppercase text-text-muted w-1/2">{label}</span>
        <span className="text-sm font-medium text-charcoal text-right">
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
      </div>
    );
  }

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="bg-white rounded-2xl border border-[#e4ddd4] p-6">
        <h2 className="font-serif text-base text-charcoal mb-4">{title}</h2>
        {children}
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <Link href="/risk" className="text-xs text-copper tracking-widest uppercase hover:opacity-70 transition-opacity">
          ← Back to Risk
        </Link>
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide mt-3">{sku.description}</h1>
        <div className="flex items-center gap-3 mt-3">
          <span className="font-mono text-sm text-text-muted">{sku.skuCode}</span>
          <span className="rounded-full bg-cream-dark px-2.5 py-0.5 text-xs text-text-muted">{sku.type}</span>
          <CoverBadge cover={sku.cover} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section title="Inventory">
          <Row label="Total Inventory" value={sku.inventory} />
          <Row label="WNP Stock" value={sku.wnpStock} />
          <Row label="External Stock (EXG)" value={sku.externalStock} />
          <Row label="Fill" value={sku.fill} />
          <Row label="Cover at WNP" value={sku.coverAtWNP !== null ? `${sku.coverAtWNP} weeks` : null} />
          <Row label="Projected Cover" value={sku.projectedCover !== null ? `${sku.projectedCover} weeks` : null} />
        </Section>

        <Section title="Demand">
          <Row label="Monthly Demand (Avg)" value={sku.monthlyDemandAvg} />
          <Row label="Monthly Demand (Last Qtr)" value={sku.monthlyDemandLastQtr} />
          <Row label="Sales Variance" value={sku.salesVariance !== null ? `${sku.salesVariance}%` : null} />
          <Row label="12-Week Demand" value={sku.demand12Week} />
          <Row label="3-Month Demand" value={sku.demand3Month} />
          <Row label="16-Week Cover" value={sku.demand16WeekCover !== null ? `${sku.demand16WeekCover} weeks` : null} />
        </Section>

        <Section title="Bulk Potential">
          <Row label="Potential Bulk → Units @ WNP" value={sku.potentialBulkToUnits} />
          <Row label="Potential FG @ WNC" value={sku.potentialFGWNC} />
          <Row label="Bulk at WNC" value={sku.bulkAtWNC} />
          <Row label="Total Potential Units" value={sku.totalPotentialUnits} />
          <Row label="Total Weeks Potential Cover" value={sku.totalWeeksCover !== null ? `${sku.totalWeeksCover} weeks` : null} />
          <Row label="Potential Units at Other" value={sku.potentialUnitsOther} />
          <Row label="Bulk at Other" value={sku.bulkAtOther} />
        </Section>

        <Section title="Planned Deliveries">
          <p className="text-xs text-text-muted tracking-widest uppercase mb-2">Bulk</p>
          <Row label="Next Bulk Delivery" value={futureDateOnly(sku.nextBulkDelivery)} />
          <Row label="Bulk Quantity" value={sku.bulkDeliveryQty} />
          <Row label="Bulk ETA" value={futureDateFull(sku.bulkETA)} />
          <Row label="Packer / Vendor" value={sku.packerVendor} />
          <Row label="Total Planned (Ts)" value={sku.totalPlannedTs} />
          <p className="text-xs text-text-muted tracking-widest uppercase mt-4 mb-2">Packing</p>
          <Row label="Next Packing Delivery" value={futureDateOnly(sku.nextPackingDelivery)} />
          <Row label="Packing Quantity" value={sku.packingDeliveryQty} />
          <Row label="Packing ETA" value={futureDateFull(sku.packingETA)} />
          <Row label="Packing Vendor" value={sku.packingVendor} />
          <Row label="Total Packing Planned" value={sku.totalPackingPlanned} />
          <p className="text-xs text-text-muted tracking-widest uppercase mt-4 mb-2">Planning Gap</p>
          <Row label="Units to be Planned" value={sku.unitsToBePlanned} />
          <Row label="Units Not Planned" value={sku.unitsNotPlanned} />
        </Section>
      </div>
    </div>
  );
}
