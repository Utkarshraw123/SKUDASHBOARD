import { fetchSkus } from "@/lib/sheets";
import { getCoverStatus } from "@/lib/types";
import CoverBadge from "@/components/CoverBadge";
import Link from "next/link";

export const revalidate = 300;

export default async function RiskPage() {
  const skus = await fetchSkus();

  const atRisk = skus
    .filter((s) => s.cover !== null && s.cover < 16)
    .sort((a, b) => (a.cover ?? 999) - (b.cover ?? 999));

  const counts = {
    critical: atRisk.filter((s) => getCoverStatus(s.cover) === "critical").length,
    low: atRisk.filter((s) => getCoverStatus(s.cover) === "low").length,
    ok: atRisk.filter((s) => getCoverStatus(s.cover) === "ok").length,
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Cover Risk</h1>
        <p className="text-gray-500 text-sm mt-1">SKUs below 16 weeks of cover — sorted by urgency</p>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-block w-3 h-3 rounded-full bg-red-400" />
          <span className="text-gray-600">{counts.critical} Critical (&lt;4w)</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-block w-3 h-3 rounded-full bg-amber-400" />
          <span className="text-gray-600">{counts.low} Low (4–8w)</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-block w-3 h-3 rounded-full bg-yellow-300" />
          <span className="text-gray-600">{counts.ok} Watch (8–16w)</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-gray-500">
              <th className="px-4 py-3 font-medium">SKU Code</th>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Cover</th>
              <th className="px-4 py-3 font-medium text-right">Inventory</th>
              <th className="px-4 py-3 font-medium text-right">Monthly Demand</th>
              <th className="px-4 py-3 font-medium">Next Delivery</th>
            </tr>
          </thead>
          <tbody>
            {atRisk.map((s) => {
              const status = getCoverStatus(s.cover);
              const rowBg =
                status === "critical"
                  ? "bg-red-50/40"
                  : status === "low"
                  ? "bg-amber-50/40"
                  : "";
              return (
                <tr key={s.skuCode} className={`border-b border-gray-100 hover:bg-gray-50 ${rowBg}`}>
                  <td className="px-4 py-2.5">
                    <Link href={`/sku/${s.skuCode}`} className="font-mono text-xs text-brand-green hover:underline">
                      {s.skuCode}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-gray-900 max-w-xs truncate">{s.description}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{s.type || "—"}</span>
                  </td>
                  <td className="px-4 py-2.5"><CoverBadge cover={s.cover} /></td>
                  <td className="px-4 py-2.5 text-right text-gray-700">{s.inventory?.toLocaleString() ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{s.monthlyDemandAvg?.toLocaleString() ?? "—"}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">
                    {s.nextBulkDelivery && s.nextBulkDelivery !== "Not Planned"
                      ? `Bulk: ${s.nextBulkDelivery}`
                      : s.nextPackingDelivery && s.nextPackingDelivery !== "Not Planned"
                      ? `Pack: ${s.nextPackingDelivery}`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
