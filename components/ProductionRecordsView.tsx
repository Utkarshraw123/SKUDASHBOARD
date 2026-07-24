"use client";

import { useMemo, useState } from "react";
import type { YieldReport } from "@/lib/internal-yield";
import ExportCsvButton from "./ExportCsvButton";

function fmt(n: number, dp = 0) {
  return n.toLocaleString("en-GB", { maximumFractionDigits: dp });
}

// Wastage RAG badge, matching the Yield view convention (green ≤2%, amber ≤5%, red above).
function wasteBg(pct: number): string {
  return pct <= 2
    ? "bg-emerald-100 text-emerald-700"
    : pct <= 5
    ? "bg-amber-100 text-amber-700"
    : "bg-red-100 text-red-700";
}

const TH = "px-3 py-3 text-[10px] tracking-widest uppercase text-text-muted font-medium text-left whitespace-nowrap";
const THR = TH + " text-right";
const TD = "px-3 py-3 whitespace-nowrap align-top";
const TDR = TD + " text-right tabular-nums";

function dash(s: string) {
  return s && s.trim() !== "" ? s : "—";
}

export default function ProductionRecordsView({ reports }: { reports: YieldReport[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return reports;
    return reports.filter((r) =>
      [
        r.workOrder,
        r.sku,
        r.description,
        r.productType,
        r.reportId,
        r.productBatches.join(" "),
        r.bulks.map((b) => b.bulkCode).join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(s)
    );
  }, [q, reports]);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search work order, SKU, description, batch, product type…"
            className="w-full rounded-lg border border-[#e4ddd4] bg-white px-4 py-2.5 pr-10 text-sm text-charcoal placeholder:text-text-muted focus:outline-none focus:border-copper transition-colors"
          />
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
        </div>
      </div>

      <div className="rounded-xl border border-[#e4ddd4] bg-cream-light overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e4ddd4]">
          <p className="text-sm text-text-muted">
            Showing {fmt(filtered.length)} of {fmt(reports.length)} reports
          </p>
          <ExportCsvButton filename="production-reports" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e4ddd4] bg-cream-dark/40">
                <th className={TH}>Date</th>
                <th className={TH}>Work Order</th>
                <th className={TH}>SKU</th>
                <th className={TH}>Description</th>
                <th className={TH}>Product Type</th>
                <th className={TH}>WO Status</th>
                <th className={THR}>Made</th>
                <th className={THR}>People</th>
                <th className={TH}>Bulk Code(s)</th>
                <th className={TH}>Product Batch</th>
                <th className={TH}>Product BBD</th>
                <th className={THR}>Capsules Wasted</th>
                <th className={THR}>Ancillary Wasted</th>
                <th className={THR}>Blended Waste %</th>
                <th className={TH}>Disposal #</th>
                <th className={TH}>Comments</th>
                <th className={TH}>Report ID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-text-muted" colSpan={17}>
                    No production reports {q ? "match your search" : "yet"}.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.reportId} className="border-b border-[#f0ebe2] last:border-0 hover:bg-cream-dark/20">
                    <td className={TD}>{dash(r.dateLabel)}</td>
                    <td className={`${TD} font-medium text-charcoal`}>{dash(r.workOrder)}</td>
                    <td className={`${TD} font-mono text-xs`}>{dash(r.sku)}</td>
                    <td className={`${TD} max-w-[16rem] truncate`} title={r.description}>{dash(r.description)}</td>
                    <td className={TD}>{dash(r.productType)}</td>
                    <td className={TD}>{dash(r.woStatus)}</td>
                    <td className={TDR}>{fmt(r.made)}</td>
                    <td className={TDR}>{r.people ? fmt(r.people) : "—"}</td>
                    <td className={`${TD} font-mono text-xs`}>{dash(r.bulks.map((b) => b.bulkCode).filter(Boolean).join(", "))}</td>
                    <td className={`${TD} font-mono text-xs max-w-[12rem] truncate`} title={r.productBatches.join(", ")}>{dash(r.productBatches.join(", "))}</td>
                    <td className={`${TD} text-xs`}>{dash(r.productBBDs.join(", "))}</td>
                    <td className={TDR}>{fmt(r.totalCapsulesWasted)}</td>
                    <td className={TDR}>{fmt(r.totalAncillaryWasted)}</td>
                    <td className={`${TD} text-right`}>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${wasteBg(r.blendedPct)}`}>
                        {r.blendedPct.toFixed(2)}%
                      </span>
                    </td>
                    <td className={`${TD} font-mono text-xs`}>{dash(r.disposalNumber)}</td>
                    <td className={`${TD} max-w-[16rem] truncate`} title={r.comments}>{dash(r.comments)}</td>
                    <td className={`${TD} font-mono text-[11px] text-text-muted`}>{dash(r.reportId)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
