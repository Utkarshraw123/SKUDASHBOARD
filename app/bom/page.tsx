import { fetchRmBom, fetchAncillaryBom } from "@/lib/sheets";
import { Suspense } from "react";
import BomSearch from "@/components/BomSearch";

export const revalidate = 3600;

export default async function BomPage() {
  const [rmBom, ancBom] = await Promise.all([fetchRmBom(), fetchAncillaryBom()]);

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">Bill of Materials</h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">
          Search by ingredient, ancillary, or product code to explore recipes and usage
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "1-Code Blends", value: rmBom.products.length, sub: "Bulk formulas with RM breakdown" },
          { label: "2-Code Ingredients", value: rmBom.byComponent.size, sub: "Raw materials in use" },
          { label: "3-Code Finished Goods", value: ancBom.products.length, sub: "Packaged products" },
          { label: "4-Code Ancillaries", value: ancBom.byComponent.size, sub: "Labels, boxes, jars in use" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-white rounded-2xl border border-[#e4ddd4] px-5 py-4">
            <p className="text-xs tracking-widest uppercase text-text-muted mb-1">{label}</p>
            <p className="text-2xl font-serif font-medium text-copper">{value}</p>
            <p className="text-xs text-text-muted mt-1">{sub}</p>
          </div>
        ))}
      </div>

      <Suspense>
        <BomSearch rmBom={rmBom} ancBom={ancBom} />
      </Suspense>
    </div>
  );
}
