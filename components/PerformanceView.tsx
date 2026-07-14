"use client";

import { useState, Fragment } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import type { PerformanceData, GroupStat } from "@/lib/performance";
import { ragOf } from "@/lib/performance";
import ExportCsvButton from "./ExportCsvButton";

function fmt(n: number, dp = 0) {
  return n.toLocaleString("en-GB", { maximumFractionDigits: dp });
}

const ragColor: Record<string, string> = {
  green: "text-emerald-600",
  amber: "text-amber-600",
  red: "text-red-600",
};
const ragBg: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
};

function EffBadge({ pct }: { pct: number }) {
  const rag = ragOf(pct);
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${ragBg[rag]}`}>{pct.toFixed(1)}%</span>;
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#e4ddd4] px-5 py-4">
      <p className="text-[10px] tracking-widest uppercase text-text-muted mb-1">{label}</p>
      <p className={`text-2xl font-serif font-medium ${color ?? "text-charcoal"}`}>{value}</p>
      {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
    </div>
  );
}

const TH = "px-4 py-3 text-[10px] tracking-widest uppercase text-text-muted font-medium text-left whitespace-nowrap";
const TD = "px-4 py-3 whitespace-nowrap";

function BreakdownTable({
  title, subtitle, stats, exportName, unit = "task", showDaysWorked = false,
}: { title: string; subtitle: string; stats: GroupStat[]; exportName: string; unit?: string; showDaysWorked?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-lg font-medium text-charcoal">{title}</h2>
          <p className="text-text-muted text-xs mt-0.5">{subtitle}</p>
        </div>
        <ExportCsvButton filename={exportName} />
      </div>
      <div className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream border-b border-[#e4ddd4]">
              <tr>
                <th className={TH}></th>
                <th className={TH}>{title.replace("By ", "")}</th>
                <th className={`${TH} text-right`}>Planned</th>
                <th className={`${TH} text-right`}>Actual</th>
                <th className={`${TH} text-right`}>Efficiency</th>
                <th className={`${TH} text-right`}>{unit === "task" ? "Tasks" : unit}</th>
                {showDaysWorked && <th className={`${TH} text-right`}>Days Worked</th>}
                <th className={`${TH} text-right`}>Below Target</th>
              </tr>
            </thead>
            <tbody>
              {stats.map(s => {
                const isOpen = open === s.key;
                return (
                  <Fragment key={s.key}>
                    <tr onClick={() => setOpen(isOpen ? null : s.key)}
                        className="border-b border-[#e4ddd4]/60 cursor-pointer hover:bg-cream transition-colors">
                      <td className={TD}><span className={`inline-block transition-transform text-text-muted ${isOpen ? "rotate-90" : ""}`}>▸</span></td>
                      <td className="px-4 py-3 text-charcoal max-w-[240px] truncate">{s.label}</td>
                      <td className={`${TD} text-right text-text-muted`}>{fmt(s.planned)}</td>
                      <td className={`${TD} text-right font-medium`}>{fmt(s.actual)}</td>
                      <td className={`${TD} text-right`}><EffBadge pct={s.efficiency} /></td>
                      <td className={`${TD} text-right text-text-muted`}>{s.tasks}</td>
                      {showDaysWorked && <td className={`${TD} text-right text-text-muted`}>{new Set(s.rows.map(r => r.date)).size}</td>}
                      <td className={`${TD} text-right ${s.belowTarget > 0 ? "text-red-600 font-medium" : "text-text-muted"}`}>{s.belowTarget}</td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-cream/50 border-b border-[#e4ddd4]/60">
                        <td></td>
                        <td colSpan={showDaysWorked ? 7 : 6} className="px-4 py-3">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-text-muted">
                                  <th className="text-left py-1 pr-4">Date</th>
                                  <th className="text-left py-1 pr-4">Employee</th>
                                  <th className="text-left py-1 pr-4">Machine</th>
                                  <th className="text-left py-1 pr-4">Shift</th>
                                  <th className="text-right py-1 pr-4">Planned</th>
                                  <th className="text-right py-1 pr-4">Actual</th>
                                  <th className="text-right py-1 pr-4">Eff</th>
                                  <th className="text-left py-1">Comments</th>
                                </tr>
                              </thead>
                              <tbody>
                                {s.rows.slice(0, 60).map((r, i) => {
                                  const e = (r.plannedQty ?? 0) > 0 ? ((r.actualQty ?? 0) / (r.plannedQty ?? 1)) * 100 : 0;
                                  return (
                                    <tr key={i} className="border-t border-[#e4ddd4]/40">
                                      <td className="py-1 pr-4 whitespace-nowrap">{r.date}</td>
                                      <td className="py-1 pr-4 whitespace-nowrap">{r.employee}</td>
                                      <td className="py-1 pr-4 whitespace-nowrap">{r.machine}</td>
                                      <td className="py-1 pr-4 whitespace-nowrap">{r.shift}</td>
                                      <td className="py-1 pr-4 text-right">{fmt(r.plannedQty ?? 0)}</td>
                                      <td className="py-1 pr-4 text-right">{fmt(r.actualQty ?? 0)}</td>
                                      <td className={`py-1 pr-4 text-right font-medium ${ragColor[ragOf(e)]}`}>{e.toFixed(0)}%</td>
                                      <td className="py-1 text-charcoal max-w-[280px] truncate" title={r.comments}>{r.comments}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function PerformanceView({ data }: { data: PerformanceData }) {
  const effRag = ragOf(data.weightedEfficiency);

  return (
    <div>
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <Kpi label="Total Output" value={fmt(data.totalOutput)} sub={`vs ${fmt(data.totalPlanned)} planned`} />
        <Kpi label="Efficiency" value={`${data.weightedEfficiency.toFixed(1)}%`} color={ragColor[effRag]} sub="actual ÷ planned" />
        <Kpi label="Yield" value={data.wastage.yieldPct !== null ? `${data.wastage.yieldPct}%` : "—"} sub={data.wastage.yieldPct !== null ? "good-output rate" : "awaiting reports"} color={data.wastage.yieldPct !== null ? "text-copper" : "text-text-muted"} />
        <Kpi label="Avg Wastage" value={data.wastage.reportsCount > 0 ? `${data.wastage.avgBlendedWaste}%` : "—"} sub={data.wastage.reportsCount > 0 ? `${data.wastage.reportsCount} reports` : "awaiting reports"} />
        <Kpi label="Headcount" value={fmt(data.headcountPresent)} sub="present in range" />
        <Kpi label="Below Target" value={fmt(data.tasksBelowTarget)} sub={`of ${data.totalTasks} tasks`} color={data.tasksBelowTarget > 0 ? "text-red-600" : "text-charcoal"} />
      </div>

      {/* Trend */}
      <div className="bg-white rounded-2xl border border-[#e4ddd4] p-5 mb-8">
        <h2 className="font-serif text-lg font-medium text-charcoal mb-1">Output &amp; Efficiency Trend</h2>
        <p className="text-text-muted text-xs mb-4">Bars = actual output · line = efficiency %</p>
        {data.trend.length === 0 ? (
          <p className="py-10 text-center text-text-muted text-sm">No data in range.</p>
        ) : (
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <ComposedChart data={data.trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4ddd4" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8a8480" }} angle={-30} textAnchor="end" height={60} interval="preserveStartEnd" />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#8a8480" }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#8a8480" }} domain={[0, 120]} unit="%" />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e4ddd4", fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="actual" fill="#c9612e" radius={[4, 4, 0, 0]} name="Actual output" />
                <Line yAxisId="right" type="monotone" dataKey="efficiency" stroke="#393836" strokeWidth={2} dot={false} name="Efficiency %" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <BreakdownTable title="By Machine" subtitle="Sorted worst-efficiency first — bottlenecks at the top. Click to see the tasks and supervisor comments." stats={data.byMachine} exportName="performance-by-machine" />
      <BreakdownTable title="By Employee" subtitle="Output and efficiency per person. Click to expand tasks." stats={data.byEmployee} exportName="performance-by-employee" showDaysWorked />
      <BreakdownTable title="By Shift" subtitle="Shift comparison." stats={data.byShift} exportName="performance-by-shift" />
      <BreakdownTable title="By Product" subtitle="Which SKUs run efficiently vs. drag." stats={data.byProduct} exportName="performance-by-product" />

      {/* Wastage panel */}
      <div className="mb-8">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-lg font-medium text-charcoal">Material Wastage &amp; Yield</h2>
            <p className="text-text-muted text-xs mt-0.5">From supervisor production reports — blended wastage % per SKU (yield = 100 − wastage).</p>
          </div>
          {data.wastage.reportsCount > 0 && <ExportCsvButton filename="performance-wastage" />}
        </div>
        <div className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden">
          {data.wastage.reportsCount === 0 ? (
            <p className="px-5 py-10 text-center text-text-muted text-sm">
              Awaiting production reports. As supervisors submit reports via the production form, per-SKU wastage and yield will appear here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-cream border-b border-[#e4ddd4]">
                  <tr>
                    <th className={TH}>SKU</th>
                    <th className={TH}>Description</th>
                    <th className={`${TH} text-right`}>Reports</th>
                    <th className={`${TH} text-right`}>Total Made</th>
                    <th className={`${TH} text-right`}>Avg Wastage</th>
                    <th className={`${TH} text-right`}>Yield</th>
                  </tr>
                </thead>
                <tbody>
                  {data.wastage.bySku.map(s => (
                    <tr key={s.sku} className="border-b border-[#e4ddd4]/60 hover:bg-cream transition-colors">
                      <td className={`${TD} font-mono text-xs text-copper`}>{s.sku}</td>
                      <td className="px-4 py-3 text-charcoal max-w-[260px] truncate">{s.description}</td>
                      <td className={`${TD} text-right text-text-muted`}>{s.reports}</td>
                      <td className={`${TD} text-right`}>{fmt(s.totalMade)}</td>
                      <td className={`${TD} text-right font-medium ${s.avgWaste > 5 ? "text-red-600" : "text-charcoal"}`}>{s.avgWaste}%</td>
                      <td className={`${TD} text-right font-medium text-emerald-600`}>{(100 - s.avgWaste).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
