import { fetchSkus } from "@/lib/sheets";
import CoverBadge from "@/components/CoverBadge";
import InventoryChart from "@/components/InventoryChart";
import Link from "next/link";

export const revalidate = 300;

export default async function InventoryPage() {
  const skus = await fetchSkus();

  const withInventory = skus
    .filter((s) => s.inventory !== null && s.inventory > 0)
    .sort((a, b) => (b.inventory ?? 0) - (a.inventory ?? 0));

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
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <p className="text-gray-500 text-sm mt-1">
          {withInventory.length} SKUs · {totalInventory.toLocaleString()} total units
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Units by Product Type</h2>
        <InventoryChart data={chartData} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-gray-500">
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium text-right">Total Inventory</th>
              <th className="px-4 py-3 font-medium text-right">WNP Stock</th>
              <th className="px-4 py-3 font-medium text-right">External</th>
              <th className="px-4 py-3 font-medium text-right">Fill %</th>
              <th className="px-4 py-3 font-medium">Cover</th>
            </tr>
          </thead>
          <tbody>
            {withInventory.map((s) => (
              <tr key={s.skuCode} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <Link href={`/sku/${s.skuCode}`} className="font-mono text-xs text-brand-green hover:underline">
                    {s.skuCode}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-gray-900 max-w-xs truncate">{s.description}</td>
                <td className="px-4 py-2.5">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{s.type || "—"}</span>
                </td>
                <td className="px-4 py-2.5 text-right font-semibold">{s.inventory?.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">{s.wnpStock?.toLocaleString() ?? "—"}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">{s.externalStock?.toLocaleString() ?? "—"}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">{s.fill !== null ? `${s.fill}%` : "—"}</td>
                <td className="px-4 py-2.5"><CoverBadge cover={s.cover} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
