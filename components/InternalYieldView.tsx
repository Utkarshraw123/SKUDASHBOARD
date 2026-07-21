"use client";

import { useState, Fragment } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Cell,
} from "recharts";
import type { InternalYield, YieldReport, AncillaryKey } from "@/lib/internal-yield";
import { ANCILLARY_KEYS, ANCILLARY_LABELS } from "@/lib/internal-yield";
import CountUp from "./CountUp";
import ExportCsvButton from "./ExportCsvButton";

function fmt(n: number, dp = 0) {
  return n.toLocaleString("en-GB", { maximumFractionDigits: dp });
}

// Wastage RAG: green ≤2%, amber ≤5%, red above.
function wasteColor(pct: number): string {
  return pct <= 2 ? "text-emerald-600" : pct <= 5 ? "text-amber-600" : "text-red-600";
}
function wasteBg(pct: number): string {
  return pct <= 2 ? "bg-emerald-100 text-emerald-700" : pct <= 5 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
}
function WasteBadge({ pct }: { pct: number }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${wasteBg(pct)}`}>{pct.toFixed(2)}%</span>;
}

const TH = "px-4 py-3 text-[10px] tracking-widest uppercase text-text-muted font-medium text-left whitespace-nowrap";
const TD = "px-4 py-3 whitespace-nowrap";

function Kpi({ label, value, decimals = 0, suffix = "", sub, color }: {
  label: string; value: number; decimals?: number; suffix?: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#e4ddd4] px-5 py-4 transition-shadow duration-300 hover:shadow-[0_2px_20px_-8px_rgba(57,56,54,0.25)]">
      <p className="text-[10px] tracking-widest uppercase text-text-muted mb-1">{label}</p>
      <p className={`text-2xl font-serif font-medium ${color ?? "text-charcoal"}`}>
        <CountUp value={value} decimals={decimals} suffix={suffix} />
      </p>
      {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
    </div>
  );
}

const ANC_COLORS = ["#c9612e", "#393836", "#d9784a", "#8a8480", "#c9a15e", "#a8794f"];

export default function InternalYieldView({ data }: { data: InternalYield }) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [open, setOpen] = useState<string | null>(null);
  const s = data.summary;

  if (s.reports === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#e4ddd4] px-6 py-16 text-center">
        <p className="text-charcoal font-serif text-lg">No production reports yet.</p>
        <p className="text-text-muted text-sm mt-2">
          As supervisors submit the Production Report form, each run&rsquo;s line items, wastage and batch details appear here automatically.
        </p>
      </div>
    );
  }

  const trend = (period === "week" ? data.byWeek : data.byMonth).map(p => ({
    label: p.label, output: p.made, wastage: p.blendedPct,
  }));

  return (
    <div>
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <Kpi label="Reports" value={s.reports} sub={`${s.workOrders} work orders`} />
        <Kpi label="Total Output" value={s.totalOutput} sub="units produced" />
        <Kpi label="Overall Wastage" value={s.overallBlendedPct} decimals={2} suffix="%" color={wasteColor(s.overallBlendedPct)} sub="blended, output-weighted" />
        <Kpi label="Capsules Wasted" value={s.capsulesWasted} sub="across all bulks" />
        <Kpi label="Ancillary Wasted" value={s.ancillaryWasted} sub="units scrapped" />
        <Kpi label="Last Report" value={s.reports} sub={s.lastDateLabel || "—"} color="text-copper" />
      </div>

      {/* Trend: output + wastage, weekly / monthly */}
      <div className="bg-white rounded-2xl border border-[#e4ddd4] p-5 mb-8">
        <div className="flex items-center justify-between mb-1 gap-4">
          <h2 className="font-serif text-lg font-medium text-charcoal">Wastage Trend</h2>
          <div className="inline-flex rounded-full border border-[#e4ddd4] p-0.5 text-xs">
            {(["week", "month"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-full transition-colors ${period === p ? "bg-copper text-white" : "text-text-muted hover:text-charcoal"}`}>
                {p === "week" ? "Weekly" : "Monthly"}
              </button>
            ))}
          </div>
        </div>
        <p className="text-text-muted text-xs mb-4">Bars = output · line = blended wastage %</p>
        {trend.length === 0 ? (
          <p className="py-10 text-center text-text-muted text-sm">No data.</p>
        ) : (
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <ComposedChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="yieldBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c9612e" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#d9784a" stopOpacity={0.55} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4ddd4" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#e4ddd4" }} tick={{ fontSize: 11, fill: "#8a8480" }} />
                <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#8a8480" }} />
                <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#8a8480" }} unit="%" />
                <Tooltip
                  cursor={{ fill: "rgba(201,97,46,0.06)" }}
                  formatter={(v: number, n: string) => n === "Wastage %" ? [`${v.toFixed(2)}%`, n] : [fmt(v), n]}
                  contentStyle={{ borderRadius: 12, border: "1px solid #e4ddd4", backgroundColor: "#fffdf9", fontSize: 12, boxShadow: "0 8px 24px -12px rgba(57,56,54,0.35)" }}
                  labelStyle={{ color: "#393836", fontWeight: 600 }}
                />
                <Bar yAxisId="left" dataKey="output" fill="url(#yieldBar)" radius={[5, 5, 0, 0]} name="Output" isAnimationActive={false} />
                <Line yAxisId="right" type="monotone" dataKey="wastage" stroke="#393836" strokeWidth={2.5} dot={{ r: 3, fill: "#393836" }} activeDot={{ r: 5, fill: "#393836", stroke: "#fffdf9", strokeWidth: 2 }} name="Wastage %" animationDuration={1200} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Ancillary wastage + By work order */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Ancillary */}
        <div className="bg-white rounded-2xl border border-[#e4ddd4] p-5">
          <h2 className="font-serif text-lg font-medium text-charcoal mb-1">Wastage by Ancillary</h2>
          <p className="text-text-muted text-xs mb-4">Scrap rate per component type — worst first</p>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={data.byAncillary} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4ddd4" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#8a8480" }} unit="%" />
                <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={70} tick={{ fontSize: 12, fill: "#393836" }} />
                <Tooltip
                  cursor={{ fill: "rgba(201,97,46,0.06)" }}
                  formatter={(v: number) => [`${v.toFixed(2)}%`, "Wastage"]}
                  contentStyle={{ borderRadius: 12, border: "1px solid #e4ddd4", backgroundColor: "#fffdf9", fontSize: 12 }}
                />
                <Bar dataKey="wastePct" radius={[0, 5, 5, 0]} isAnimationActive={false}>
                  {data.byAncillary.map((_, i) => <Cell key={i} fill={ANC_COLORS[i % ANC_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {data.byAncillary.map(a => (
              <div key={a.key} className="rounded-lg bg-cream px-2 py-2">
                <p className="text-[10px] uppercase tracking-wide text-text-muted">{a.label}</p>
                <p className={`text-sm font-medium ${wasteColor(a.wastePct)}`}>{a.wastePct.toFixed(2)}%</p>
                <p className="text-[10px] text-text-muted">{fmt(a.wasted)} units</p>
              </div>
            ))}
          </div>
        </div>

        {/* By work order */}
        <div className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#e4ddd4]">
            <div>
              <h2 className="font-serif text-lg font-medium text-charcoal">Wastage by Work Order</h2>
              <p className="text-text-muted text-xs mt-0.5">Worst blended wastage first</p>
            </div>
            <ExportCsvButton filename="internal-yield-by-work-order" />
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm">
              <thead className="bg-cream border-b border-[#e4ddd4]">
                <tr>
                  <th className={TH}>Work Order</th>
                  <th className={TH}>Product</th>
                  <th className={`${TH} text-right`}>Made</th>
                  <th className={`${TH} text-right`}>Caps Waste</th>
                  <th className={`${TH} text-right`}>Blended</th>
                </tr>
              </thead>
              <tbody>
                {data.byWorkOrder.map(w => (
                  <tr key={w.workOrder} className="border-b border-[#e4ddd4]/60 hover:bg-cream transition-colors">
                    <td className={`${TD} font-mono text-xs text-copper`}>{w.workOrder}</td>
                    <td className="px-4 py-3 text-charcoal max-w-[220px] truncate" title={w.description}>{w.description}</td>
                    <td className={`${TD} text-right`}>{fmt(w.made)}</td>
                    <td className={`${TD} text-right text-text-muted`}>{fmt(w.capsulesWasted)}</td>
                    <td className={`${TD} text-right`}><WasteBadge pct={w.blendedPct} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Batch tracking — compliance */}
      <div className="mb-8">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-lg font-medium text-charcoal">Batch Tracking &mdash; Compliance</h2>
            <p className="text-text-muted text-xs mt-0.5">Full traceability: finished-good batch &harr; bulk batch &harr; BBD &harr; disposal reference, one row per bulk used.</p>
          </div>
          <ExportCsvButton filename="internal-yield-batch-tracking" />
        </div>
        <div className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream border-b border-[#e4ddd4]">
                <tr>
                  <th className={TH}>Date</th>
                  <th className={TH}>Work Order</th>
                  <th className={TH}>SKU</th>
                  <th className={TH}>Product Batch</th>
                  <th className={TH}>Bulk Code</th>
                  <th className={TH}>Bulk Batch</th>
                  <th className={TH}>Bulk BBD</th>
                  <th className={`${TH} text-right`}>Made</th>
                  <th className={`${TH} text-right`}>Caps Waste</th>
                  <th className={TH}>Disposal #</th>
                </tr>
              </thead>
              <tbody>
                {data.batches.map((b, i) => (
                  <tr key={i} className="border-b border-[#e4ddd4]/60 hover:bg-cream transition-colors">
                    <td className={`${TD} text-text-muted`}>{b.dateLabel}</td>
                    <td className={`${TD} font-mono text-xs text-copper`}>{b.workOrder}</td>
                    <td className={`${TD} font-mono text-xs`}>{b.sku}</td>
                    <td className={`${TD} font-mono text-xs`}>{b.productBatch || "—"}</td>
                    <td className={`${TD} font-mono text-xs`}>{b.bulkCode}</td>
                    <td className={`${TD} font-mono text-xs`}>{b.bulkBatch || "—"}</td>
                    <td className={`${TD} text-text-muted`}>{b.bulkBBD || "—"}</td>
                    <td className={`${TD} text-right`}>{fmt(b.made)}</td>
                    <td className={`${TD} text-right text-text-muted`}>{fmt(b.wasteCapsules)}</td>
                    <td className={`${TD} font-mono text-xs ${b.disposalNumber ? "text-charcoal" : "text-text-muted"}`}>{b.disposalNumber || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Line-item detail — expandable per report */}
      <div className="mb-4">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-lg font-medium text-charcoal">Production Line Items</h2>
            <p className="text-text-muted text-xs mt-0.5">Every reported run, newest first. Click to see bulks &amp; per-ancillary waste.</p>
          </div>
          <ExportCsvButton filename="internal-yield-line-items" />
        </div>
        <div className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream border-b border-[#e4ddd4]">
                <tr>
                  <th className={TH}></th>
                  <th className={TH}>Date</th>
                  <th className={TH}>Work Order</th>
                  <th className={TH}>Product</th>
                  <th className={TH}>Type</th>
                  <th className={`${TH} text-right`}>Made</th>
                  <th className={`${TH} text-right`}>People</th>
                  <th className={`${TH} text-right`}>Blended</th>
                  <th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.reports.map(r => (
                  <ReportRow key={r.reportId} r={r} open={open === r.reportId} onToggle={() => setOpen(open === r.reportId ? null : r.reportId)} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportRow({ r, open, onToggle }: { r: YieldReport; open: boolean; onToggle: () => void }) {
  return (
    <Fragment>
      <tr onClick={onToggle} className="border-b border-[#e4ddd4]/60 cursor-pointer hover:bg-cream transition-colors">
        <td className={TD}><span className={`inline-block transition-transform text-text-muted ${open ? "rotate-90" : ""}`}>&#9656;</span></td>
        <td className={`${TD} text-text-muted`}>{r.dateLabel}</td>
        <td className={`${TD} font-mono text-xs text-copper`}>{r.workOrder}</td>
        <td className="px-4 py-3 text-charcoal max-w-[240px] truncate" title={r.description}>{r.description}</td>
        <td className={`${TD} text-text-muted capitalize`}>{r.productType || "—"}</td>
        <td className={`${TD} text-right`}>{fmt(r.made)}</td>
        <td className={`${TD} text-right text-text-muted`}>{r.people || "—"}</td>
        <td className={`${TD} text-right`}><WasteBadge pct={r.blendedPct} /></td>
        <td className={`${TD} text-text-muted capitalize`}>{r.woStatus || "—"}</td>
      </tr>
      {open && (
        <tr className="bg-cream/50 border-b border-[#e4ddd4]/60">
          <td></td>
          <td colSpan={8} className="px-4 py-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bulks */}
              <div>
                <p className="text-[10px] tracking-widest uppercase text-text-muted mb-2">Bulk usage &amp; capsule waste</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-text-muted text-left">
                      <th className="py-1 pr-3">Bulk</th><th className="py-1 pr-3">Batch</th><th className="py-1 pr-3">BBD</th>
                      <th className="py-1 pr-3 text-right">Used</th><th className="py-1 pr-3 text-right">Waste</th><th className="py-1 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.bulks.map((b, i) => (
                      <tr key={i} className="border-t border-[#e4ddd4]/40">
                        <td className="py-1 pr-3 font-mono">{b.bulkCode}</td>
                        <td className="py-1 pr-3 font-mono">{b.bulkBatch || "—"}</td>
                        <td className="py-1 pr-3">{b.bulkBBD || "—"}</td>
                        <td className="py-1 pr-3 text-right">{fmt(b.used)}</td>
                        <td className="py-1 pr-3 text-right">{fmt(b.wasteCapsules)}</td>
                        <td className={`py-1 text-right font-medium ${wasteColor(b.capsuleWastePct)}`}>{b.capsuleWastePct.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Ancillary waste + meta */}
              <div>
                <p className="text-[10px] tracking-widest uppercase text-text-muted mb-2">Ancillary waste</p>
                <div className="grid grid-cols-3 gap-2">
                  {ANCILLARY_KEYS.map((k: AncillaryKey) => (
                    <div key={k} className="rounded-lg bg-white border border-[#e4ddd4] px-2 py-1.5 text-center">
                      <p className="text-[9px] uppercase tracking-wide text-text-muted">{ANCILLARY_LABELS[k]}</p>
                      <p className="text-xs font-medium text-charcoal">{fmt(r.ancWaste[k])}</p>
                      <p className={`text-[9px] ${wasteColor(r.ancPct[k])}`}>{r.ancPct[k].toFixed(2)}%</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs text-text-muted space-y-0.5">
                  {r.productBatches.length > 0 && <p><span className="text-charcoal font-medium">Product batch:</span> {r.productBatches.join(", ")} {r.productBBDs.length > 0 && `· BBD ${r.productBBDs.join(", ")}`}</p>}
                  {r.disposalNumber && <p><span className="text-charcoal font-medium">Disposal #:</span> <span className="font-mono">{r.disposalNumber}</span></p>}
                  {r.comments && <p><span className="text-charcoal font-medium">Comments:</span> {r.comments}</p>}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}
