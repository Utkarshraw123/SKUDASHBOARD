import { fetchWNPPlanning } from "@/lib/sheets";
import { parseDateDMY } from "@/lib/dates";
import FilterBar from "@/components/FilterBar";
import ExportCsvButton from "@/components/ExportCsvButton";
import Link from "next/link";
import { Suspense } from "react";

export const revalidate = 300;

function StatusBadge({ status }: { status: "complete" | "in_progress" | "planned" }) {
  const map = {
    complete: "bg-emerald-100 text-emerald-700",
    in_progress: "bg-copper/10 text-copper",
    planned: "bg-cream-dark text-text-muted",
  };
  const labels = { complete: "Complete", in_progress: "In Progress", planned: "Planned" };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status]}`}>{labels[status]}</span>;
}

function inDateRange(dateStr: string, from: string, to: string): boolean {
  if (!from && !to) return true;
  const d = parseDateDMY(dateStr);
  if (!d) return true;
  if (from && d < new Date(from)) return false;
  if (to && d > new Date(to)) return false;
  return true;
}

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: { search?: string; status?: string; bulkCode?: string; batch?: string; dateFrom?: string; dateTo?: string };
}) {
  const rows = await fetchWNPPlanning();

  const bulkCodes = Array.from(new Set(rows.map((r) => r.bulkCode).filter(Boolean))).sort();
  const batches = Array.from(new Set(rows.map((r) => r.batch).filter(Boolean))).sort();

  const search = searchParams.search?.toLowerCase() ?? "";
  const statusFilter = searchParams.status ?? "";
  const bulkCodeFilter = searchParams.bulkCode ?? "";
  const batchFilter = searchParams.batch ?? "";
  const dateFrom = searchParams.dateFrom ?? "";
  const dateTo = searchParams.dateTo ?? "";

  // newest first
  let filtered = [...rows].reverse();
  if (search) filtered = filtered.filter((r) =>
    r.description.toLowerCase().includes(search) ||
    r.workOrderNo.toLowerCase().includes(search) ||
    r.productCode.toLowerCase().includes(search) ||
    r.bulkCode.toLowerCase().includes(search)
  );
  if (statusFilter) filtered = filtered.filter((r) => r.status === statusFilter);
  if (bulkCodeFilter) filtered = filtered.filter((r) => r.bulkCode === bulkCodeFilter);
  if (batchFilter) filtered = filtered.filter((r) => r.batch === batchFilter);
  if (dateFrom || dateTo) filtered = filtered.filter((r) => inDateRange(r.plannedWeek, dateFrom, dateTo));

  const counts = {
    planned: rows.filter((r) => r.status === "planned").length,
    in_progress: rows.filter((r) => r.status === "in_progress").length,
    complete: rows.filter((r) => r.status === "complete").length,
  };

  return (
    <div className="max-w-7xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">Internal Production</h1>
          <p className="text-text-muted text-sm mt-2 tracking-wide">WNP work orders — in-house production at Wild Nutrition Production</p>
        </div>
        <Link href="/planning/report" className="shrink-0 bg-copper text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-copper-light transition-colors">
          + New Production Report
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Planned", count: counts.planned, color: "text-charcoal" },
          { label: "In Progress", count: counts.in_progress, color: "text-copper" },
          { label: "Complete", count: counts.complete, color: "text-emerald-600" },
        ].map(({ label, count, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-[#e4ddd4] px-5 py-4">
            <p className="text-xs tracking-widest uppercase text-text-muted mb-1">{label}</p>
            <p className={`text-2xl font-serif font-medium ${color}`}>{count}</p>
          </div>
        ))}
      </div>

      <Suspense>
        <FilterBar
          searchPlaceholder="Search by SKU, bulk code, description or WO…"
          periodKeys={{ from: "dateFrom", to: "dateTo" }}
          filters={[
            { key: "status", label: "Status", options: [
              { value: "planned", label: "Planned" },
              { value: "in_progress", label: "In Progress" },
              { value: "complete", label: "Complete" },
            ]},
            { key: "bulkCode", label: "Bulk Code", options: bulkCodes.map((c) => ({ value: c, label: c })) },
            { key: "batch", label: "Batch", options: batches.map((b) => ({ value: b, label: b })) },
            { key: "dateFrom", label: "From", type: "date" },
            { key: "dateTo", label: "To", type: "date" },
          ]}
        />
      </Suspense>

      <div className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#e4ddd4] bg-cream text-xs text-text-muted flex items-center justify-between">
          <span>Showing {filtered.length} of {rows.length} work orders</span>
          <ExportCsvButton filename="internal-production" />
        </div>
        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-text-muted text-sm">No results match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream border-b border-[#e4ddd4]">
                <tr className="text-left">
                  <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium whitespace-nowrap">Work Order</th>
                  <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium whitespace-nowrap">Bulk Code</th>
                  <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium whitespace-nowrap">SKU Code</th>
                  <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">Description</th>
                  <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium whitespace-nowrap">Planned Week</th>
                  <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium text-right whitespace-nowrap">Fill</th>
                  <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium text-right whitespace-nowrap">Qty Planned</th>
                  <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium text-right whitespace-nowrap">Qty Produced</th>
                  <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={`${r.workOrderNo}-${i}`} className="border-b border-[#e4ddd4]/60 hover:bg-cream transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-copper whitespace-nowrap">{r.workOrderNo}</td>
                    <td className="px-4 py-3 font-mono text-xs text-text-muted whitespace-nowrap">{r.bulkCode || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-text-muted whitespace-nowrap">{r.productCode || "—"}</td>
                    <td className="px-4 py-3 text-charcoal max-w-[420px] truncate">{r.description}</td>
                    <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">{r.plannedWeek || "—"}</td>
                    <td className="px-4 py-3 text-right text-text-muted whitespace-nowrap">{r.fill !== null ? r.fill : "—"}</td>
                    <td className="px-4 py-3 text-right text-charcoal whitespace-nowrap">{r.quantity?.toLocaleString() ?? "—"}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {r.quantityProduced !== null ? (
                        <span className={r.status === "complete" ? "text-emerald-600 font-medium" : "text-charcoal"}>
                          {r.quantityProduced.toLocaleString()}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
