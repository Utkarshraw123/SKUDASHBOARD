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
        <thead className="bg-cream border-b border-[#e4ddd4]">
          <tr className="text-left">
            <th className="px-5 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">SKU</th>
            <th className="px-5 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">Product</th>
            <th className="px-5 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">Type</th>
            <th className="px-5 py-4 text-xs tracking-widest uppercase text-text-muted font-medium text-right">Avg Demand</th>
            <th className="px-5 py-4 text-xs tracking-widest uppercase text-text-muted font-medium text-right">Last Qtr</th>
            <th className="px-5 py-4 text-xs tracking-widest uppercase text-text-muted font-medium text-right">Variance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
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
              <td className="px-5 py-3 text-right text-text-muted">{s.monthlyDemandAvg?.toLocaleString() ?? "—"}</td>
              <td className="px-5 py-3 text-right text-text-muted">{s.monthlyDemandLastQtr?.toLocaleString() ?? "—"}</td>
              <td className="px-5 py-3 text-right">
                <span className={`font-semibold ${positive ? "text-emerald-600" : "text-red-600"}`}>
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
    <div className="max-w-6xl">
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">Sales Variance</h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">Average demand vs last quarter actuals</p>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-emerald-500 font-serif text-lg">↑</span>
          <h2 className="font-serif text-lg text-charcoal">Outperforming <span className="text-text-muted text-sm font-sans font-normal">({outperforming.length})</span></h2>
        </div>
        <div className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden">
          <VarianceTable rows={outperforming} positive={true} />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-red-400 font-serif text-lg">↓</span>
          <h2 className="font-serif text-lg text-charcoal">Underperforming <span className="text-text-muted text-sm font-sans font-normal">({underperforming.length})</span></h2>
        </div>
        <div className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden">
          <VarianceTable rows={underperforming} positive={false} />
        </div>
      </div>
    </div>
  );
}
