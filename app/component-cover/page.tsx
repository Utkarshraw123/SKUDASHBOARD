import { fetchSkus, fetchCurrentInventory, fetchRmBom, fetchAncillaryBom } from "@/lib/sheets";
import { computeComponentCover } from "@/lib/component-cover";
import ComponentCoverView from "@/components/ComponentCoverView";

export const revalidate = 0;

export default async function ComponentCoverPage() {
  const [skus, inventory, rmBom, ancBom] = await Promise.all([
    fetchSkus(),
    fetchCurrentInventory(),
    fetchRmBom(),
    fetchAncillaryBom(),
  ]);

  const result = computeComponentCover({ skus, inventory, rmBom, ancBom });

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">Component Cover</h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">
          Weeks of cover for bulk, raw materials &amp; ancillaries — driven by finished-goods demand through the BOMs.
          Finished goods are on the Cover Risk page. Red &lt; {result.thresholds.critical}w, amber &lt; {result.thresholds.low}w.
        </p>
      </div>
      <ComponentCoverView result={result} />
    </div>
  );
}
