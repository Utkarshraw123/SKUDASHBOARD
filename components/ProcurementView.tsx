"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { ProcurementPlan, FgPlanRow, BulkPlanRow, RmPlanRow, AncPlanRow, PoRef, PlanMeta, UnmatchedRow } from "@/lib/procurement";
import type { OrderActionList } from "@/lib/procurement-actions";
import ExportCsvButton from "./ExportCsvButton";

// ---------- shared bits ----------

function fmt(n: number, dp = 0) {
  return n.toLocaleString("en-GB", { maximumFractionDigits: dp });
}
function coverFmt(w: number) {
  if (!isFinite(w)) return "—";
  return w >= 52 ? "52w+" : `${w.toFixed(1)}w`;
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

// ================= main view =================

export default function ProcurementView({
  plan, orders, start, end, cover, coverCM, perSkuOverrides,
}: {
  plan: ProcurementPlan;
  orders: OrderActionList;
  start: string; end: string; cover: number; coverCM: number;
  perSkuOverrides: Record<string, number>;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Local control state — applied together on "Recalculate".
  const [s, setS] = useState(start);
  const [e, setE] = useState(end);
  const [g, setG] = useState(String(cover));
  const [cm, setCm] = useState(String(coverCM));
  const [targets, setTargets] = useState<Record<string, number>>({ ...perSkuOverrides });

  function recalc() {
    const params = new URLSearchParams();
    params.set("start", s);
    params.set("end", e);
    params.set("cover", g || "16");
    params.set("coverCM", cm || "20");
    const cov = Object.entries(targets).filter(([, w]) => w > 0).map(([k, w]) => `${k}:${w}`).join(",");
    if (cov) params.set("cov", cov);
    router.push(`${pathname}?${params.toString()}`);
  }

  const input = "rounded-xl border border-[#e4ddd4] bg-white px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-copper/30 focus:border-copper";
  const label = "block text-[10px] tracking-widest uppercase text-text-muted mb-1.5";

  const m: PlanMeta = plan.meta;
  const fgToProduce = plan.fg.filter(r => r.unitsToProduce > 0);
  const anyShort = plan.fg.some(r => r.coverShort);

  return (
    <div>
      {/* ---- Control bar ---- */}
      <div className="bg-white rounded-2xl border border-[#e4ddd4] p-5 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className={label} title="Production planned before the cycle start is treated as committed; parts needed before then should already be on an Open PO or in stock.">Cycle start ⓘ</label>
            <input type="date" value={s} onChange={ev => setS(ev.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Cover by (cycle end)</label>
            <input type="date" value={e} onChange={ev => setE(ev.target.value)} className={input} />
          </div>
          <div className="w-28">
            <label className={label} title="Weeks of forward forecast to hold in stock at cycle end (default 16). Opening stock already accounts for planned packing before the cycle.">Target cover (wks) ⓘ</label>
            <input type="number" min={1} value={g} onChange={ev => setG(ev.target.value)} className={input} />
          </div>
          <div className="w-40">
            <label className={label} title="Higher target cover for Collagen &amp; Magnesium (default 20).">Collagen &amp; Mag (wks) ⓘ</label>
            <input type="number" min={1} value={cm} onChange={ev => setCm(ev.target.value)} className={input} />
          </div>
          <button onClick={recalc} className="bg-copper text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-copper-light transition-colors">
            Recalculate plan
          </button>
        </div>
        <p className="text-xs text-text-muted mt-3">
          Demand &amp; cover come from the WoW weekly forecast. Forecast window: {m.firstForecastWeek ?? "—"} → {m.lastForecastWeek ?? "—"}.
          Edit a SKU&apos;s target in the Finished Goods table, then Recalculate.
        </p>
        {m.outOfRange && (
          <p className="mt-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5">
            ⚠ The chosen cycle ({m.cycleStart} → {m.cycleEnd}) is outside the forecast window — no demand found. Pick dates inside {m.firstForecastWeek} → {m.lastForecastWeek}.
          </p>
        )}
        {anyShort && !m.outOfRange && (
          <p className="mt-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm px-4 py-2.5">
            ⚠ Some target-cover windows run past the last forecast week ({m.lastForecastWeek}); those targets use the weeks available.
          </p>
        )}
      </div>

      {/* ---- Headline: MAKE ---- */}
      <SectionCard
        title="Make — production plan"
        exportName="mrp-make-production"
        subtitle={`Produce these finished goods to reach target cover by ${m.cycleEnd}. Built from scratch: supply = current stock + open POs only.`}
        kpis={[
          { label: "SKUs to produce", value: String(fgToProduce.length), color: "text-copper" },
          { label: "Total units", value: fmt(fgToProduce.reduce((a, r) => a + r.unitsToProduce, 0)) },
          { label: "SKUs planned", value: String(m.skusPlanned) },
          { label: "Cycle", value: `${m.cycleStart} → ${m.cycleEnd}` },
        ]}>
        {fgToProduce.length === 0
          ? <p className="px-5 py-8 text-center text-sm text-text-muted">Nothing to produce — every planned SKU already reaches target cover.</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-cream border-b border-[#e4ddd4]"><tr>
                  <th className={TH}>SKU</th><th className={TH}>Product</th>
                  <th className={`${TH} text-right`}>Produce (units)</th>
                  <th className={`${TH} text-right`}>Opening cover</th>
                  <th className={`${TH} text-right`}>Target</th>
                  <th className={TH}>Bulk</th>
                </tr></thead>
                <tbody>
                  {fgToProduce.map(r => (
                    <tr key={r.skuCode} className="border-b border-[#e4ddd4]/60">
                      <td className={`${TD} font-mono text-xs text-copper`}>{r.skuCode}</td>
                      <td className="px-4 py-3 text-charcoal max-w-[260px] truncate">{r.description}</td>
                      <td className={`${TD} text-right font-semibold text-copper`}>{fmt(r.unitsToProduce)}</td>
                      <td className={`${TD} text-right text-text-muted`}>{coverFmt(r.openingCover)}</td>
                      <td className={`${TD} text-right text-text-muted`}>{r.targetCover}w</td>
                      <td className={`${TD} font-mono text-xs text-text-muted`}>{r.bulkCode || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </SectionCard>

      {/* ---- Headline: ORDER ---- */}
      <SectionCard
        title="Order — purchasing plan"
        exportName="mrp-order-purchasing"
        subtitle="What to raise POs for, by supplier — bulk, raw materials and ancillaries needed for the production plan above."
        kpis={[
          { label: "Order lines", value: String(orders.summary.totalLines), color: "text-copper" },
          { label: "Bulk", value: String(orders.summary.bulk) },
          { label: "RM", value: String(orders.summary.rm) },
          { label: "Ancillary", value: String(orders.summary.ancillary) },
        ]}>
        {orders.actions.length === 0
          ? <p className="px-5 py-8 text-center text-sm text-text-muted">No purchasing needed — stock and open POs cover the plan.</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-cream border-b border-[#e4ddd4]"><tr>
                  <th className={TH}>Supplier</th><th className={TH}>Type</th><th className={TH}>Code</th><th className={TH}>Name</th>
                  <th className={`${TH} text-right`}>Order</th><th className={TH}>Unit</th>
                  <th className={`${TH} text-right`}>On order</th><th className={TH}>For</th>
                </tr></thead>
                <tbody>
                  {orders.bySupplier.flatMap(gp => gp.actions.map((a, i) => (
                    <tr key={`${a.partType}-${a.code}-${i}`} className="border-b border-[#e4ddd4]/60">
                      <td className={`${TD} text-charcoal`}>{gp.supplier}</td>
                      <td className={TD}><span className="text-xs bg-cream-dark text-text-muted rounded-full px-2 py-0.5">{a.partType}</span></td>
                      <td className={`${TD} font-mono text-xs text-copper`}>{a.code}</td>
                      <td className="px-4 py-3 text-charcoal max-w-[220px] truncate">{a.name}</td>
                      <td className={`${TD} text-right font-semibold text-copper`}>{fmt(a.qty, 2)}</td>
                      <td className={`${TD} text-text-muted`}>{a.unit}</td>
                      <td className={`${TD} text-right text-text-muted`}>{fmt(a.onOrder, 2)}</td>
                      <td className="px-4 py-3 text-text-muted text-xs max-w-[240px] truncate">{a.note}</td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          )}
      </SectionCard>

      {/* ---- Cascade detail ---- */}
      <h2 className="font-serif text-lg text-charcoal mt-12 mb-4">Cascade detail</h2>

      <FgSection rows={plan.fg} targets={targets} setTargets={setTargets} />
      <BulkSection rows={plan.bulk} />
      <RmSection rows={plan.rm} />
      <AncSection rows={plan.ancillary} />

      {plan.unmatched.length > 0 && (
        <SectionCard
          title="Forecast-only SKUs (not in dashboard)"
          exportName="mrp-forecast-only"
          subtitle="These have WoW forecast demand in the cycle but no ALL SKU DASHBOARD record, so stock and parts can't be planned. Add them to the dashboard to include them."
          kpis={[
            { label: "SKUs", value: String(plan.unmatched.length), color: "text-amber-600" },
            { label: "Cycle demand", value: fmt(plan.unmatched.reduce((a, r) => a + r.cycleDemand, 0)) },
            { label: "Status", value: "Unplanned" },
            { label: "Action", value: "Add to dashboard" },
          ]}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream border-b border-[#e4ddd4]"><tr>
                <th className={TH}>SKU</th><th className={TH}>Product (WoW)</th><th className={`${TH} text-right`}>Cycle demand</th>
              </tr></thead>
              <tbody>
                {plan.unmatched.map(r => (
                  <tr key={r.skuCode} className="border-b border-[#e4ddd4]/60">
                    <td className={`${TD} font-mono text-xs text-amber-700`}>{r.skuCode}</td>
                    <td className="px-4 py-3 text-charcoal max-w-[320px] truncate">{r.product || "—"}</td>
                    <td className={`${TD} text-right`}>{fmt(r.cycleDemand)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ---------- FG section (editable targets) ----------

function FgSection({ rows, targets, setTargets }: {
  rows: FgPlanRow[];
  targets: Record<string, number>;
  setTargets: (fn: (t: Record<string, number>) => Record<string, number>) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const setTarget = (sku: string, v: string) => {
    const n = Number(v);
    setTargets(t => ({ ...t, [sku]: isNaN(n) ? 0 : n }));
  };
  return (
    <SectionCard
      title="1 · Finished Goods"
      exportName="procurement-finished-goods"
      subtitle="Cover from the WoW weekly forecast. Opening cover = projected stock at cycle start. Edit a Target and Recalculate. Greyed rows already reach target."
      kpis={[
        { label: "SKUs to produce", value: String(rows.filter(r => r.unitsToProduce > 0).length), color: "text-copper" },
        { label: "Total units", value: fmt(rows.reduce((a, r) => a + r.unitsToProduce, 0)) },
        { label: "Watchlist (covered)", value: String(rows.filter(r => r.unitsToProduce === 0).length) },
        { label: "Basis", value: "WoW forecast" },
      ]}>
      {rows.length === 0 ? <p className="px-5 py-8 text-center text-sm text-text-muted">No SKUs below target cover for this cycle 🎉</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream border-b border-[#e4ddd4]"><tr>
              <th className={TH}></th><th className={TH}>SKU</th><th className={TH}>Description</th>
              <th className={`${TH} text-right`}>Current stock</th>
              <th className={`${TH} text-right`}>Cover now</th>
              <th className={`${TH} text-right`}>Opening cover</th>
              <th className={`${TH} text-right`}>Cycle demand</th>
              <th className={`${TH} text-right`}>Target (wks)</th>
              <th className={`${TH} text-right`}>Units to produce</th>
            </tr></thead>
            <tbody>
              {rows.map(r => {
                const isOpen = open === r.skuCode;
                const noAction = r.unitsToProduce === 0;
                return (
                  <FgRow key={r.skuCode} r={r} isOpen={isOpen} noAction={noAction}
                    value={targets[r.skuCode] ?? r.targetCover}
                    onToggle={() => setOpen(isOpen ? null : r.skuCode)}
                    onTarget={v => setTarget(r.skuCode, v)} />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function FgRow({ r, isOpen, noAction, value, onToggle, onTarget }: {
  r: FgPlanRow; isOpen: boolean; noAction: boolean; value: number;
  onToggle: () => void; onTarget: (v: string) => void;
}) {
  return (
    <>
      <tr className={`border-b border-[#e4ddd4]/60 hover:bg-cream transition-colors ${noAction ? "opacity-50" : ""}`}>
        <td className={`${TD} cursor-pointer`} onClick={onToggle}><Chevron open={isOpen} /></td>
        <td className={`${TD} font-mono text-xs text-copper cursor-pointer`} onClick={onToggle}>{r.skuCode}</td>
        <td className="px-4 py-3 text-charcoal max-w-[220px] truncate cursor-pointer" onClick={onToggle}>{r.description}</td>
        <td className={`${TD} text-right`}>{fmt(r.currentStock)}</td>
        <td className={`${TD} text-right ${r.currentCover < 8 ? "text-red-600 font-medium" : "text-text-muted"}`}>{coverFmt(r.currentCover)}</td>
        <td className={`${TD} text-right ${r.openingCover < r.targetCover ? "text-amber-600" : "text-text-muted"}`}>{coverFmt(r.openingCover)}</td>
        <td className={`${TD} text-right text-text-muted`}>{fmt(r.cycleDemand)}</td>
        <td className={`${TD} text-right`}>
          <input type="number" min={1} value={value}
            onChange={ev => onTarget(ev.target.value)} onClick={ev => ev.stopPropagation()}
            className="w-16 text-right rounded-lg border border-[#e4ddd4] bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-copper/30 focus:border-copper" />
        </td>
        <td className={`${TD} text-right font-semibold ${noAction ? "text-text-muted" : "text-copper"} cursor-pointer`} onClick={onToggle}>
          {noAction ? "Covered" : fmt(r.unitsToProduce)}
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-cream/60 border-b border-[#e4ddd4]/60">
          <td></td>
          <td colSpan={8} className="px-4 py-4 text-xs text-charcoal space-y-1.5">
            <p><strong>Opening stock @ cycle start</strong> = {fmt(r.currentStock)} current + {fmt(r.plannedPacking)} planned packing before start − forecast sales before start = <strong>{fmt(r.openingStock)}</strong> ({coverFmt(r.openingCover)} cover)</p>
            <p><strong>Cycle demand</strong> (WoW forecast) = <strong>{fmt(r.cycleDemand)}</strong> · <strong>Target stock</strong> ({r.targetCover}w forward) = <strong>{fmt(r.targetStock)}</strong>{r.coverShort && <span className="text-amber-600"> (forecast runs out before {r.targetCover}w)</span>}</p>
            <p><strong>Units to produce this cycle</strong> = target {fmt(r.targetStock)} + cycle demand {fmt(r.cycleDemand)} − opening {fmt(r.openingStock)} = <strong className="text-copper">{fmt(r.unitsToProduce)}</strong>{r.fill !== null && <> · fill {r.fill} → {fmt(r.unitsToProduce * r.fill)} caps, bulk {r.bulkCode || "—"}</>}</p>
            <p className="text-text-muted">In-cycle packing already scheduled is part of this figure (not extra supply). <strong>Pre-cycle supply feeding opening:</strong> <PoList pos={r.incomingPOs} /></p>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------- Bulk ----------

function BulkSection({ rows }: { rows: BulkPlanRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const totalCaps = rows.reduce((s, b) => s + b.capsulesToOrder, 0);
  return (
    <SectionCard
      title="2 · Bulk / Capsules"
      exportName="procurement-bulk"
      subtitle="Capsule requirement from the production plan, net of stock and open POs (bulk POs are in ×1,000 caps)."
      kpis={[
        { label: "Bulks to order", value: String(rows.filter(b => b.capsulesToOrder > 0).length), color: "text-copper" },
        { label: "Total capsules", value: fmt(totalCaps) },
        { label: "Covered bulks", value: String(rows.filter(b => b.capsulesToOrder === 0).length) },
        { label: "Basis", value: "fill × units" },
      ]}>
      {rows.length === 0 ? <p className="px-5 py-8 text-center text-sm text-text-muted">No bulk requirement for this cycle.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream border-b border-[#e4ddd4]"><tr>
              <th className={TH}></th><th className={TH}>Bulk code</th><th className={TH}>Description</th>
              <th className={`${TH} text-right`}>Capsules needed</th><th className={`${TH} text-right`}>Stock</th>
              <th className={`${TH} text-right`}>On order</th><th className={`${TH} text-right`}>Capsules to order</th>
            </tr></thead>
            <tbody>
              {rows.map(r => {
                const isOpen = open === r.bulkCode; const noAction = r.capsulesToOrder === 0;
                return (
                  <>
                    <tr key={r.bulkCode} onClick={() => setOpen(isOpen ? null : r.bulkCode)}
                      className={`border-b border-[#e4ddd4]/60 cursor-pointer hover:bg-cream transition-colors ${noAction ? "opacity-50" : ""}`}>
                      <td className={TD}><Chevron open={isOpen} /></td>
                      <td className={`${TD} font-mono text-xs text-copper`}>{r.bulkCode}</td>
                      <td className="px-4 py-3 text-charcoal max-w-[220px] truncate">{r.description}</td>
                      <td className={`${TD} text-right`}>{fmt(r.capsulesNeeded)}</td>
                      <td className={`${TD} text-right text-text-muted`}>{fmt(r.stock)}</td>
                      <td className={`${TD} text-right text-text-muted`}>{fmt(r.openPoQty)}</td>
                      <td className={`${TD} text-right font-semibold ${noAction ? "text-text-muted" : "text-copper"}`}>{noAction ? "Covered" : fmt(r.capsulesToOrder)}</td>
                    </tr>
                    {isOpen && (
                      <tr key={`${r.bulkCode}-d`} className="bg-cream/60 border-b border-[#e4ddd4]/60">
                        <td></td>
                        <td colSpan={6} className="px-4 py-4 text-xs text-charcoal space-y-1.5">
                          <p><strong>Available</strong> = {fmt(r.stock)} stock + {fmt(r.openPoQty)} on order = <strong>{fmt(r.availableBulk)}</strong> caps</p>
                          <p><strong>To order</strong> = {fmt(r.capsulesNeeded)} needed − {fmt(r.availableBulk)} available = <strong className="text-copper">{fmt(r.capsulesToOrder)}</strong> caps</p>
                          <p><strong>Open POs:</strong> <PoList pos={r.openPOs} /></p>
                          <p><strong>Driven by:</strong> {r.skus.map(x => `${x.skuCode} (${fmt(x.units)} × ${x.fill})`).join(", ")}</p>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

// ---------- RM ----------

function RmSection({ rows }: { rows: RmPlanRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const lines = rows.filter(r => r.orderQty > 0);
  return (
    <SectionCard
      title="3 · Raw Materials"
      exportName="procurement-raw-materials"
      subtitle="RM explosion of the bulk order via BOM (kg per 1,000 caps), net of WNP+WNC excess stock and open POs. 8% buffer on net."
      kpis={[
        { label: "RMs to order", value: String(lines.length), color: "text-copper" },
        { label: "Total kg", value: fmt(lines.reduce((s, r) => s + r.orderQty, 0), 1) },
        { label: "Covered RMs", value: String(rows.length - lines.length) },
        { label: "Buffer", value: "8%" },
      ]}>
      {rows.length === 0 ? <p className="px-5 py-8 text-center text-sm text-text-muted">No raw material requirement for this cycle.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream border-b border-[#e4ddd4]"><tr>
              <th className={TH}></th><th className={TH}>RM code</th><th className={TH}>Name</th>
              <th className={`${TH} text-right`}>Kg needed</th><th className={`${TH} text-right`}>Excess</th>
              <th className={`${TH} text-right`}>On order</th><th className={`${TH} text-right`}>Net</th><th className={`${TH} text-right`}>Order (+8%)</th>
            </tr></thead>
            <tbody>
              {rows.map(r => {
                const isOpen = open === r.code; const noAction = r.orderQty === 0;
                return (
                  <>
                    <tr key={r.code} onClick={() => setOpen(isOpen ? null : r.code)}
                      className={`border-b border-[#e4ddd4]/60 cursor-pointer hover:bg-cream transition-colors ${noAction ? "opacity-50" : ""}`}>
                      <td className={TD}><Chevron open={isOpen} /></td>
                      <td className={`${TD} font-mono text-xs text-copper`}>{r.code}</td>
                      <td className="px-4 py-3 text-charcoal max-w-[240px] truncate">{r.name}</td>
                      <td className={`${TD} text-right`}>{fmt(r.kgNeeded, 2)}</td>
                      <td className={`${TD} text-right text-text-muted`}>{fmt(r.excessStock, 2)}</td>
                      <td className={`${TD} text-right text-text-muted`}>{fmt(r.openPoQty, 2)}</td>
                      <td className={`${TD} text-right`}>{fmt(r.netRequired, 2)}</td>
                      <td className={`${TD} text-right font-semibold ${noAction ? "text-text-muted" : "text-copper"}`}>{noAction ? "Covered" : `${fmt(r.orderQty, 2)} kg`}</td>
                    </tr>
                    {isOpen && (
                      <tr key={`${r.code}-d`} className="bg-cream/60 border-b border-[#e4ddd4]/60">
                        <td></td>
                        <td colSpan={7} className="px-4 py-4 text-xs text-charcoal space-y-1.5">
                          <p><strong>Net</strong> = {fmt(r.kgNeeded, 2)} kg − {fmt(r.excessStock, 2)} excess − {fmt(r.openPoQty, 2)} on order = <strong>{fmt(r.netRequired, 2)} kg</strong>; +8% → <strong className="text-copper">{fmt(r.orderQty, 2)} kg</strong></p>
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
      )}
    </SectionCard>
  );
}

// ---------- Ancillary ----------

function AncSection({ rows }: { rows: AncPlanRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const lines = rows.filter(r => r.orderQty > 0);
  return (
    <SectionCard
      title="4 · Ancillaries"
      exportName="procurement-ancillaries"
      subtitle="Jars, lids, boxes, labels and pouches only. Net of stock and open POs. Buffers: boxes 5%, others 10%."
      kpis={[
        { label: "Lines to order", value: String(lines.length), color: "text-copper" },
        { label: "Total units", value: fmt(lines.reduce((s, r) => s + r.orderQty, 0)) },
        { label: "Covered lines", value: String(rows.length - lines.length) },
        { label: "Excluded", value: "Scoops, Shippers" },
      ]}>
      {rows.length === 0 ? <p className="px-5 py-8 text-center text-sm text-text-muted">No ancillary requirement for this cycle.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream border-b border-[#e4ddd4]"><tr>
              <th className={TH}></th><th className={TH}>Code</th><th className={TH}>Name</th><th className={TH}>Type</th>
              <th className={`${TH} text-right`}>Needed</th><th className={`${TH} text-right`}>Stock</th>
              <th className={`${TH} text-right`}>On order</th><th className={`${TH} text-right`}>Order (+buffer)</th>
            </tr></thead>
            <tbody>
              {rows.map(r => {
                const isOpen = open === r.code; const noAction = r.orderQty === 0;
                return (
                  <>
                    <tr key={r.code} onClick={() => setOpen(isOpen ? null : r.code)}
                      className={`border-b border-[#e4ddd4]/60 cursor-pointer hover:bg-cream transition-colors ${noAction ? "opacity-50" : ""}`}>
                      <td className={TD}><Chevron open={isOpen} /></td>
                      <td className={`${TD} font-mono text-xs text-copper`}>{r.code}</td>
                      <td className="px-4 py-3 text-charcoal max-w-[240px] truncate">{r.name}</td>
                      <td className={TD}><span className="text-xs bg-purple-100 text-purple-700 rounded-full px-2 py-0.5">{r.type}</span></td>
                      <td className={`${TD} text-right`}>{fmt(r.unitsNeeded)}</td>
                      <td className={`${TD} text-right text-text-muted`}>{fmt(r.stock)}</td>
                      <td className={`${TD} text-right text-text-muted`}>{fmt(r.openPoQty)}</td>
                      <td className={`${TD} text-right font-semibold ${noAction ? "text-text-muted" : "text-copper"}`}>{noAction ? "Covered" : fmt(r.orderQty)}</td>
                    </tr>
                    {isOpen && (
                      <tr key={`${r.code}-d`} className="bg-cream/60 border-b border-[#e4ddd4]/60">
                        <td></td>
                        <td colSpan={7} className="px-4 py-4 text-xs text-charcoal space-y-1.5">
                          <p><strong>Available</strong> = {fmt(r.stock)} stock + {fmt(r.openPoQty)} on order · <strong>Order</strong> = {fmt(r.unitsNeeded)} − available = {fmt(r.netRequired)} net; +{Math.round(r.buffer * 100)}% → <strong className="text-copper">{fmt(r.orderQty)}</strong></p>
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
      )}
    </SectionCard>
  );
}
