import { fetchSkus, fetchProductionInput } from "@/lib/sheets";
import { getCoverStatus } from "@/lib/types";
import { getMarketMode, filterSkusByMode } from "@/lib/markets";
import KpiCard from "@/components/KpiCard";
import CoverBadge from "@/components/CoverBadge";
import InventoryChart from "@/components/InventoryChart";
import Link from "next/link";

export const revalidate = 0;

function parseDMY(s: string): Date | null {
  const p = s.trim().split("/");
  if (p.length === 3) { const d = new Date(`${p[2]}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`); return isNaN(d.getTime()) ? null : d; }
  return null;
}

export default async function OverviewPage() {
  const [allSkus, productionInput] = await Promise.all([
    fetchSkus(),
    fetchProductionInput().catch(() => []),
  ]);
  const mode = getMarketMode();
  const skus = filterSkusByMode(allSkus, mode);

  // Production room snapshot — last 7 days
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7); weekAgo.setHours(0,0,0,0);
  const recent = productionInput.filter(r => { const d = parseDMY(r.date); return d !== null && d >= weekAgo; });
  const weekOutput = recent.reduce((s, r) => s + (r.actualQty ?? 0), 0);
  const weekPlanned = recent.reduce((s, r) => s + (r.plannedQty ?? 0), 0);
  const weekEff = weekPlanned > 0 ? Math.round((weekOutput / weekPlanned) * 1000) / 10 : null;

  const totalSKUs = skus.length;
  const critical = skus.filter((s) => getCoverStatus(s.cover) === "critical");
  const low = skus.filter((s) => getCoverStatus(s.cover) === "low");
  const totalInventory = skus.reduce((sum, s) => sum + (s.inventory ?? 0), 0);

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

  const modeLabel: Record<string, string> = { all: "All SKUs", dtc: "DTC & Retail", eu: "EU Goods", us: "US Goods", accessories: "Accessories" };
  const marketNames = modeLabel[mode] ?? mode;

  return (
    <div className="max-w-6xl">
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">Overview</h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">
          Showing: {marketNames}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <KpiCard title="Total SKUs" value={totalSKUs} color="default" />
        <KpiCard title="Critical" value={critical.length} subtitle="Under 4 weeks cover" color="red" />
        <KpiCard title="Low Cover" value={low.length} subtitle="4–8 weeks cover" color="amber" />
        <KpiCard title="Total Inventory" value={totalInventory.toLocaleString()} subtitle="Units across all locations" color="copper" />
      </div>

      {/* Production room snapshot + quick tools */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-[#e4ddd4] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg text-charcoal">Production Room — Last 7 Days</h2>
            <Link href="/planning/performance" className="text-xs text-copper tracking-widest uppercase hover:opacity-70 transition-opacity">Details →</Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-text-muted text-sm py-4">No production entries in the last 7 days.</p>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] tracking-widest uppercase text-text-muted mb-1">Output</p>
                <p className="text-xl font-serif font-medium text-charcoal">{weekOutput.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] tracking-widest uppercase text-text-muted mb-1">Efficiency</p>
                <p className={`text-xl font-serif font-medium ${weekEff !== null && weekEff >= 90 ? "text-emerald-600" : weekEff !== null && weekEff >= 75 ? "text-amber-600" : "text-red-600"}`}>
                  {weekEff !== null ? `${weekEff}%` : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] tracking-widest uppercase text-text-muted mb-1">Tasks</p>
                <p className="text-xl font-serif font-medium text-charcoal">{recent.length}</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#e4ddd4] p-6">
          <h2 className="font-serif text-lg text-charcoal mb-4">Planning Tools</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: "/procurement", label: "Procurement Planner", desc: "Plan the next cycle" },
              { href: "/planning/performance", label: "Production Performance", desc: "Yield & efficiency" },
              { href: "/bom", label: "Bill of Materials", desc: "Recipes & where-used" },
              { href: "/planning/report", label: "Production Report", desc: "Supervisor form" },
            ].map(t => (
              <Link key={t.href} href={t.href}
                className="rounded-xl border border-[#e4ddd4] px-4 py-3 hover:border-copper hover:bg-cream transition-colors">
                <p className="text-sm font-medium text-charcoal">{t.label}</p>
                <p className="text-xs text-text-muted mt-0.5">{t.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#e4ddd4] p-7 mb-8">
        <h2 className="font-serif text-lg text-charcoal mb-5">Inventory by Product Type</h2>
        <InventoryChart data={chartData} />
      </div>

      <div className="bg-white rounded-2xl border border-[#e4ddd4] p-7">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-serif text-lg text-charcoal">Top Critical SKUs by Demand</h2>
          <Link href="/risk" className="text-xs text-copper tracking-widest uppercase hover:opacity-70 transition-opacity">
            View all →
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-[#e4ddd4]">
              <th className="pb-3 text-xs tracking-widest uppercase text-text-muted font-medium">SKU</th>
              <th className="pb-3 text-xs tracking-widest uppercase text-text-muted font-medium">Product</th>
              <th className="pb-3 text-xs tracking-widest uppercase text-text-muted font-medium">Type</th>
              <th className="pb-3 text-xs tracking-widest uppercase text-text-muted font-medium">Cover</th>
              <th className="pb-3 text-xs tracking-widest uppercase text-text-muted font-medium text-right">Monthly Demand</th>
            </tr>
          </thead>
          <tbody>
            {top5Critical.map((s) => (
              <tr key={s.skuCode} className="border-b border-[#e4ddd4]/60 hover:bg-cream transition-colors">
                <td className="py-3">
                  <Link href={`/sku/${s.skuCode}`} className="font-mono text-xs text-copper hover:opacity-70">
                    {s.skuCode}
                  </Link>
                </td>
                <td className="py-3 text-charcoal">{s.description}</td>
                <td className="py-3">
                  <span className="rounded-full bg-cream-dark px-2.5 py-0.5 text-xs text-text-muted">{s.type}</span>
                </td>
                <td className="py-3"><CoverBadge cover={s.cover} /></td>
                <td className="py-3 text-right font-medium text-charcoal">{s.monthlyDemandAvg?.toLocaleString() ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
