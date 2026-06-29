import { fetchSkus } from "@/lib/sheets";
import Link from "next/link";

export const revalidate = 300;

export default async function VariancePage() {
  const skus = await fetchSkus();

  const withVariance = skus
    .filter((s) => s.salesVariance !== null)
    .sort((a, b) => (b.salesVariance ?? 0) - (a.salesVariance ?? 0));

  const outperforming = withVariance.filter((s) => (s.salesVariance ?? 0) > 0);
  const underperforming = withVariance.filter((s) => (s.salesVariance ?? 0) < 0);

  function VarianceTable({ rows, positive }: { rows: typeof withVariance; positive: boolean }) {
    return (
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr className="text-left text-gray-500">
            <th className="px-4 py-3 font-medium">SKU</th>
            <th className="px-4 py-3 font-medium">Product</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium text-right">Avg Demand</th>
            <th className="px-4 py-3 font-medium text-right">Last Qtr Demand</th>
            <th className="px-4 py-3 font-medium text-right">Variance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
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
              <td className="px-4 py-2.5 text-right text-gray-600">{s.monthlyDemandAvg?.toLocaleString() ?? "—"}</td>
              <td className="px-4 py-2.5 text-right text-gray-600">{s.monthlyDemandLastQtr?.toLocaleString() ?? "—"}</td>
              <td className="px-4 py-2.5 text-right">
                <span className={`font-semibold ${positive ? "text-green-600" : "text-red-600"}`}>
                  {positive ? "+" : ""}{s.salesVariance}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Sales Variance</h1>
        <p className="text-gray-500 text-sm mt-1">Comparing average demand vs last quarter actuals</p>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-green-600 text-lg">↑</span>
          <h2 className="text-base font-semibold text-gray-800">Outperforming ({outperforming.length})</h2>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <VarianceTable rows={outperforming} positive={true} />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-red-500 text-lg">↓</span>
          <h2 className="text-base font-semibold text-gray-800">Underperforming ({underperforming.length})</h2>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <VarianceTable rows={underperforming} positive={false} />
        </div>
      </div>
    </div>
  );
}
