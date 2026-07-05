import { fetchSkus } from "@/lib/sheets";
import { getCoverStatus } from "@/lib/types";
import { getMarketMode, filterSkusByMode, futureDateOnly } from "@/lib/markets";
import CoverBadge from "@/components/CoverBadge";
import FilterBar from "@/components/FilterBar";
import ExportCsvButton from "@/components/ExportCsvButton";
import Link from "next/link";
import { Suspense } from "react";

export const revalidate = 0;

export default async function RiskPage({
  searchParams,
}: {
  searchParams: { search?: string; type?: string; status?: string };
}) {
  const allSkus = await fetchSkus();
  const skus = filterSkusByMode(allSkus, getMarketMode());
  const types = Array.from(new Set(skus.map((s) => s.type).filter(Boolean))).sort();

  let atRisk = skus
    .filter((s) => s.cover !== null && s.cover < 16)
    .sort((a, b) => (a.cover ?? 999) - (b.cover ?? 999));

  const search = searchParams.search?.toLowerCase() ?? "";
  const typeFilter = searchParams.type ?? "";
  const statusFilter = searchParams.status ?? "";

  if (search) atRisk = atRisk.filter((s) => s.description.toLowerCase().includes(search) || s.skuCode.toLowerCase().includes(search));
  if (typeFilter) atRisk = atRisk.filter((s) => s.type === typeFilter);
  if (statusFilter) atRisk = atRisk.filter((s) => getCoverStatus(s.cover) === statusFilter);

  const counts = {
    critical: atRisk.filter((s) => getCoverStatus(s.cover) === "critical").length,
    low: atRisk.filter((s) => getCoverStatus(s.cover) === "low").length,
    ok: atRisk.filter((s) => getCoverStatus(s.cover) === "ok").length,
  };

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">Cover Risk</h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">SKUs below 16 weeks — sorted by urgency</p>
      </div>

      <div className="flex gap-6 mb-6">
        {[
          { label: "Critical", count: counts.critical, color: "bg-red-400" },
          { label: "Low (4–8w)", count: counts.low, color: "bg-amber-400" },
          { label: "Watch (8–16w)", count: counts.ok, color: "bg-yellow-300" },
        ].map(({ label, count, color }) => (
          <div key={label} className="flex items-center gap-2 text-sm text-charcoal">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />
            <span>{count} {label}</span>
          </div>
        ))}
      </div>

      <Suspense>
        <FilterBar
          searchPlaceholder="Search by product or SKU…"
          filters={[
            { key: "type", label: "Type", options: types.map((t) => ({ value: t, label: t })) },
            { key: "status", label: "Cover Status", options: [
              { value: "critical", label: "Critical (<4w)" },
              { value: "low", label: "Low (4–8w)" },
              { value: "ok", label: "Watch (8–16w)" },
            ]},
          ]}
        />
      </Suspense>

      <div className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#e4ddd4] bg-cream text-xs text-text-muted flex items-center justify-end">
          <ExportCsvButton filename="cover-risk" />
        </div>
        {atRisk.length === 0 ? (
          <p className="px-5 py-10 text-center text-text-muted text-sm">No results match your filters.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-cream border-b border-[#e4ddd4]">
              <tr className="text-left">
                <th className="px-5 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">SKU Code</th>
                <th className="px-5 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">Product</th>
                <th className="px-5 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">Type</th>
                <th className="px-5 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">Cover</th>
                <th className="px-5 py-4 text-xs tracking-widest uppercase text-text-muted font-medium text-right">Inventory</th>
                <th className="px-5 py-4 text-xs tracking-widest uppercase text-text-muted font-medium text-right">Monthly Demand</th>
                <th className="px-5 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">Next Delivery</th>
              </tr>
            </thead>
            <tbody>
              {atRisk.map((s) => {
                const status = getCoverStatus(s.cover);
                const rowBg = status === "critical" ? "bg-red-50/30" : status === "low" ? "bg-amber-50/30" : "";
                const nextDelivery =
                  futureDateOnly(s.nextBulkDelivery)
                    ? `Bulk: ${s.nextBulkDelivery}`
                    : futureDateOnly(s.nextPackingDelivery)
                    ? `Pack: ${s.nextPackingDelivery}`
                    : null;
                return (
                  <tr key={s.skuCode} className={`border-b border-[#e4ddd4]/60 hover:bg-cream transition-colors ${rowBg}`}>
                    <td className="px-5 py-3">
                      <Link href={`/sku/${s.skuCode}`} className="font-mono text-xs text-copper hover:opacity-70">
                        {s.skuCode}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-charcoal max-w-xs truncate">{s.description}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-cream-dark px-2.5 py-0.5 text-xs text-text-muted">{s.type || "—"}</span>
                    </td>
                    <td className="px-5 py-3"><CoverBadge cover={s.cover} /></td>
                    <td className="px-5 py-3 text-right text-sm text-charcoal">{s.inventory?.toLocaleString() ?? "—"}</td>
                    <td className="px-5 py-3 text-right font-medium text-sm text-charcoal">{s.monthlyDemandAvg?.toLocaleString() ?? "—"}</td>
                    <td className="px-5 py-3 text-xs text-text-muted">
                      {nextDelivery ?? <span className="text-red-400">Not Planned</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
