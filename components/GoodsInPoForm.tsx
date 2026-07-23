"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { GoodsInPoTask, GoodsInLine } from "@/lib/goods-in";

const inputCls = "w-full rounded-lg border border-[#e4ddd4] px-2 py-1.5 text-sm text-charcoal focus:outline-none focus:border-copper bg-white";
const labelCls = "block text-[11px] tracking-widest uppercase text-text-muted mb-1";
const TH = "px-2 py-2 text-[10px] tracking-widest uppercase text-text-muted font-medium text-left whitespace-nowrap";

type RowState = { received: boolean; supplierProductCode: string; batchLot: string; bbd: string };

export default function GoodsInPoForm({ task, onClose }: { task: GoodsInPoTask; onClose: () => void }) {
  const router = useRouter();
  const [rows, setRows] = useState<RowState[]>(
    task.lines.map(l => ({
      received: !!l.record,
      supplierProductCode: l.record?.supplierProductCode ?? "",
      batchLot: l.record?.batchLot ?? "",
      bbd: l.record?.bbd ?? "",
    })),
  );
  const [password, setPassword] = useState("");
  const coaRef = useRef<HTMLInputElement>(null);
  const docsRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"save" | "doc" | null>(null);
  const [saved, setSaved] = useState<{ warnings: string[]; count: number } | null>(null);
  const [error, setError] = useState("");

  const setRow = (i: number, patch: Partial<RowState>) =>
    setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const allReceived = rows.every(r => r.received);
  const toggleAll = () => setRows(rs => rs.map(r => ({ ...r, received: !allReceived })));

  const receivedLinePayload = () =>
    task.lines
      .map((l, i) => ({ l, r: rows[i] }))
      .filter(({ r }) => r.received)
      .map(({ l, r }) => ({
        partNumber: l.partNumber, description: l.description,
        quantity: l.quantity != null ? String(l.quantity) : "", supplier: task.supplier,
        supplierProductCode: r.supplierProductCode, batchLot: r.batchLot, bbd: r.bbd,
        existing: !!l.record, recordId: l.record?.recordId ?? "", timestamp: l.record?.timestamp ?? "",
      }));

  async function downloadDoc() {
    const lines = receivedLinePayload();
    const res = await fetch("/api/goods-in/doc/po", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ po: task.po, supplier: task.supplier, lines }),
    });
    if (!res.ok) throw new Error("Failed to generate the Word form");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `GoodsIn-${task.po}-all.docx`; a.click();
    URL.revokeObjectURL(url);
  }

  async function preview() {
    setBusy("doc"); setError("");
    try {
      if (receivedLinePayload().length === 0) { setError("Tick at least one received line first."); return; }
      await downloadDoc();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  }

  async function save() {
    setBusy("save"); setError("");
    try {
      const lines = receivedLinePayload();
      if (lines.length === 0) { setError("Tick at least one received line."); return; }
      const fd = new FormData();
      fd.append("po", task.po);
      fd.append("supplier", task.supplier);
      fd.append("password", password);
      fd.append("lines", JSON.stringify(lines));
      const coa = coaRef.current?.files?.[0];
      if (coa) fd.append("coa", coa);
      for (const d of Array.from(docsRef.current?.files ?? [])) fd.append("docs", d);

      const res = await fetch("/api/goods-in/po", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save."); return; }
      try { await downloadDoc(); } catch { /* saved; can re-download from the list */ }
      setSaved({ warnings: Array.isArray(data.warnings) ? data.warnings : [], count: lines.length });
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:p-8" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-2xl bg-cream border border-[#e4ddd4] shadow-xl my-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-[#e4ddd4]">
          <div>
            <h2 className="font-serif text-xl text-charcoal">Goods In — PO {task.po}</h2>
            <p className="text-xs text-text-muted mt-1">{task.supplier || "—"} · {task.totalCount} items. Tick each product received and record Supplier Code, Batch/Lot &amp; BBD.</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-charcoal text-xl leading-none">&times;</button>
        </div>

        {saved ? (
          <div className="px-6 py-8 text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center text-2xl">✓</div>
            <p className="font-serif text-lg text-charcoal">{saved.count} product{saved.count === 1 ? "" : "s"} filed &amp; form downloaded</p>
            <p className="text-sm text-text-muted mt-2 max-w-md mx-auto">The combined QA13-CF01 Word file is in your downloads. Filed lines appear under <strong className="text-charcoal">Filed Goods In forms</strong>; unticked lines stay in the awaiting list.</p>
            {saved.warnings.length > 0 && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-4">{saved.warnings.join(" ")}</p>}
            <div className="mt-6"><button onClick={onClose} className="bg-copper text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-copper-light transition-colors">Done</button></div>
          </div>
        ) : (
          <>
            <div className="px-6 py-4">
              <div className="flex justify-end mb-2">
                <button type="button" onClick={toggleAll} className="text-xs px-3 py-1.5 rounded-full border border-[#e4ddd4] text-text-muted hover:bg-cream">
                  {allReceived ? "Untick all" : "Select all received"}
                </button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-[#e4ddd4] bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-cream border-b border-[#e4ddd4]">
                    <tr>
                      <th className={TH}>Recv</th><th className={TH}>Part</th><th className={TH}>Description</th>
                      <th className={`${TH} text-right`}>Qty</th><th className={TH}>Supplier Code</th><th className={TH}>Batch/Lot</th><th className={TH}>BBD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {task.lines.map((l: GoodsInLine, i) => (
                      <tr key={l.partNumber + i} className="border-b border-[#e4ddd4]/60">
                        <td className="px-2 py-1.5 text-center">
                          <input type="checkbox" checked={rows[i].received} onChange={e => setRow(i, { received: e.target.checked })} />
                        </td>
                        <td className="px-2 py-1.5 font-mono text-xs">{l.partNumber}</td>
                        <td className="px-2 py-1.5 text-charcoal max-w-[220px] truncate" title={l.description}>{l.description}</td>
                        <td className="px-2 py-1.5 text-right">{l.quantity != null ? l.quantity.toLocaleString() : "—"}</td>
                        <td className="px-2 py-1.5"><input className={inputCls} value={rows[i].supplierProductCode} onChange={e => setRow(i, { supplierProductCode: e.target.value })} /></td>
                        <td className="px-2 py-1.5"><input className={inputCls} value={rows[i].batchLot}
                          onChange={e => setRow(i, { batchLot: e.target.value, received: e.target.value.trim() ? true : rows[i].received })} placeholder="LOT-…" /></td>
                        <td className="px-2 py-1.5"><input className={inputCls} value={rows[i].bbd} onChange={e => setRow(i, { bbd: e.target.value })} placeholder="DD/MM/YYYY" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                <div><label className={labelCls}>Attach CofA (whole delivery)</label>
                  <input ref={coaRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" className="w-full text-xs text-text-muted file:mr-3 file:rounded-full file:border-0 file:bg-cream-dark file:px-3 file:py-1.5 file:text-charcoal" /></div>
                <div><label className={labelCls}>Other documents</label>
                  <input ref={docsRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" className="w-full text-xs text-text-muted file:mr-3 file:rounded-full file:border-0 file:bg-cream-dark file:px-3 file:py-1.5 file:text-charcoal" /></div>
              </div>
              <div className="mt-4 max-w-xs"><label className={labelCls}>Password</label>
                <input type="password" className={inputCls} value={password} onChange={e => setPassword(e.target.value)} placeholder="Goods In / compliance password" /></div>

              {error && <div className="rounded-xl px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200 mt-4">{error}</div>}
            </div>

            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[#e4ddd4]">
              <button onClick={preview} disabled={busy !== null} className="inline-flex items-center gap-1.5 text-sm font-medium text-copper hover:text-copper-light disabled:opacity-50">
                {busy === "doc" ? "Generating…" : "Preview Word form"}
              </button>
              <button onClick={save} disabled={busy !== null} className="bg-copper text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-copper-light transition-colors disabled:opacity-50">
                {busy === "save" ? "Saving…" : "Save & download form"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
