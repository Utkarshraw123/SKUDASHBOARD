"use client";

import ExportCsvButton from "@/components/ExportCsvButton";

interface Deny { itemLabel: string; comment: string; critical: boolean; }
interface Row {
  date: string; status: string;
  total: number; startAnswered: number; endAnswered: number;
  startCompletedName: string; startCrossCheckName: string;
  endCompletedName: string; endCrossCheckName: string;
  startDenies: Deny[]; endDenies: Deny[]; hasDeny: boolean;
}

export default function ComplianceView({ rows, range }: { rows: Row[]; range: { from: string; to: string } }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-text-muted">{rows.length} day(s) · {rows.filter((r) => r.hasDeny).length} with denials</p>
        <ExportCsvButton filename={`su04-compliance-${range.from}_${range.to}`} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#e4ddd4]">
        <table className="min-w-full text-sm">
          <thead className="bg-[#f6f1ea] text-text-muted">
            <tr>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Start (by / cross-check)</th>
              <th className="text-right px-3 py-2">Start</th>
              <th className="text-left px-3 py-2">End (by / cross-check)</th>
              <th className="text-right px-3 py-2">End</th>
              <th className="text-left px-3 py-2">Denials</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-text-muted">No checklist days in range.</td></tr>}
            {rows.map((r) => {
              const denies = [...r.startDenies.map((d) => ({ ...d, phase: "Start" })), ...r.endDenies.map((d) => ({ ...d, phase: "End" }))];
              return (
                <tr key={r.date} className={`border-t border-[#efe8df] ${r.hasDeny ? "bg-amber-50" : ""}`}>
                  <td className="px-3 py-2 text-charcoal">{r.date}</td>
                  <td className="px-3 py-2 capitalize">{r.status}</td>
                  <td className="px-3 py-2">{r.startCompletedName} / {r.startCrossCheckName}</td>
                  <td className="px-3 py-2 text-right">{r.startAnswered}/{r.total}</td>
                  <td className="px-3 py-2">{r.endCompletedName} / {r.endCrossCheckName}</td>
                  <td className="px-3 py-2 text-right">{r.endAnswered}/{r.total}</td>
                  <td className="px-3 py-2">
                    {denies.length === 0 ? "—" : (
                      <ul className="space-y-0.5">
                        {denies.map((d, i) => (
                          <li key={i} className="text-amber-700">
                            {d.phase}: {d.itemLabel}{d.critical ? " (critical)" : ""} — {d.comment}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
