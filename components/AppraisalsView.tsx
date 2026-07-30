"use client";

import ExportCsvButton from "@/components/ExportCsvButton";

interface OpRow { operatorId: number; name: string; runCount: number; totalActual: number; totalPlanned: number; efficiency: number | null; totalDowntimeMin: number; daysWorked: number; avgThroughput: number | null; }
interface McRow { machineId: number; name: string; runCount: number; totalActual: number; totalPlanned: number; efficiency: number | null; totalDowntimeMin: number; avgThroughput: number | null; }

const pct = (e: number | null) => (e == null ? "—" : `${Math.round(e * 100)}%`);
const num = (n: number | null) => (n == null ? "—" : Math.round(n).toLocaleString());

export default function AppraisalsView({
  byOperator, byMachine, range,
}: { byOperator: OpRow[]; byMachine: McRow[]; range: { from: string; to: string } }) {
  return (
    <div className="space-y-10">
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-xl text-charcoal">By operator</h2>
          <ExportCsvButton filename={`appraisals-operator-${range.from}_${range.to}`} />
        </div>
        <div className="overflow-x-auto rounded-xl border border-[#e4ddd4]">
          <table className="min-w-full text-sm">
            <thead className="bg-[#f6f1ea] text-text-muted">
              <tr>
                <th className="text-left px-4 py-2">Operator</th>
                <th className="text-right px-4 py-2">Runs</th>
                <th className="text-right px-4 py-2">Days</th>
                <th className="text-right px-4 py-2">Actual</th>
                <th className="text-right px-4 py-2">Planned</th>
                <th className="text-right px-4 py-2">Efficiency</th>
                <th className="text-right px-4 py-2">Throughput/hr</th>
                <th className="text-right px-4 py-2">Downtime (min)</th>
              </tr>
            </thead>
            <tbody>
              {byOperator.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-text-muted">No runs in range.</td></tr>}
              {byOperator.map((r) => (
                <tr key={r.operatorId} className="border-t border-[#efe8df]">
                  <td className="px-4 py-2 text-charcoal">{r.name}</td>
                  <td className="px-4 py-2 text-right">{r.runCount}</td>
                  <td className="px-4 py-2 text-right">{r.daysWorked}</td>
                  <td className="px-4 py-2 text-right">{num(r.totalActual)}</td>
                  <td className="px-4 py-2 text-right">{num(r.totalPlanned)}</td>
                  <td className="px-4 py-2 text-right">{pct(r.efficiency)}</td>
                  <td className="px-4 py-2 text-right">{num(r.avgThroughput)}</td>
                  <td className="px-4 py-2 text-right">{num(r.totalDowntimeMin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-xl text-charcoal">By machine</h2>
          <ExportCsvButton filename={`appraisals-machine-${range.from}_${range.to}`} />
        </div>
        <div className="overflow-x-auto rounded-xl border border-[#e4ddd4]">
          <table className="min-w-full text-sm">
            <thead className="bg-[#f6f1ea] text-text-muted">
              <tr>
                <th className="text-left px-4 py-2">Machine</th>
                <th className="text-right px-4 py-2">Runs</th>
                <th className="text-right px-4 py-2">Actual</th>
                <th className="text-right px-4 py-2">Planned</th>
                <th className="text-right px-4 py-2">Efficiency</th>
                <th className="text-right px-4 py-2">Throughput/hr</th>
                <th className="text-right px-4 py-2">Downtime (min)</th>
              </tr>
            </thead>
            <tbody>
              {byMachine.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-text-muted">No runs in range.</td></tr>}
              {byMachine.map((r) => (
                <tr key={r.machineId} className="border-t border-[#efe8df]">
                  <td className="px-4 py-2 text-charcoal">{r.name}</td>
                  <td className="px-4 py-2 text-right">{r.runCount}</td>
                  <td className="px-4 py-2 text-right">{num(r.totalActual)}</td>
                  <td className="px-4 py-2 text-right">{num(r.totalPlanned)}</td>
                  <td className="px-4 py-2 text-right">{pct(r.efficiency)}</td>
                  <td className="px-4 py-2 text-right">{num(r.avgThroughput)}</td>
                  <td className="px-4 py-2 text-right">{num(r.totalDowntimeMin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
