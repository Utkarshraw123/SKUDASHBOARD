"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { ProcurementPlan, FgPlanRow, BulkPlanRow, RmPlanRow, AncPlanRow, PoRef } from "@/lib/procurement";
import ExportCsvButton from "./ExportCsvButton";

// ---------- shared bits ----------

function fmt(n: number, dp = 0) {
  return n.toLocaleString("en-GB", { maximumFractionDigits: dp });
}

function PoList({ pos }: { pos: PoRef[] }) {
  if (pos.length === 0) return <span className="text-text-muted">None</span>;
  return (
    <span>
      {pos.map((p, i) => (
        <span key={i} className="inline-block mr-2 font-mono text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">
          {p.po} · {fmt(p.qty)} · due {p.dueDate}
        </span>
      ))}
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return <span className={`inline-block transition-transform text-text-muted ${open ? "rotate-90" : ""}`}>▸</span>;
}

function SectionCard({ title, subtitle, kpis, exportName, children }: {
  title: string; subtitle: string;
  kpis: { label: string; value: string; color?: string }[];
  exportName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-10">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl font-medium text-charcoal">{title}</h2>
          <p className="text-text-muted text-xs mt-1">{subtitle}</p>
        </div>
        <ExportCsvButton filename={exportName} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-[#e4ddd4] px-4 py-3">
            <p className="text-[10px] tracking-widest uppercase text-text-muted mb-0.5">{k.label}</p>
            <p className={`text-lg font-serif font-medium ${k.color ?? "text-charcoal"}`}>{k.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden">{children}</div>
    </div>
  );
}

const TH = "px-4 py-3 text-[10px] tracking-widest uppercase text-text-muted font-medium text-left whitespace-nowrap";
const TD = "px-4 py-3 whitespace-nowrap";

// ---------- date picker ----------

export function CyclePicker({ start, end }: { start: string; end: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const set = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const input = "rounded-xl border border-[#e4ddd4] bg-white px-4 py-2.5 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-copper/30 focus:border-copper";

  return (
    <div className="flex flex-wrap items-end gap-4 bg-white rounded-2xl border border-[#e4ddd4] p-5 mb-8">
      <div>
        <label className="block text-[10px] tracking-widest uppercase text-text-muted mb-1.5">Cycle Start</label>
        <input type="date" value={start} onChange={e => set("start", e.target.value)} className={input} />
      </div>
      <div>
        <label className="block text-[10px] tracking-widest uppercase text-text-muted mb-1.5">Cycle End</label>
        <input type="date" value={end} onChange={e => set("end", e.target.value)} className={input} />
      </div>
      <p className="text-xs text-text-muted pb-2.5">
        Plan targets 16 weeks cover (20 for Collagen &amp; Magnesium) at cycle end. Committed production and open POs due before cycle end are netted off.
      </p>
    </div>
  );
}

// ---------- FG section ----------

function FgTable({ rows }: { rows: FgPlanRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-cream border-b border-[#e4ddd4]">
          <tr>
            <th className={TH}></th>
            <th className={TH}>SKU</th>
            <th className={TH}>Description</th>
            <th className={`${TH} text-right`}>Weekly Demand</th>
            <th className={`${TH} text-right`}>Stock (FG WHs)</th>
            <th className={`${TH} text-right`}>Cover Now</th>
            <th className={`${TH} text-right`}>Target</th>
            <th className={`${TH} text-right`}>Units to Produce</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const isOpen = open === r.skuCode;
            const noAction = r.unitsToProduce === 0;
            return (
              <>
                <tr key={r.skuCode}
                    onClick={() => setOpen(isOpen ? null : r.skuCode)}
                    className={`border-b border-[#e4ddd4]/60 cursor-pointer hover:bg-cream transition-colors ${noAction ? "opacity-50" : ""}`}>
                  <td className={TD}><Chevron open={isOpen} /></td>
                  <td className={`${TD} font-mono text-xs text-copper`}>{r.skuCode}</td>
                  <td className="px-4 py-3 text-charcoal max-w-[220px] truncate">{r.description}</td>
                  <td className={`${TD} text-right text-text-muted`}>{fmt(r.weeklyDemand)}</td>
                  <td className={`${TD} text-right`}>{fmt(r.currentStock)}</td>
                  <td className={`${TD} text-right ${r.currentCover !== null && r.currentCover < 8 ? "text-red-600 font-medium" : "text-text-muted"}`}>
                    {r.currentCover !== null ? `${r.currentCover.toFixed(1)}w` : "—"}
                  </td>
                  <td className={`${TD} text-right text-text-muted`}>{r.targetCover}w</td>
                  <td className={`${TD} text-right font-semibold ${noAction ? "text-text-muted" : "text-copper"}`}>
                    {noAction ? "Covered" : fmt(r.unitsToProduce)}
                  </td>
                </tr>
                {isOpen && (
                  <tr key={`${r.skuCode}-d`} className="bg-cream/60 border-b border-[#e4ddd4]/60">
                    <td></td>
                    <td colSpan={7} className="px-4 py-4 text-xs text-charcoal space-y-1.5">
                      <p><strong>Calculation:</strong> target stock = {r.targetCover}w × {fmt(r.weeklyDemand)}/w = <strong>{fmt(r.targetStock)}</strong> units at cycle end</p>
                      <p>Projected stock at cycle end = {fmt(r.currentStock)} stock + {fmt(r.incomingQty)} incoming − demand until then = <strong>{fmt(r.projectedStockAtCycleEnd)}</strong></p>
                      <p><strong>Units to produce:</strong> {fmt(r.targetStock)} − {fmt(r.projectedStockAtCycleEnd)} = <strong className="text-copper">{fmt(r.unitsToProduce)}</strong>{r.fill !== null && <> (fill {r.fill} → {fmt(r.unitsToProduce * r.fill)} capsules, bulk {r.bulkCode || "—"})</>}</p>
                      <p><strong>Incoming POs (due ≤ cycle end):</strong> <PoList pos={r.incomingPOs} /></p>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Bulk section ----------

function BulkTable({ rows }: { rows: BulkPlanRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-cream border-b border-[#e4ddd4]">
          <tr>
            <th className={TH}></th>
            <th className={TH}>Bulk Code</th>
            <th className={TH}>Description</th>
            <th className={`${TH} text-right`}>Capsules Needed</th>
            <th className={`${TH} text-right`}>Stock</th>
            <th className={`${TH} text-right`}>On Order</th>
            <th className={`${TH} text-right`}>Committed Pre-Cycle</th>
            <th className={`${TH} text-right`}>Capsules to Order</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const isOpen = open === r.bulkCode;
            const noAction = r.capsulesToOrder === 0;
            return (
              <>
                <tr key={r.bulkCode}
                    onClick={() => setOpen(isOpen ? null : r.bulkCode)}
                    className={`border-b border-[#e4ddd4]/60 cursor-pointer hover:bg-cream transition-colors ${noAction ? "opacity-50" : ""}`}>
                  <td className={TD}><Chevron open={isOpen} /></td>
                  <td className={`${TD} font-mono text-xs text-copper`}>{r.bulkCode}</td>
                  <td className="px-4 py-3 text-charcoal max-w-[220px] truncate">{r.description}</td>
                  <td className={`${TD} text-right`}>{fmt(r.capsulesNeeded)}</td>
                  <td className={`${TD} text-right text-text-muted`}>{fmt(r.stock)}</td>
                  <td className={`${TD} text-right text-text-muted`}>{fmt(r.openPoQty)}</td>
                  <td className={`${TD} text-right text-text-muted`}>{fmt(r.committedCapsules)}</td>
                  <td className={`${TD} text-right font-semibold ${noAction ? "text-text-muted" : "text-copper"}`}>
                    {noAction ? "Covered" : fmt(r.capsulesToOrder)}
                  </td>
                </tr>
                {isOpen && (
                  <tr key={`${r.bulkCode}-d`} className="bg-cream/60 border-b border-[#e4ddd4]/60">
                    <td></td>
                    <td colSpan={7} className="px-4 py-4 text-xs text-charcoal space-y-1.5">
                      <p><strong>Available bulk</strong> = {fmt(r.stock)} stock + {fmt(r.openPoQty)} on order − {fmt(r.committedCapsules)} committed to pre-cycle packing = <strong>{fmt(r.availableBulk)}</strong> capsules</p>
                      <p><strong>To order:</strong> {fmt(r.capsulesNeeded)} needed − {fmt(r.availableBulk)} available = <strong className="text-copper">{fmt(r.capsulesToOrder)}</strong> capsules</p>
                      <p><strong>Open POs:</strong> <PoList pos={r.openPOs} /></p>
                      <p><strong>Driven by:</strong> {r.skus.map(s => `${s.skuCode} (${fmt(s.units)} × ${s.fill})`).join(", ")}</p>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------- RM section ----------

function RmTable({ rows }: { rows: RmPlanRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-cream border-b border-[#e4ddd4]">
          <tr>
            <th className={TH}></th>
            <th className={TH}>RM Code</th>
            <th className={TH}>Name</th>
            <th className={`${TH} text-right`}>Kg Needed</th>
            <th className={`${TH} text-right`}>Excess (WNP+WNC)</th>
            <th className={`${TH} text-right`}>On Order</th>
            <th className={`${TH} text-right`}>Net</th>
            <th className={`${TH} text-right`}>Order (+8%)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const isOpen = open === r.code;
            const noAction = r.orderQty === 0;
            return (
              <>
                <tr key={r.code}
                    onClick={() => setOpen(isOpen ? null : r.code)}
                    className={`border-b border-[#e4ddd4]/60 cursor-pointer hover:bg-cream transition-colors ${noAction ? "opacity-50" : ""}`}>
                  <td className={TD}><Chevron open={isOpen} /></td>
                  <td className={`${TD} font-mono text-xs text-copper`}>{r.code}</td>
                  <td className="px-4 py-3 text-charcoal max-w-[240px] truncate">{r.name}</td>
                  <td className={`${TD} text-right`}>{fmt(r.kgNeeded, 2)}</td>
                  <td className={`${TD} text-right text-text-muted`}>{fmt(r.excessStock, 2)}</td>
                  <td className={`${TD} text-right text-text-muted`}>{fmt(r.openPoQty, 2)}</td>
                  <td className={`${TD} text-right`}>{fmt(r.netRequired, 2)}</td>
                  <td className={`${TD} text-right font-semibold ${noAction ? "text-text-muted" : "text-copper"}`}>
                    {noAction ? "Covered" : `${fmt(r.orderQty, 2)} kg`}
                  </td>
                </tr>
                {isOpen && (
                  <tr key={`${r.code}-d`} className="bg-cream/60 border-b border-[#e4ddd4]/60">
                    <td></td>
                    <td colSpan={7} className="px-4 py-4 text-xs text-charcoal space-y-1.5">
                      <p><strong>Net:</strong> {fmt(r.kgNeeded, 2)} kg needed − {fmt(r.excessStock, 2)} excess − {fmt(r.openPoQty, 2)} on order = <strong>{fmt(r.netRequired, 2)} kg</strong>; +8% buffer → <strong className="text-copper">{fmt(r.orderQty, 2)} kg</strong></p>
                      <p><strong>Open POs:</strong> <PoList pos={r.openPOs} /></p>
                      <p><strong>Driven by:</strong> {r.usedIn.map(u => `${u.bulkCode} (${fmt(u.kg, 1)} kg)`).join(", ")}</p>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Ancillary section ----------

function AncTable({ rows }: { rows: AncPlanRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-cream border-b border-[#e4ddd4]">
          <tr>
            <th className={TH}></th>
            <th className={TH}>Code</th>
            <th className={TH}>Name</th>
            <th className={TH}>Type</th>
            <th className={`${TH} text-right`}>Needed</th>
            <th className={`${TH} text-right`}>Stock</th>
            <th className={`${TH} text-right`}>Committed</th>
            <th className={`${TH} text-right`}>On Order</th>
            <th className={`${TH} text-right`}>Order (+buffer)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const isOpen = open === r.code;
            const noAction = r.orderQty === 0;
            return (
              <>
                <tr key={r.code}
                    onClick={() => setOpen(isOpen ? null : r.code)}
                    className={`border-b border-[#e4ddd4]/60 cursor-pointer hover:bg-cream transition-colors ${noAction ? "opacity-50" : ""}`}>
                  <td className={TD}><Chevron open={isOpen} /></td>
                  <td className={`${TD} font-mono text-xs text-copper`}>{r.code}</td>
                  <td className="px-4 py-3 text-charcoal max-w-[240px] truncate">{r.name}</td>
                  <td className={TD}><span className="text-xs bg-purple-100 text-purple-700 rounded-full px-2 py-0.5">{r.type}</span></td>
                  <td className={`${TD} text-right`}>{fmt(r.unitsNeeded)}</td>
                  <td className={`${TD} text-right text-text-muted`}>{fmt(r.stock)}</td>
                  <td className={`${TD} text-right text-text-muted`}>{fmt(r.committedUsage)}</td>
                  <td className={`${TD} text-right text-text-muted`}>{fmt(r.openPoQty)}</td>
                  <td className={`${TD} text-right font-semibold ${noAction ? "text-text-muted" : "text-copper"}`}>
                    {noAction ? "Covered" : fmt(r.orderQty)}
                  </td>
                </tr>
                {isOpen && (
                  <tr key={`${r.code}-d`} className="bg-cream/60 border-b border-[#e4ddd4]/60">
                    <td></td>
                    <td colSpan={8} className="px-4 py-4 text-xs text-charcoal space-y-1.5">
                      <p><strong>Available</strong> = max(0, {fmt(r.stock)} stock − {fmt(r.committedUsage)} committed pre-cycle) + {fmt(r.openPoQty)} on order</p>
                      <p><strong>Order:</strong> {fmt(r.unitsNeeded)} needed − available = {fmt(r.netRequired)} net; +{Math.round(r.buffer * 100)}% buffer → <strong className="text-copper">{fmt(r.orderQty)}</strong></p>
                      <p><strong>Open POs:</strong> <PoList pos={r.openPOs} /></p>
                      <p><strong>Driven by:</strong> {r.usedIn.map(u => `${u.skuCode} (${fmt(u.units)})`).join(", ")}</p>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------- main view ----------

export default function ProcurementView({ plan }: { plan: ProcurementPlan }) {
  const fgToProduce = plan.fg.filter(r => r.unitsToProduce > 0);
  const totalCaps = plan.bulk.reduce((s, b) => s + b.capsulesToOrder, 0);
  const rmLines = plan.rm.filter(r => r.orderQty > 0);
  const ancLines = plan.ancillary.filter(r => r.orderQty > 0);

  return (
    <div>
      <SectionCard
        title="1 · Finished Goods (3-codes)"
        exportName="procurement-finished-goods"
        subtitle="SKUs below target cover at cycle end — stock summed across E&G, BCA, WNP, WNC. Greyed rows are covered by stock or incoming POs."
        kpis={[
          { label: "SKUs to Produce", value: String(fgToProduce.length), color: "text-copper" },
          { label: "Total Units", value: fmt(fgToProduce.reduce((s, r) => s + r.unitsToProduce, 0)) },
          { label: "Watchlist (covered)", value: String(plan.fg.length - fgToProduce.length) },
          { label: "Target", value: "16w / 20w" },
        ]}>
        {plan.fg.length === 0 ? <p className="px-5 py-8 text-center text-sm text-text-muted">All SKUs at or above target cover 🎉</p> : <FgTable rows={plan.fg} />}
      </SectionCard>

      <SectionCard
        title="2 · Bulk / Capsules (1-codes)"
        exportName="procurement-bulk"
        subtitle="Capsule requirement from the production plan, net of stock, open POs and bulk committed to pre-cycle packing."
        kpis={[
          { label: "Bulks to Order", value: String(plan.bulk.filter(b => b.capsulesToOrder > 0).length), color: "text-copper" },
          { label: "Total Capsules", value: fmt(totalCaps) },
          { label: "Covered Bulks", value: String(plan.bulk.filter(b => b.capsulesToOrder === 0).length) },
          { label: "Basis", value: "fill × units" },
        ]}>
        {plan.bulk.length === 0 ? <p className="px-5 py-8 text-center text-sm text-text-muted">No bulk requirement for this cycle.</p> : <BulkTable rows={plan.bulk} />}
      </SectionCard>

      <SectionCard
        title="3 · Raw Materials (2-codes)"
        exportName="procurement-raw-materials"
        subtitle="RM explosion of the bulk order via BOM (kg per 1,000 caps), net of WNP+WNC excess stock and open POs. 8% buffer on net."
        kpis={[
          { label: "RMs to Order", value: String(rmLines.length), color: "text-copper" },
          { label: "Total Kg", value: fmt(rmLines.reduce((s, r) => s + r.orderQty, 0), 1) },
          { label: "Covered RMs", value: String(plan.rm.length - rmLines.length) },
          { label: "Buffer", value: "8%" },
        ]}>
        {plan.rm.length === 0 ? <p className="px-5 py-8 text-center text-sm text-text-muted">No raw material requirement for this cycle.</p> : <RmTable rows={plan.rm} />}
      </SectionCard>

      <SectionCard
        title="4 · Ancillaries (4-codes)"
        exportName="procurement-ancillaries"
        subtitle="Jars, lids, boxes, labels and pouches only. Stock net of committed pre-cycle usage and open POs. Buffers: boxes 5%, others 10%."
        kpis={[
          { label: "Lines to Order", value: String(ancLines.length), color: "text-copper" },
          { label: "Total Units", value: fmt(ancLines.reduce((s, r) => s + r.orderQty, 0)) },
          { label: "Covered Lines", value: String(plan.ancillary.length - ancLines.length) },
          { label: "Excluded", value: "Scoops, Shippers" },
        ]}>
        {plan.ancillary.length === 0 ? <p className="px-5 py-8 text-center text-sm text-text-muted">No ancillary requirement for this cycle.</p> : <AncTable rows={plan.ancillary} />}
      </SectionCard>
    </div>
  );
}
