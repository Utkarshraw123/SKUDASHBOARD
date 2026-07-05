import { fetchSkus } from "@/lib/sheets";
import { getMarketMode, filterSkusByMode } from "@/lib/markets";
import CoverBadge from "@/components/CoverBadge";
import InventoryChart from "@/components/InventoryChart";
import FilterBar from "@/components/FilterBar";
import ExportCsvButton from "@/components/ExportCsvButton";
import Link from "next/link";
import { Suspense } from "react";

export const revalidate = 0;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: { search?: string; type?: string };
}) {
  const allSkus = await fetchSkus();
  const skus = filterSkusByMode(allSkus, getMarketMode());
  const types = Array.from(new Set(skus.map((s) => s.type).filter(Boolean))).sort();

  const search = searchParams.search?.toLowerCase() ?? "";
  const typeFilter = searchParams.type ?? "";

  let withInventory = skus
    .filter((s) => s.inventory !== null && s.inventory > 0)
    .sort((a, b) => (b.inventory ?? 0) - (a.inventory ?? 0));

  if (search) withInventory = withInventory.filter((s) => s.description.toLowerCase().includes(search) || s.skuCode.toLowerCase().includes(search));
  if (typeFilter) withInventory = withInventory.filter((s) => s.type === typeFilter);

  const byType: Record<string, number> = {};
  for (const s of skus) {
    const t = s.type || "Other";
    byType[t] = (byType[t] ?? 0) + (s.inventory ?? 0);
  }
  const chartData = Object.entries(byType)
    .filter(([t]) => t.trim())
    .map(([type, units]) => ({ type, units }))
    .sort((a, b) => b.units - a.units);

  const totalInventory = withInventory.reduce((s, r) => s + (r.inventory ?? 0), 0);

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">Inventory</h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">
          {withInventory.length} SKUs · {totalInventory.toLocaleString()} total units
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-[#e4ddd4] p-7 mb-8">
        <h2 className="font-serif text-lg text-charcoal mb-5">Units by Product Type</h2>
        <InventoryChart data={chartData} />
      </div>

      <Suspense>
        <FilterBar
          searchPlaceholder="Search by product or SKU…"
          filters={[
            {
              key: "type",
              label: "Type",
              options: types.map((t) => ({ value: t, label: t })),
            },
          ]}
        />
      </Suspense>

      <div className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#e4ddd4] bg-cream text-xs text-text-muted flex items-center justify-end">
          <ExportCsvButton filename="inventory" />
        </div>
        {withInventory.length === 0 ? (
          <p className="px-5 py-10 text-center text-text-muted text-sm">No results match your filters.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-cream border-b border-[#e4ddd4]">
              <tr className="text-left">
                <th className="px-5 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">SKU</th>
                <th className="px-5 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">Product</th>
                <th className="px-5 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">Type</th>
                <th className="px-5 py-4 text-xs tracking-widest uppercase text-text-muted font-medium text-right">Total</th>
                <th className="px-5 py-4 text-xs tracking-widest uppercase text-text-muted font-medium text-right">WNP</th>
                <th className="px-5 py-4 text-xs tracking-widest uppercase text-text-muted font-medium text-right">External</th>
                <th className="px-5 py-4 text-xs tracking-widest uppercase text-text-muted font-medium text-right">Fill</th>
                <th className="px-5 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">Cover</th>
              </tr>
            </thead>
            <tbody>
              {withInventory.map((s) => (
                <tr key={s.skuCode} className="border-b border-[#e4ddd4]/60 hover:bg-cream transition-colors">
                  <td className="px-5 py-3">
                    <Link href={`/sku/${s.skuCode}`} className="font-mono text-xs text-copper hover:opacity-70">
                      {s.skuCode}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-charcoal max-w-xs truncate">{s.description}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-cream-dark px-2.5 py-0.5 text-xs text-text-muted">{s.type || "—"}</span>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-charcoal">{s.inventory?.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right text-text-muted">{s.wnpStock?.toLocaleString() ?? "—"}</td>
                  <td className="px-5 py-3 text-right text-text-muted">{s.externalStock?.toLocaleString() ?? "—"}</td>
                  <td className="px-5 py-3 text-right text-text-muted">{s.fill ?? "—"}</td>
                  <td className="px-5 py-3"><CoverBadge cover={s.cover} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
