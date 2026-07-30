"use client";

import ExportCsvButton from "@/components/ExportCsvButton";

interface Row {
  id: number; date: string; shift: string; machine: string; operator: string; product: string;
  planned: number | null; actual: number | null; efficiency: number | null; downtimeMin: number | null;
  void: boolean; voidReason: string | null;
}

const pct = (e: number | null) => (e == null ? "—" : `${Math.round(e * 100)}%`);
const num = (n: number | null) => (n == null ? "—" : Math.round(n).toLocaleString());

export default function RunsRegisterView({ rows, range }: { rows: Row[]; range: { from: string; to: string } }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-text-muted">{rows.filter((r) => !r.void).length} active · {rows.filter((r) => r.void).length} void</p>
        <ExportCsvButton filename={`runs-${range.from}_${range.to}`} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#e4ddd4]">
        <table className="min-w-full text-sm">
          <thead className="bg-[#f6f1ea] text-text-muted">
            <tr>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">Shift</th>
              <th className="text-left px-3 py-2">Machine</th>
              <th className="text-left px-3 py-2">Operator</th>
              <th className="text-left px-3 py-2">Product</th>
              <th className="text-right px-3 py-2">Planned</th>
              <th className="text-right px-3 py-2">Actual</th>
              <th className="text-right px-3 py-2">Efficiency</th>
              <th className="text-right px-3 py-2">Downtime</th>
              <th className="text-left px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={10} className="px-3 py-6 text-center text-text-muted">No runs in range.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className={`border-t border-[#efe8df] ${r.void ? "text-text-muted line-through" : "text-charcoal"}`}>
                <td className="px-3 py-2">{r.date}</td>
                <td className="px-3 py-2">{r.shift}</td>
                <td className="px-3 py-2">{r.machine}</td>
                <td className="px-3 py-2">{r.operator}</td>
                <td className="px-3 py-2">{r.product}</td>
                <td className="px-3 py-2 text-right">{num(r.planned)}</td>
                <td className="px-3 py-2 text-right">{num(r.actual)}</td>
                <td className="px-3 py-2 text-right">{pct(r.efficiency)}</td>
                <td className="px-3 py-2 text-right">{num(r.downtimeMin)}</td>
                <td className="px-3 py-2 no-underline">{r.void ? `Void — ${r.voidReason ?? ""}` : "Active"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
