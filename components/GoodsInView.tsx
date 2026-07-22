"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { GoodsInTask, GoodsInRecord, Urgency, PartCategory } from "@/lib/goods-in";
import { summarise, partCategory, PART_CATEGORY_CHIPS } from "@/lib/goods-in";
import CountUp from "./CountUp";
import GoodsInForm from "./GoodsInForm";

const URGENCY: Record<Urgency, { label: string; cls: string }> = {
  overdue: { label: "Overdue", cls: "bg-red-100 text-red-700" },
  today: { label: "Due today", cls: "bg-amber-100 text-amber-700" },
  soon: { label: "This week", cls: "bg-[#fdf3ee] text-copper" },
  later: { label: "Upcoming", cls: "bg-cream-dark text-text-muted" },
  none: { label: "No date", cls: "bg-cream-dark text-text-muted" },
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
      {PART_CATEGORY_CHIPS.map(c => (
        <button key={c.key} type="button" onClick={() => onChange(c.key)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${value === c.key ? "bg-charcoal text-white border-charcoal" : "border-[#e4ddd4] text-text-muted hover:bg-cream"}`}>
          {c.label}
        </button>
      ))}
    </div>
  );
}

async function downloadGrn(rec: GoodsInRecord) {
  const res = await fetch("/api/goods-in/doc", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rec),
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `GoodsIn-${rec.po}-${rec.partNumber}.docx`; a.click();
  URL.revokeObjectURL(url);
}

export default function GoodsInView({ tasks, records }: { tasks: GoodsInTask[]; records: GoodsInRecord[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "awaiting" | "booked_in">("awaiting");
  const [active, setActive] = useState<GoodsInTask | null>(null);
  const [tasksPart, setTasksPart] = useState<PartCategory | "all">("all");
  const [recordsPart, setRecordsPart] = useState<PartCategory | "all">("all");
  const [activeRecord, setActiveRecord] = useState<GoodsInRecord | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const s = summarise(tasks);

  const shown = useMemo(
    () => tasks.filter(t => (filter === "all" || t.status === filter) && (tasksPart === "all" || partCategory(t.partNumber) === tasksPart)),
    [tasks, filter, tasksPart],
  );
  const shownRecords = useMemo(
    () => records.filter(r => recordsPart === "all" || partCategory(r.partNumber) === recordsPart),
    [records, recordsPart],
  );

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
    } catch {
      window.alert("Network error — please try again.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Kpi label="Awaiting" value={s.awaiting} color="text-copper" sub="G-In form to file" />
        <Kpi label="Due Today" value={s.dueToday} color={s.dueToday > 0 ? "text-amber-600" : undefined} />
        <Kpi label="Overdue" value={s.overdue} color={s.overdue > 0 ? "text-red-600" : undefined} />
        <Kpi label="Filed" value={s.bookedIn} color="text-emerald-600" sub="G-In forms done" />
      </div>

      {/* Today's tasks */}
      <div className="mb-3 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-serif text-lg font-medium text-charcoal">Goods In tasks</h2>
          <div className="flex gap-1.5">
            {(["awaiting", "booked_in", "all"] as const).map(f => (
              <button key={f} type="button" onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === f ? "bg-copper text-white border-copper" : "border-[#e4ddd4] text-text-muted hover:bg-cream"}`}>
                {f === "awaiting" ? "Awaiting" : f === "booked_in" ? "Filed" : "All"}
              </button>
            ))}
          </div>
        </div>
        <PartChips value={tasksPart} onChange={setTasksPart} />
      </div>

      <div className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden mb-10">
        {shown.length === 0 ? (
          <p className="px-5 py-12 text-center text-text-muted text-sm">
            {tasks.length === 0 ? "No open purchase orders." : "Nothing matches this filter."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream border-b border-[#e4ddd4]">
                <tr>
                  <th className={TH}>PO</th>
                  <th className={TH}>Part</th>
                  <th className={TH}>Description</th>
                  <th className={TH}>Supplier</th>
                  <th className={`${TH} text-right`}>Qty</th>
                  <th className={TH}>Due</th>
                  <th className={`${TH} text-right`}></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((t, i) => {
                  const u = URGENCY[t.urgency];
                  return (
                    <tr key={t.po + t.partNumber + i} className="border-b border-[#e4ddd4]/60 hover:bg-cream transition-colors">
                      <td className={`${TD} font-mono text-xs text-copper`}>{t.po}</td>
                      <td className={`${TD} font-mono text-xs`}>{t.partNumber}</td>
                      <td className="px-4 py-3 text-charcoal max-w-[240px] truncate" title={t.description}>{t.description}</td>
                      <td className="px-4 py-3 text-text-muted max-w-[160px] truncate" title={t.supplier}>{t.supplier || "—"}</td>
                      <td className={`${TD} text-right`}>{t.quantity != null ? t.quantity.toLocaleString() : "—"}</td>
                      <td className={TD}>
                        <span className="text-charcoal">{t.dueDate || "—"}</span>
                        {t.status === "awaiting" && <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${u.cls}`}>{u.label}</span>}
                      </td>
                      <td className={`${TD} text-right`}>
                        {t.status === "booked_in" ? (
                          <button onClick={() => { setActiveRecord(records.find(r => r.po === t.po && r.partNumber === t.partNumber) ?? null); setActive(t); }}
                            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-0.5 text-[10px] font-medium hover:bg-emerald-200 transition-colors">
                            Filed &middot; reopen
                          </button>
                        ) : (
                          <button onClick={() => { setActiveRecord(null); setActive(t); }}
                            className="rounded-lg bg-copper text-white px-3 py-1.5 text-xs font-medium hover:bg-copper-light transition-colors">
                            G-In form &rarr;
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Filed records */}
      <div className="mb-3 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-lg font-medium text-charcoal">Filed Goods In forms</h2>
          <p className="text-text-muted text-xs mt-0.5">Batch &amp; BBD captured for warehouse verification. Download the Word form to complete the QA checklist.</p>
        </div>
        <PartChips value={recordsPart} onChange={setRecordsPart} />
      </div>
      <div className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden">
        {shownRecords.length === 0 ? (
          <p className="px-5 py-12 text-center text-text-muted text-sm">
            {records.length === 0 ? "No forms filed yet. Open a G-In form above and save it to create one." : "No filed forms match this filter."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream border-b border-[#e4ddd4]">
                <tr>
                  <th className={TH}>Date</th>
                  <th className={TH}>PO</th>
                  <th className={TH}>Part</th>
                  <th className={TH}>Batch/Lot</th>
                  <th className={TH}>BBD</th>
                  <th className={TH}>Supplier Code</th>
                  <th className={TH}>CofA</th>
                  <th className={TH}>Docs</th>
                  <th className={`${TH} text-right`}>Form</th>
                </tr>
              </thead>
              <tbody>
                {shownRecords.map((r, i) => (
                  <tr key={r.po + r.timestamp + i} className="border-b border-[#e4ddd4]/60 hover:bg-cream transition-colors">
                    <td className={`${TD} text-text-muted`}>{r.date || (r.timestamp ? r.timestamp.slice(0, 10) : "—")}</td>
                    <td className={`${TD} font-mono text-xs text-copper`}>{r.po}</td>
                    <td className={`${TD} font-mono text-xs`}>{r.partNumber}</td>
                    <td className={`${TD} font-mono text-xs`}>{r.batchLot || "—"}</td>
                    <td className={TD}>{r.bbd || "—"}</td>
                    <td className={`${TD} font-mono text-xs`}>{r.supplierProductCode || "—"}</td>
                    <td className={TD}>
                      {r.coaUrl ? <a href={r.coaUrl} target="_blank" rel="noopener noreferrer" className="text-copper hover:underline">CofA ↗</a> : <span className="text-text-muted">—</span>}
                    </td>
                    <td className={TD}>
                      {r.docUrls.length ? r.docUrls.map((u, j) => <a key={j} href={u} target="_blank" rel="noopener noreferrer" className="text-copper hover:underline mr-2">#{j + 1}</a>) : <span className="text-text-muted">—</span>}
                    </td>
                    <td className={`${TD} text-right`}>
                      <div className="inline-flex items-center gap-3">
                        <button onClick={() => downloadGrn(r)} className="text-copper hover:text-copper-light text-xs font-medium inline-flex items-center gap-1">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                          Word
                        </button>
                        <button onClick={() => del(r)} disabled={deleting !== null}
                          className="text-red-600 hover:text-red-700 text-xs font-medium disabled:opacity-40">
                          {deleting === (r.recordId || `${r.po} ${r.partNumber} ${r.timestamp}`) ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {active && <GoodsInForm task={active} record={activeRecord ?? undefined} onClose={() => { setActive(null); setActiveRecord(null); }} />}
    </div>
  );
}
