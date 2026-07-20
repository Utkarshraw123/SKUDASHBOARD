"use client";

import { useMemo, useState } from "react";
import type { ComponentCoverResult, ComponentCoverRow, ComponentType, CoverStatus } from "@/lib/component-cover";

const TYPE_BADGE: Record<ComponentType, { label: string; cls: string }> = {
  bulk: { label: "Bulk", cls: "bg-copper/10 text-copper border-copper/20" },
  rm: { label: "Raw material", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ancillary: { label: "Ancillary", cls: "bg-amber-50 text-amber-700 border-amber-200" },
};

const STATUS_DOT: Record<CoverStatus, string> = {
  critical: "bg-red-500",
  low: "bg-amber-500",
  ok: "bg-emerald-500",
};

const fmt = (n: number, dp = 0) => n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

function Kpi({ title, value, color = "text-charcoal" }: { title: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#e4ddd4] p-5">
      <p className="text-[10px] tracking-widest uppercase text-text-muted mb-2">{title}</p>
      <p className={`text-3xl font-serif font-medium ${color}`}>{value}</p>
    </div>
  );
}

export default function ComponentCoverView({ result }: { result: ComponentCoverResult }) {
  const [typeFilter, setTypeFilter] = useState<"all" | ComponentType>("all");
  const [showOk, setShowOk] = useState(false);

  const rows = useMemo(() => {
    return result.rows.filter(r =>
      (typeFilter === "all" || r.type === typeFilter) &&
      (showOk || r.status !== "ok"),
    );
  }, [result.rows, typeFilter, showOk]);

  function exportCsv() {
    const head = ["Type", "Code", "Description", "Stock", "Unit", "Weekly Use", "Weeks Cover", "Status", "Driven By"];
    const body = result.rows.map(r => [r.type, r.code, r.name, String(Math.round(r.stock)), r.unit, String(Math.round(r.weeklyUse)), r.weeksCover.toFixed(1), r.status, r.drivenBy]);
    const csv = [head, ...body].map(r => r.map(v => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const el = document.createElement("a");
    el.href = url;
    el.download = `component-cover-${new Date().toISOString().split("T")[0]}.csv`;
    el.click();
    URL.revokeObjectURL(url);
  }

  const s = result.summary;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Kpi title="Components" value={s.total} />
        <Kpi title={`Critical (< ${result.thresholds.critical}w)`} value={s.critical} color="text-red-600" />
        <Kpi title={`Low (< ${result.thresholds.low}w)`} value={s.low} color="text-amber-600" />
        <Kpi title="OK" value={s.ok} color="text-emerald-600" />
      </div>

      {s.critical > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          ⚠ <strong>{s.critical}</strong> component{s.critical > 1 ? "s" : ""} under {result.thresholds.critical} weeks&apos; cover — order before they run out.
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {(["all", "bulk", "rm", "ancillary"] as const).map(f => (
            <button key={f} type="button" onClick={() => setTypeFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                typeFilter === f ? "bg-copper text-white border-copper" : "border-[#e4ddd4] text-text-muted hover:bg-cream"
              }`}>
              {f === "all" ? "All" : f === "rm" ? "Raw material" : f === "bulk" ? "Bulk" : "Ancillary"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-text-muted flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showOk} onChange={e => setShowOk(e.target.checked)} className="accent-copper" />
            Show OK
          </label>
          <button type="button" onClick={exportCsv}
            className="text-xs px-3 py-1.5 rounded-full border border-[#e4ddd4] text-text-muted hover:bg-cream transition-colors">
            Export CSV
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e4ddd4] p-8 text-center text-text-muted text-sm">
          {showOk ? "No components match this filter." : "No components below cover thresholds — all healthy. 🎉"}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-[10px] tracking-widest uppercase text-text-muted bg-cream/60">
                  <th className="py-2.5 px-5 font-medium">Type</th>
                  <th className="py-2.5 pr-3 font-medium">Code</th>
                  <th className="py-2.5 pr-3 font-medium">Description</th>
                  <th className="py-2.5 pr-3 font-medium text-right">Stock</th>
                  <th className="py-2.5 pr-3 font-medium text-right">Weekly use</th>
                  <th className="py-2.5 pr-3 font-medium text-right">Weeks cover</th>
                  <th className="py-2.5 pr-5 font-medium">Driven by</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.code}-${i}`} className="border-b border-[#e4ddd4]/50 last:border-0 hover:bg-cream/40 transition-colors">
                    <td className="py-2.5 px-5">
                      <span className={`text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-full border ${TYPE_BADGE[r.type].cls}`}>{TYPE_BADGE[r.type].label}</span>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-copper">{r.code}</td>
                    <td className="py-2.5 pr-3 text-charcoal">{r.name || "—"}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-text-muted whitespace-nowrap">{fmt(r.stock)} <span className="text-[10px]">{r.unit}</span></td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-text-muted whitespace-nowrap">{fmt(r.weeklyUse)}</td>
                    <td className="py-2.5 pr-3 text-right whitespace-nowrap">
                      <span className={`inline-block w-2 h-2 rounded-full mr-2 align-middle ${STATUS_DOT[r.status]}`} />
                      <span className={`font-medium tabular-nums ${r.status === "critical" ? "text-red-600" : r.status === "low" ? "text-amber-600" : "text-charcoal"}`}>
                        {r.weeksCover.toFixed(1)}w
                      </span>
                    </td>
                    <td className="py-2.5 pr-5 text-text-muted text-xs">{r.drivenBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-text-muted">
        Weekly use = finished-goods demand exploded through the BOMs (bulk = demand × fill; RM via the RM BOM; ancillary via the
        Ancillary BOM, jar/lid/label/box/pouch only). Stock is total across all locations (bulk normalised from thousands).
      </p>
    </div>
  );
}
