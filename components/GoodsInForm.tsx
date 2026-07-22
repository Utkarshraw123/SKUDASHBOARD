"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { GoodsInTask } from "@/lib/goods-in";

function todayDMY() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
function nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const inputCls = "w-full rounded-lg border border-[#e4ddd4] px-3 py-2 text-sm text-charcoal focus:outline-none focus:border-copper bg-white";
const labelCls = "block text-[11px] tracking-widest uppercase text-text-muted mb-1";

export default function GoodsInForm({ task, onClose }: { task: GoodsInTask; onClose: () => void }) {
  const router = useRouter();

  const [supplierProductCode, setSupplierProductCode] = useState("");
  const [batchLot, setBatchLot] = useState("");
  const [bbd, setBbd] = useState("");
  const [haulier, setHaulier] = useState("");
  const [date, setDate] = useState(todayDMY());
  const [time, setTime] = useState(nowHM());
  const [cofaReceived, setCofaReceived] = useState("");
  const [comments, setComments] = useState("");
  const [password, setPassword] = useState("");

  const coaRef = useRef<HTMLInputElement>(null);
  const docsRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState<"save" | "doc" | null>(null);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  function currentFields() {
    return {
      po: task.po, partNumber: task.partNumber, description: task.description,
      quantity: task.quantity != null ? String(task.quantity) : "", supplier: task.supplier,
      supplierProductCode, batchLot, bbd, haulier, date, time, cofaReceived, comments,
    };
  }

  async function downloadDoc() {
    setBusy("doc"); setResult(null);
    try {
      const res = await fetch("/api/goods-in/doc", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentFields()),
      });
      if (!res.ok) throw new Error("Failed to generate document");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GoodsIn-${task.po}-${task.partNumber}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : "Failed" });
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy("save"); setResult(null);
    try {
      const fd = new FormData();
      const f = currentFields();
      Object.entries(f).forEach(([k, v]) => fd.append(k, v));
      fd.append("password", password);
      const coa = coaRef.current?.files?.[0];
      if (coa) fd.append("coa", coa);
      for (const d of Array.from(docsRef.current?.files ?? [])) fd.append("docs", d);

      const res = await fetch("/api/goods-in", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setResult({ ok: false, msg: data.error || "Failed to save." }); return; }
      const warn = Array.isArray(data.warnings) && data.warnings.length ? ` (${data.warnings.join(" ")})` : "";
      setResult({ ok: true, msg: `Booked in — record saved to Goods In.${warn}` });
      router.refresh();
      setTimeout(onClose, 1400);
    } catch {
      setResult({ ok: false, msg: "Network error — please try again." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:p-8" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-cream border border-[#e4ddd4] shadow-xl my-4" onClick={e => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-[#e4ddd4]">
          <div>
            <h2 className="font-serif text-xl text-charcoal">Goods In &mdash; QA13-CF01</h2>
            <p className="text-xs text-text-muted mt-1">Confirm the delivery, record batch &amp; BBD, then save or generate the Word form.</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-charcoal text-xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Auto-populated from the PO */}
          <div className="rounded-xl bg-white border border-[#e4ddd4] p-4">
            <p className="text-[10px] tracking-widest uppercase text-text-muted mb-3">From purchase order (auto)</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div><span className="text-text-muted">PO </span><span className="font-mono text-copper">{task.po}</span></div>
              <div><span className="text-text-muted">Supplier </span><span className="text-charcoal">{task.supplier || "—"}</span></div>
              <div><span className="text-text-muted">Part </span><span className="font-mono text-charcoal">{task.partNumber}</span></div>
              <div><span className="text-text-muted">Quantity </span><span className="text-charcoal">{task.quantity != null ? task.quantity.toLocaleString() : "—"}</span></div>
              <div className="col-span-2"><span className="text-text-muted">Description </span><span className="text-charcoal">{task.description || "—"}</span></div>
            </div>
          </div>

          {/* Compliance fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Supplier Product Code</label>
              <input className={inputCls} value={supplierProductCode} onChange={e => setSupplierProductCode(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Batch / Lot No.</label>
              <input className={inputCls} value={batchLot} onChange={e => setBatchLot(e.target.value)} placeholder="e.g. LOT-88231" />
            </div>
            <div>
              <label className={labelCls}>BBD</label>
              <input className={inputCls} value={bbd} onChange={e => setBbd(e.target.value)} placeholder="DD/MM/YYYY" />
            </div>
            <div>
              <label className={labelCls}>Haulier</label>
              <input className={inputCls} value={haulier} onChange={e => setHaulier(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Time</label>
              <input className={inputCls} value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelCls}>CofA / CoC received? (inbound)</label>
            <div className="flex gap-2">
              {["Yes", "No"].map(o => (
                <button key={o} type="button" onClick={() => setCofaReceived(o)}
                  className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${cofaReceived === o ? "bg-copper text-white border-copper" : "border-[#e4ddd4] text-text-muted hover:bg-cream-dark"}`}>
                  {o}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Comments / Deviations</label>
            <textarea className={`${inputCls} h-20 resize-none`} value={comments} onChange={e => setComments(e.target.value)} />
          </div>

          {/* Attachments */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Attach CofA</label>
              <input ref={coaRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" className="w-full text-xs text-text-muted file:mr-3 file:rounded-full file:border-0 file:bg-cream-dark file:px-3 file:py-1.5 file:text-charcoal" />
            </div>
            <div>
              <label className={labelCls}>Other documents</label>
              <input ref={docsRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" className="w-full text-xs text-text-muted file:mr-3 file:rounded-full file:border-0 file:bg-cream-dark file:px-3 file:py-1.5 file:text-charcoal" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Password</label>
            <input type="password" className={inputCls} value={password} onChange={e => setPassword(e.target.value)} placeholder="Goods In / compliance password" />
          </div>

          {result && (
            <div className={`rounded-xl px-4 py-3 text-sm ${result.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {result.msg}
            </div>
          )}
        </div>

        {/* actions */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[#e4ddd4]">
          <button onClick={downloadDoc} disabled={busy !== null}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-copper hover:text-copper-light disabled:opacity-50">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            {busy === "doc" ? "Generating…" : "Download Word form"}
          </button>
          <button onClick={save} disabled={busy !== null}
            className="bg-copper text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-copper-light transition-colors disabled:opacity-50">
            {busy === "save" ? "Saving…" : "Save to Goods In"}
          </button>
        </div>
      </div>
    </div>
  );
}
