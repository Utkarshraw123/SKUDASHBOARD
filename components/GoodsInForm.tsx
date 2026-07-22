"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { GoodsInTask, GoodsInRecord } from "@/lib/goods-in";

const inputCls = "w-full rounded-lg border border-[#e4ddd4] px-3 py-2 text-sm text-charcoal focus:outline-none focus:border-copper bg-white";
const labelCls = "block text-[11px] tracking-widest uppercase text-text-muted mb-1";

export default function GoodsInForm({ task, record, onClose }: { task: GoodsInTask; record?: GoodsInRecord; onClose: () => void }) {
  const router = useRouter();

  // The three fields compliance fills. Everything else on the form is left blank
  // for the warehouse to complete by hand on the downloaded Word document.
  const isEdit = !!record;
  const [supplierProductCode, setSupplierProductCode] = useState(record?.supplierProductCode ?? "");
  const [batchLot, setBatchLot] = useState(record?.batchLot ?? "");
  const [bbd, setBbd] = useState(record?.bbd ?? "");
  const [password, setPassword] = useState("");

  const coaRef = useRef<HTMLInputElement>(null);
  const docsRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState<"save" | "doc" | null>(null);
  const [saved, setSaved] = useState<{ warnings: string[] } | null>(null);
  const [error, setError] = useState("");

  function fields() {
    return {
      po: task.po, partNumber: task.partNumber, description: task.description,
      quantity: task.quantity != null ? String(task.quantity) : "", supplier: task.supplier,
      supplierProductCode, batchLot, bbd,
      ...(isEdit ? {
        editMode: "1",
        recordId: record!.recordId,
        timestamp: record!.timestamp,
        coaUrlExisting: record!.coaUrl,
        docUrlsExisting: record!.docUrls.join(" | "),
      } : {}),
    };
  }

  async function downloadDoc() {
    const res = await fetch("/api/goods-in/doc", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields()),
    });
    if (!res.ok) throw new Error("Failed to generate the Word form");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `GoodsIn-${task.po}-${task.partNumber}.docx`; a.click();
    URL.revokeObjectURL(url);
  }

  async function preview() {
    setBusy("doc"); setError("");
    try { await downloadDoc(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  }

  async function saveAndDownload() {
    setBusy("save"); setError("");
    try {
      const fd = new FormData();
      Object.entries(fields()).forEach(([k, v]) => fd.append(k, v));
      fd.append("password", password);
      const coa = coaRef.current?.files?.[0];
      if (coa) fd.append("coa", coa);
      for (const d of Array.from(docsRef.current?.files ?? [])) fd.append("docs", d);

      const res = await fetch("/api/goods-in", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save."); return; }

      try { await downloadDoc(); } catch { /* record saved; user can download from the list */ }
      setSaved({ warnings: Array.isArray(data.warnings) ? data.warnings : [] });
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:p-8" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl bg-cream border border-[#e4ddd4] shadow-xl my-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-[#e4ddd4]">
          <div>
            <h2 className="font-serif text-xl text-charcoal">{isEdit ? "Edit" : "G-In form"} &mdash; QA13-CF01</h2>
            <p className="text-xs text-text-muted mt-1">Record supplier code, batch/lot &amp; BBD, then download the Word form for the warehouse.</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-charcoal text-xl leading-none">&times;</button>
        </div>

        {saved ? (
          // ---- success ----
          <div className="px-6 py-8 text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center text-2xl">✓</div>
            <p className="font-serif text-lg text-charcoal">G-In form {isEdit ? "updated" : "filed"} &amp; downloaded</p>
            <p className="text-sm text-text-muted mt-2 max-w-sm mx-auto">
              The QA13-CF01 Word file is in your downloads &mdash; send it to the warehouse to complete the checks by hand.
              It&rsquo;s also saved under <strong className="text-charcoal">Filed Goods In forms</strong> below, where you can download it again anytime.
            </p>
            {saved.warnings.length > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-4">{saved.warnings.join(" ")}</p>
            )}
            <div className="mt-6 flex items-center justify-center gap-3">
              <button onClick={preview} disabled={busy !== null} className="text-sm font-medium text-copper hover:text-copper-light disabled:opacity-50">Download again</button>
              <button onClick={onClose} className="bg-copper text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-copper-light transition-colors">Done</button>
            </div>
          </div>
        ) : (
          <>
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

              {/* The three compliance fields */}
              <div>
                <p className="text-[10px] tracking-widest uppercase text-text-muted mb-3">Compliance to complete</p>
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>Supplier Product Code</label>
                    <input className={inputCls} value={supplierProductCode} onChange={e => setSupplierProductCode(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Batch / Lot No.</label>
                      <input className={inputCls} value={batchLot} onChange={e => setBatchLot(e.target.value)} placeholder="e.g. LOT-88231" />
                    </div>
                    <div>
                      <label className={labelCls}>BBD</label>
                      <input className={inputCls} value={bbd} onChange={e => setBbd(e.target.value)} placeholder="DD/MM/YYYY" />
                    </div>
                  </div>
                </div>
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

              {error && <div className="rounded-xl px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200">{error}</div>}
            </div>

            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[#e4ddd4]">
              <button onClick={preview} disabled={busy !== null}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-copper hover:text-copper-light disabled:opacity-50">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                {busy === "doc" ? "Generating…" : "Preview Word form"}
              </button>
              <button onClick={saveAndDownload} disabled={busy !== null}
                className="bg-copper text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-copper-light transition-colors disabled:opacity-50">
                {busy === "save" ? "Saving…" : "Save & download form"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
