"use client";

import { useMemo, useState } from "react";
import type { OrderActionList, OrderAction, ActionType } from "@/lib/procurement-actions";

const TYPE_BADGE: Record<ActionType, { label: string; cls: string }> = {
  bulk: { label: "Bulk", cls: "bg-copper/10 text-copper border-copper/20" },
  rm: { label: "Raw material", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ancillary: { label: "Ancillary", cls: "bg-amber-50 text-amber-700 border-amber-200" },
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

function Row({ a }: { a: OrderAction }) {
  const badge = TYPE_BADGE[a.partType];
  return (
    <tr className="border-b border-[#e4ddd4]/50 last:border-0 hover:bg-cream/40 transition-colors">
      <td className="py-2.5 pr-3">
        <span className={`text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
      </td>
      <td className="py-2.5 pr-3 font-mono text-xs text-copper">{a.code}</td>
      <td className="py-2.5 pr-3 text-charcoal">{a.name}</td>
      <td className="py-2.5 pr-3 text-right font-medium text-charcoal tabular-nums whitespace-nowrap">{fmt(a.qty, a.unit === "kg" ? 2 : 0)}</td>
      <td className="py-2.5 pr-3 text-text-muted text-xs whitespace-nowrap">{a.unit}</td>
      <td className="py-2.5 pr-3 text-right text-text-muted tabular-nums">{a.onOrder > 0 ? fmt(a.onOrder, a.unit === "kg" ? 2 : 0) : "—"}</td>
      <td className="py-2.5 text-text-muted text-xs">{a.note}</td>
    </tr>
  );
}

export default function ProcurementActionsView({ list }: { list: OrderActionList }) {
  const [typeFilter, setTypeFilter] = useState<"all" | ActionType>("all");

  const groups = useMemo(() => {
    if (typeFilter === "all") return list.bySupplier;
    return list.bySupplier
      .map(g => ({ ...g, actions: g.actions.filter(a => a.partType === typeFilter) }))
      .filter(g => g.actions.length > 0);
  }, [list.bySupplier, typeFilter]);

  function exportCsv() {
    const rows: string[][] = [["Supplier", "Type", "Code", "Description", "Order Qty", "Unit", "On Order", "Driven By"]];
    for (const g of list.bySupplier) {
      for (const a of g.actions) {
        rows.push([g.supplier, a.partType, a.code, a.name, String(a.qty), a.unit, String(a.onOrder), a.note]);
      }
    }
    const csv = rows.map(r => r.map(v => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const el = document.createElement("a");
    el.href = url;
    el.download = `procurement-actions-${new Date().toISOString().split("T")[0]}.csv`;
    el.click();
    URL.revokeObjectURL(url);
  }

  const s = list.summary;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Kpi title="Order Lines" value={s.totalLines} color="text-copper" />
        <Kpi title="Bulk / RM / Anc" value={`${s.bulk} / ${s.rm} / ${s.ancillary}`} />
        <Kpi title="Suppliers" value={s.suppliers} />
        <Kpi title="Cycle" value="8 wks" />
      </div>

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
        <button type="button" onClick={exportCsv}
          className="text-xs px-3 py-1.5 rounded-full border border-[#e4ddd4] text-text-muted hover:bg-cream transition-colors">
          Export CSV
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e4ddd4] p-8 text-center text-text-muted text-sm">
          Nothing to order for this cycle — everything is covered by stock and open POs. 🎉
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(g => (
            <div key={g.supplier} className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-cream/60 border-b border-[#e4ddd4]">
                <span className="text-sm font-medium text-charcoal">
                  {g.supplier === "—" ? "Supplier not on file" : g.supplier}
                </span>
                <span className="text-xs text-text-muted">{g.actions.length} line{g.actions.length > 1 ? "s" : ""}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="text-left text-[10px] tracking-widest uppercase text-text-muted">
                      <th className="py-2 px-5 font-medium">Type</th>
                      <th className="py-2 pr-3 font-medium">Code</th>
                      <th className="py-2 pr-3 font-medium">Description</th>
                      <th className="py-2 pr-3 font-medium text-right">Order</th>
                      <th className="py-2 pr-3 font-medium">Unit</th>
                      <th className="py-2 pr-3 font-medium text-right">On Order</th>
                      <th className="py-2 pr-5 font-medium">Driven By</th>
                    </tr>
                  </thead>
                  <tbody className="[&_td:first-child]:pl-5 [&_td:last-child]:pr-5">
                    {g.actions.map((a, i) => <Row key={`${a.code}-${i}`} a={a} />)}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-text-muted">
        Suppliers are inferred from each part&apos;s most recent purchase order. Quantities include the planner&apos;s buffers
        (RM +8%, ancillaries per-type). Bulk is shown in units of 1,000 capsules.
      </p>
    </div>
  );
}
