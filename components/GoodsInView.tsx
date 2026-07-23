"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { GoodsInTask, GoodsInRecord, GoodsInPoTask, Urgency, PartCategory, GoodsInPoStatus } from "@/lib/goods-in";
import { summarisePo, partCategory, GOODS_IN_PART_CHIPS } from "@/lib/goods-in";
import CountUp from "./CountUp";
import GoodsInForm from "./GoodsInForm";
import GoodsInPoForm from "./GoodsInPoForm";

const URGENCY: Record<Urgency, { label: string; cls: string }> = {
  overdue: { label: "Overdue", cls: "bg-red-100 text-red-700" },
  today: { label: "Due today", cls: "bg-amber-100 text-amber-700" },
  soon: { label: "This week", cls: "bg-[#fdf3ee] text-copper" },
  later: { label: "Upcoming", cls: "bg-cream-dark text-text-muted" },
  none: { label: "No date", cls: "bg-cream-dark text-text-muted" },
};
const PO_STATUS: Record<GoodsInPoStatus, { label: string; cls: string }> = {
  awaiting: { label: "Awaiting", cls: "bg-cream-dark text-text-muted" },
  partial: { label: "Partial", cls: "bg-amber-100 text-amber-700" },
  filed: { label: "Filed", cls: "bg-emerald-100 text-emerald-700" },
};

const TH = "px-4 py-3 text-[10px] tracking-widest uppercase text-text-muted font-medium text-left whitespace-nowrap";
const TD = "px-4 py-3 whitespace-nowrap";

function Kpi({ label, value, color, sub }: { label: string; value: number; color?: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#e4ddd4] px-5 py-4">
      <p className="text-[10px] tracking-widest uppercase text-text-muted mb-1">{label}</p>
      <p className={`text-2xl font-serif font-medium ${color ?? "text-charcoal"}`}><CountUp value={value} /></p>
      {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
    </div>
  );
}

function PartChips({ value, onChange }: { value: PartCategory | "all"; onChange: (v: PartCategory | "all") => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {GOODS_IN_PART_CHIPS.map(c => (
        <button key={c.key} type="button" onClick={() => onChange(c.key)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${value === c.key ? "bg-charcoal text-white border-charcoal" : "border-[#e4ddd4] text-text-muted hover:bg-cream"}`}>
          {c.label}
        </button>
      ))}
    </div>
  );
}

// Reconstruct a single-line GoodsInTask so a 1-line PO reuses the existing simple modal.
function toSingleTask(po: GoodsInPoTask): { task: GoodsInTask; record: GoodsInRecord | null } {
  const l = po.lines[0];
  return {
    task: {
      po: po.po, partNumber: l.partNumber, description: l.description, partType: l.partType,
      supplier: po.supplier, quantity: l.quantity, dueDate: l.dueDate, dueISO: l.dueISO,
      status: l.record ? "booked_in" : "awaiting", urgency: l.urgency,
    },
    record: l.record,
  };
}

async function downloadGrn(rec: GoodsInRecord) {
  const res = await fetch("/api/goods-in/doc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rec) });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `GoodsIn-${rec.po}-${rec.partNumber}.docx`; a.click();
  URL.revokeObjectURL(url);
}
async function downloadPoGrn(po: string, supplier: string, recs: GoodsInRecord[]) {
  const lines = recs.map(r => ({ partNumber: r.partNumber, description: r.description, quantity: r.quantity, supplierProductCode: r.supplierProductCode, batchLot: r.batchLot, bbd: r.bbd }));
  const res = await fetch("/api/goods-in/doc/po", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ po, supplier, lines }) });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `GoodsIn-${po}-all.docx`; a.click();
  URL.revokeObjectURL(url);
}

export default function GoodsInView({ poTasks, records }: { poTasks: GoodsInPoTask[]; records: GoodsInRecord[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "awaiting" | "partial" | "filed">("awaiting");
  const [tasksPart, setTasksPart] = useState<PartCategory | "all">("all");
  const [recordsPart, setRecordsPart] = useState<PartCategory | "all">("all");
  const [singleActive, setSingleActive] = useState<{ task: GoodsInTask; record: GoodsInRecord | null } | null>(null);
  const [poActive, setPoActive] = useState<GoodsInPoTask | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const s = summarisePo(poTasks);

  const shown = useMemo(
    () => poTasks.filter(t =>
      (filter === "all" || t.status === filter) &&
      (tasksPart === "all" || t.lines.some(l => partCategory(l.partNumber) === tasksPart))),
    [poTasks, filter, tasksPart],
  );

  // Filed records grouped by PO (active, non-void), part-filtered.
  const recordGroups = useMemo(() => {
    const filtered = records.filter(r => recordsPart === "all" || partCategory(r.partNumber) === recordsPart);
    const map = new Map<string, GoodsInRecord[]>();
    for (const r of filtered) { const a = map.get(r.po); if (a) a.push(r); else map.set(r.po, [r]); }
    return Array.from(map.entries());
  }, [records, recordsPart]);

  function openPo(t: GoodsInPoTask) {
    if (t.totalCount === 1) setSingleActive(toSingleTask(t));
    else setPoActive(t);
  }

  async function del(r: GoodsInRecord) {
    if (!window.confirm(`Delete the filed Goods In form for PO ${r.po} / part ${r.partNumber}? It returns to the awaiting list.`)) return;
    const password = window.prompt("Goods In / compliance password to delete:") ?? "";
    if (!password) return;
    setDeleting(r.recordId || `${r.po} ${r.partNumber} ${r.timestamp}`);
    try {
      const res = await fetch("/api/goods-in/void", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: r.recordId, fallbackKey: `${r.po} ${r.partNumber} ${r.timestamp}`, password }),
      });
      const data = await res.json();
      if (!res.ok) { window.alert(data.error || "Failed to delete."); return; }
      router.refresh();
    } catch { window.alert("Network error — please try again."); }
    finally { setDeleting(null); }
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Kpi label="Awaiting" value={s.awaiting} color="text-copper" sub="POs to file" />
        <Kpi label="Partial" value={s.partial} color={s.partial > 0 ? "text-amber-600" : undefined} sub="part-filed" />
        <Kpi label="Overdue" value={s.overdue} color={s.overdue > 0 ? "text-red-600" : undefined} />
        <Kpi label="Filed" value={s.filed} color="text-emerald-600" sub="POs complete" />
      </div>

      {/* PO tasks */}
      <div className="mb-3 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-serif text-lg font-medium text-charcoal">Goods In by PO</h2>
          <div className="flex gap-1.5">
            {(["awaiting", "partial", "filed", "all"] as const).map(f => (
              <button key={f} type="button" onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === f ? "bg-copper text-white border-copper" : "border-[#e4ddd4] text-text-muted hover:bg-cream"}`}>
                {f === "awaiting" ? "Awaiting" : f === "partial" ? "Partial" : f === "filed" ? "Filed" : "All"}
              </button>
            ))}
          </div>
        </div>
        <PartChips value={tasksPart} onChange={setTasksPart} />
      </div>

      <div className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden mb-10">
        {shown.length === 0 ? (
          <p className="px-5 py-12 text-center text-text-muted text-sm">
            {poTasks.length === 0 ? "No open purchase orders." : "Nothing matches this filter."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream border-b border-[#e4ddd4]">
                <tr>
                  <th className={TH}>PO</th><th className={TH}>Supplier</th><th className={`${TH} text-right`}>Items</th>
                  <th className={TH}>Progress</th><th className={TH}>Earliest due</th><th className={`${TH} text-right`}></th>
                </tr>
              </thead>
              <tbody>
                {shown.map(t => {
                  const u = URGENCY[t.urgency];
                  const ps = PO_STATUS[t.status];
                  return (
                    <tr key={t.po} className="border-b border-[#e4ddd4]/60 hover:bg-cream transition-colors">
                      <td className={`${TD} font-mono text-xs text-copper`}>{t.po}</td>
                      <td className="px-4 py-3 text-text-muted max-w-[200px] truncate" title={t.supplier}>{t.supplier || "—"}</td>
                      <td className={`${TD} text-right`}>{t.totalCount}</td>
                      <td className={TD}>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${ps.cls}`}>{ps.label}</span>
                        <span className="ml-2 text-xs text-text-muted">{t.filedCount} of {t.totalCount} filed</span>
                      </td>
                      <td className={TD}>
                        <span className="text-charcoal">{t.dueDate || "—"}</span>
                        {t.status !== "filed" && <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${u.cls}`}>{u.label}</span>}
                      </td>
                      <td className={`${TD} text-right`}>
                        <button onClick={() => openPo(t)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${t.status === "filed" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-copper text-white hover:bg-copper-light"}`}>
                          {t.status === "filed" ? "Review →" : t.status === "partial" ? "Continue →" : "Open PO →"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Filed records, grouped by PO */}
      <div className="mb-3 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-lg font-medium text-charcoal">Filed Goods In forms</h2>
          <p className="text-text-muted text-xs mt-0.5">Batch &amp; BBD captured for warehouse verification. Download the combined Word form per PO.</p>
        </div>
        <PartChips value={recordsPart} onChange={setRecordsPart} />
      </div>
      <div className="space-y-4">
        {recordGroups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#e4ddd4] px-5 py-12 text-center text-text-muted text-sm">
            {records.length === 0 ? "No forms filed yet. Open a PO above and save it to create one." : "No filed forms match this filter."}
          </div>
        ) : recordGroups.map(([po, recs]) => (
          <div key={po} className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-cream border-b border-[#e4ddd4]">
              <div className="text-sm"><span className="font-mono text-copper">{po}</span><span className="text-text-muted"> · {recs.length} filed</span></div>
              <button onClick={() => downloadPoGrn(po, recs[0]?.supplier ?? "", recs)} className="text-copper hover:text-copper-light text-xs font-medium inline-flex items-center gap-1">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                Word (all)
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-cream border-b border-[#e4ddd4]">
                  <tr>
                    <th className={TH}>Part</th><th className={TH}>Batch/Lot</th><th className={TH}>BBD</th><th className={TH}>Supplier Code</th>
                    <th className={TH}>CofA</th><th className={TH}>Docs</th><th className={`${TH} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recs.map((r, i) => (
                    <tr key={r.partNumber + r.timestamp + i} className="border-b border-[#e4ddd4]/60 hover:bg-cream transition-colors">
                      <td className={`${TD} font-mono text-xs`}>{r.partNumber}</td>
                      <td className={`${TD} font-mono text-xs`}>{r.batchLot || "—"}</td>
                      <td className={TD}>{r.bbd || "—"}</td>
                      <td className={`${TD} font-mono text-xs`}>{r.supplierProductCode || "—"}</td>
                      <td className={TD}>{r.coaUrl ? <a href={r.coaUrl} target="_blank" rel="noopener noreferrer" className="text-copper hover:underline">CofA ↗</a> : <span className="text-text-muted">—</span>}</td>
                      <td className={TD}>{r.docUrls.length ? r.docUrls.map((u, j) => <a key={j} href={u} target="_blank" rel="noopener noreferrer" className="text-copper hover:underline mr-2">#{j + 1}</a>) : <span className="text-text-muted">—</span>}</td>
                      <td className={`${TD} text-right`}>
                        <div className="inline-flex items-center gap-3">
                          <button onClick={() => downloadGrn(r)} className="text-copper hover:text-copper-light text-xs font-medium">Word</button>
                          <button onClick={() => del(r)} disabled={deleting !== null} className="text-red-600 hover:text-red-700 text-xs font-medium disabled:opacity-40">
                            {deleting === (r.recordId || `${r.po} ${r.partNumber} ${r.timestamp}`) ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {singleActive && <GoodsInForm task={singleActive.task} record={singleActive.record ?? undefined} onClose={() => setSingleActive(null)} />}
      {poActive && <GoodsInPoForm task={poActive} onClose={() => setPoActive(null)} />}
    </div>
  );
}
