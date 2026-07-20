"use client";

import { useState, useMemo } from "react";
import type { ReadinessResult, WoReadiness, ComponentCheck, WoStatus, ComponentStatus, BulkMakeRow } from "@/lib/readiness";

const WO_BADGE: Record<WoStatus, { label: string; cls: string }> = {
  ready: { label: "Ready", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  at_risk: { label: "At risk", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  short: { label: "Short", cls: "bg-red-50 text-red-700 border-red-200" },
};

const COMP_DOT: Record<ComponentStatus, string> = {
  ok: "bg-emerald-500",
  at_risk: "bg-amber-500",
  short: "bg-red-500",
  unknown: "bg-text-muted",
};

const fmt = (n: number) => Math.round(n).toLocaleString();

function KpiCard({ title, value, color }: { title: string; value: number; color: "default" | "emerald" | "amber" | "red" }) {
  const val = {
    default: "text-charcoal",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    red: "text-red-600",
  }[color];
  return (
    <div className="bg-white rounded-2xl border border-[#e4ddd4] p-5">
      <p className="text-[10px] tracking-widest uppercase text-text-muted mb-2">{title}</p>
      <p className={`text-3xl font-serif font-medium ${val}`}>{value}</p>
    </div>
  );
}

function ComponentRow({ c }: { c: ComponentCheck }) {
  return (
    <tr className="border-b border-[#e4ddd4]/50 last:border-0">
      <td className="py-2 pr-3">
        <span className={`inline-block w-2 h-2 rounded-full mr-2 align-middle ${COMP_DOT[c.status]}`} />
        <span className="font-mono text-xs text-copper">{c.code}</span>
      </td>
      <td className="py-2 pr-3 text-charcoal">
        {c.name || "—"}
        <span className="ml-2 text-[10px] tracking-widest uppercase text-text-muted">{c.kind}</span>
      </td>
      <td className="py-2 pr-3 text-right tabular-nums">{fmt(c.need)}</td>
      <td className="py-2 pr-3 text-right tabular-nums text-text-muted">{fmt(c.onHand)}</td>
      <td className="py-2 pr-3 text-right tabular-nums text-text-muted">
        {c.inboundQty > 0 ? fmt(c.inboundQty) : "—"}
      </td>
      <td className="py-2 text-right">
        {c.status === "short" ? (
          <span className="text-red-600 font-medium tabular-nums">−{fmt(c.shortfall)}</span>
        ) : c.status === "at_risk" ? (
          <span className="text-amber-600 text-xs">
            {c.inboundRefs.length > 0 ? c.inboundRefs.map(r => r.po).join(", ") : "inbound"}
          </span>
        ) : c.status === "unknown" ? (
          <span className="text-text-muted text-xs">{c.note ?? "unknown"}</span>
        ) : (
          <span className="text-emerald-600 text-xs">OK</span>
        )}
      </td>
    </tr>
  );
}

function WoCard({ wo }: { wo: WoReadiness }) {
  const [open, setOpen] = useState(wo.status !== "ready");
  const badge = WO_BADGE[wo.status];
  const worst = wo.components.filter(c => c.status === "short");
  const risky = wo.components.filter(c => c.status === "at_risk" || c.status === "unknown");

  return (
    <div className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full text-left px-5 py-4 hover:bg-cream/50 transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className={`text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
              <span className="font-mono text-xs text-copper">{wo.workOrder}</span>
              <span className="text-charcoal text-sm font-medium truncate">{wo.description}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
              <span>{wo.plannedDateLabel} · {wo.plannedDaysLabel}</span>
              <span>Qty {fmt(wo.netQty)}</span>
              <span>SKU {wo.productCode}</span>
              {wo.status !== "ready" && (
                <span className={wo.status === "short" ? "text-red-600" : "text-amber-600"}>
                  {worst.length > 0 && `${worst.length} short`}
                  {worst.length > 0 && risky.length > 0 && " · "}
                  {risky.length > 0 && `${risky.length} at risk`}
                </span>
              )}
            </div>
          </div>
          <span className="text-text-muted text-xs shrink-0">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-4 border-t border-[#e4ddd4]/60">
          {wo.components.length === 0 ? (
            <p className="text-xs text-text-muted py-3">No bulk or ancillary components found for this work order.</p>
          ) : (
            <table className="w-full text-sm mt-2">
              <thead>
                <tr className="text-left text-[10px] tracking-widest uppercase text-text-muted">
                  <th className="py-2 pr-3 font-medium">Component</th>
                  <th className="py-2 pr-3 font-medium">Description</th>
                  <th className="py-2 pr-3 font-medium text-right">Need</th>
                  <th className="py-2 pr-3 font-medium text-right">On hand</th>
                  <th className="py-2 pr-3 font-medium text-right">Inbound</th>
                  <th className="py-2 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {wo.components.map((c, i) => <ComponentRow key={`${c.code}-${i}`} c={c} />)}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

const fmtKg = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

function BulkMakeCard({ b }: { b: BulkMakeRow }) {
  const [open, setOpen] = useState(b.makeStatus === "blocked");
  const badge = b.makeStatus === "blocked"
    ? { label: "Blocked", cls: "bg-red-50 text-red-700 border-red-200" }
    : { label: "Makeable", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  return (
    <div className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full text-left px-5 py-4 hover:bg-cream/50 transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className={`text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
              <span className="font-mono text-xs text-copper">{b.bulkCode}</span>
              <span className="text-charcoal text-sm font-medium truncate">{b.name}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
              <span>Shortfall <strong className="text-charcoal">{fmt(b.shortfallCaps)}</strong> caps to make</span>
              <span className={b.bulkWoPlanned ? "text-emerald-600" : "text-amber-600"}>
                {b.bulkWoPlanned ? `Bulk WO planned (${b.bulkWoRefs.join(", ")})` : "No bulk WO planned"}
              </span>
              {b.makeStatus === "blocked" && <span className="text-red-600">RM short</span>}
            </div>
          </div>
          <span className="text-text-muted text-xs shrink-0">{open ? "▲" : "▼"}</span>
        </div>
      </button>
      {open && (
        <div className="px-5 pb-4 border-t border-[#e4ddd4]/60">
          {b.rms.length === 0 ? (
            <p className="text-xs text-text-muted py-3">No raw-material BOM found for this bulk.</p>
          ) : (
            <table className="w-full text-sm mt-2">
              <thead>
                <tr className="text-left text-[10px] tracking-widest uppercase text-text-muted">
                  <th className="py-2 pr-3 font-medium">Raw material</th>
                  <th className="py-2 pr-3 font-medium">Description</th>
                  <th className="py-2 pr-3 font-medium text-right">Need (kg)</th>
                  <th className="py-2 pr-3 font-medium text-right">On hand</th>
                  <th className="py-2 pr-3 font-medium text-right">Inbound</th>
                  <th className="py-2 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {b.rms.map((r, i) => (
                  <tr key={`${r.code}-${i}`} className="border-b border-[#e4ddd4]/50 last:border-0">
                    <td className="py-2 pr-3"><span className={`inline-block w-2 h-2 rounded-full mr-2 align-middle ${COMP_DOT[r.status]}`} /><span className="font-mono text-xs text-copper">{r.code}</span></td>
                    <td className="py-2 pr-3 text-charcoal">{r.name || "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmtKg(r.needKg)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-text-muted">{fmtKg(r.onHandKg)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-text-muted">{r.inboundKg > 0 ? fmtKg(r.inboundKg) : "—"}</td>
                    <td className="py-2 text-right">
                      {r.status === "short" ? <span className="text-red-600 font-medium tabular-nums">−{fmtKg(r.shortfallKg)}</span>
                        : r.status === "at_risk" ? <span className="text-amber-600 text-xs">inbound</span>
                        : <span className="text-emerald-600 text-xs">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReadinessView({ result }: { result: ReadinessResult }) {
  const [filter, setFilter] = useState<"all" | WoStatus>("all");

  const shown = useMemo(() => {
    const order: Record<WoStatus, number> = { short: 0, at_risk: 1, ready: 2 };
    return result.workOrders
      .filter(w => filter === "all" || w.status === filter)
      .sort((a, b) => order[a.status] - order[b.status] || a.plannedDateISO.localeCompare(b.plannedDateISO));
  }, [result.workOrders, filter]);

  function exportCsv() {
    const rows: string[][] = [[
      "Work Order", "Planned Date", "Planned Days", "SKU", "Description", "Qty", "WO Status",
      "Component", "Kind", "Component Name", "Need", "On Hand", "Inbound", "Shortfall", "Component Status", "Inbound Refs",
    ]];
    for (const wo of result.workOrders) {
      if (wo.components.length === 0) {
        rows.push([wo.workOrder, wo.plannedDateLabel, wo.plannedDaysLabel, wo.productCode, wo.description, String(wo.netQty), wo.status, "", "", "", "", "", "", "", "", ""]);
      }
      for (const c of wo.components) {
        rows.push([
          wo.workOrder, wo.plannedDateLabel, wo.plannedDaysLabel, wo.productCode, wo.description, String(wo.netQty), wo.status,
          c.code, c.kind, c.name, String(Math.round(c.need)), String(Math.round(c.onHand)), String(Math.round(c.inboundQty)),
          String(Math.round(c.shortfall)), c.status, c.inboundRefs.map(r => `${r.po} (${r.dueDate})`).join("; "),
        ]);
      }
    }
    const csv = rows.map(r => r.map(v => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `production-readiness-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const s = result.summary;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard title="Work Orders" value={s.total} color="default" />
        <KpiCard title="Ready" value={s.ready} color="emerald" />
        <KpiCard title="At Risk" value={s.atRisk} color="amber" />
        <KpiCard title="Short" value={s.short} color="red" />
      </div>

      {s.short > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          ⚠ <strong>{s.short}</strong> work order{s.short > 1 ? "s" : ""} in the next {result.horizonDays} days {s.short > 1 ? "are" : "is"} short on components — expedite before the run date.
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {(["all", "short", "at_risk", "ready"] as const).map(f => (
            <button key={f} type="button" onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filter === f ? "bg-copper text-white border-copper" : "border-[#e4ddd4] text-text-muted hover:bg-cream"
              }`}>
              {f === "all" ? "All" : f === "at_risk" ? "At risk" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button type="button" onClick={exportCsv}
          className="text-xs px-3 py-1.5 rounded-full border border-[#e4ddd4] text-text-muted hover:bg-cream transition-colors">
          Export CSV
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e4ddd4] p-8 text-center text-text-muted text-sm">
          {result.workOrders.length === 0
            ? `No internal work orders scheduled in the next ${result.horizonDays} days.`
            : "No work orders match this filter."}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(wo => <WoCard key={wo.workOrder} wo={wo} />)}
        </div>
      )}

      {result.bulkMake && result.bulkMake.length > 0 && (
        <div className="space-y-3 pt-2">
          <div>
            <h2 className="font-serif text-lg text-charcoal">Bulk make-readiness</h2>
            <p className="text-xs text-text-muted mt-1">
              Bulks short over the window — can we make the shortfall? Exploded through the RM BOM.
              <span className="text-red-600"> Blocked</span> = a raw material is also short (needs procurement);
              <span className="text-emerald-600"> Makeable</span> = raw materials available, just needs a bulk work order.
            </p>
          </div>
          {result.bulkMake.map(b => <BulkMakeCard key={b.bulkCode} b={b} />)}
        </div>
      )}

      {result.excludedNon3 > 0 && (
        <p className="text-xs text-text-muted">
          {result.excludedNon3} non-finished-good work order{result.excludedNon3 > 1 ? "s" : ""} (bulk/rework) excluded from component checks.
        </p>
      )}
    </div>
  );
}
