import { fetchSkus } from "@/lib/sheets";
import { getCoverStatus } from "@/lib/types";
import KpiCard from "@/components/KpiCard";
import CoverBadge from "@/components/CoverBadge";
import InventoryChart from "@/components/InventoryChart";
import Link from "next/link";

export const revalidate = 300;

export default async function OverviewPage() {
  const skus = await fetchSkus();

  const totalSKUs = skus.length;
  const critical = skus.filter((s) => getCoverStatus(s.cover) === "critical");
  const low = skus.filter((s) => getCoverStatus(s.cover) === "low");
  const totalInventory = skus.reduce((sum, s) => sum + (s.inventory ?? 0), 0);

  // Inventory by type chart data
  const byType: Record<string, number> = {};
  for (const s of skus) {
    const t = s.type || "Other";
    byType[t] = (byType[t] ?? 0) + (s.inventory ?? 0);
  }
  const chartData = Object.entries(byType)
    .filter(([t]) => t && t.trim())
    .map(([type, units]) => ({ type, units }))
    .sort((a, b) => b.units - a.units);

  const top5Critical = critical
    .filter((s) => (s.monthlyDemandAvg ?? 0) > 0)
    .sort((a, b) => (b.monthlyDemandAvg ?? 0) - (a.monthlyDemandAvg ?? 0))
    .slice(0, 5);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-gray-500 text-sm mt-1">Live data from Google Sheets · ALL SKU DASHBOARD</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard title="Total SKUs" value={totalSKUs} color="blue" />
        <KpiCard
          title="Critical (<4 weeks)"
          value={critical.length}
          subtitle="Immediate attention required"
          color="red"
        />
        <KpiCard
          title="Low Cover (4–8 weeks)"
          value={low.length}
          subtitle="Action needed soon"
          color="amber"
        />
        <KpiCard
          title="Total Inventory"
          value={totalInventory.toLocaleString()}
          subtitle="Units across all locations"
          color="green"
        />
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Inventory by Product Type</h2>
        <InventoryChart data={chartData} />
      </div>

      {/* Top critical SKUs */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">Top Critical SKUs by Demand</h2>
          <Link href="/risk" className="text-sm text-brand-green font-medium hover:underline">
            View all →
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="pb-2 font-medium">SKU</th>
              <th className="pb-2 font-medium">Product</th>
              <th className="pb-2 font-medium">Type</th>
              <th className="pb-2 font-medium">Cover</th>
              <th className="pb-2 font-medium text-right">Monthly Demand</th>
            </tr>
          </thead>
          <tbody>
            {top5Critical.map((s) => (
              <tr key={s.skuCode} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2.5">
                  <Link href={`/sku/${s.skuCode}`} className="font-mono text-xs text-brand-green hover:underline">
                    {s.skuCode}
                  </Link>
                </td>
                <td className="py-2.5 text-gray-900">{s.description}</td>
                <td className="py-2.5">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{s.type}</span>
                </td>
                <td className="py-2.5"><CoverBadge cover={s.cover} /></td>
                <td className="py-2.5 text-right font-medium">{s.monthlyDemandAvg?.toLocaleString() ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
