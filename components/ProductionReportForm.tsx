"use client";

import { useState, useMemo } from "react";
import { PRODUCT_TYPES } from "@/lib/production-report";

export interface WorkOrderOption {
  workOrder: string;
  sku: string;
  description: string;
  productBatch: string;
  productBBD: string;
  bulkCode: string;
  bulkDescription: string;
}

type AncKey = "jars" | "lids" | "labels" | "box" | "pouches" | "desiccants";
const ANC_PARTS: { key: AncKey; label: string }[] = [
  { key: "jars", label: "Jars" },
  { key: "lids", label: "Lids" },
  { key: "labels", label: "Labels" },
  { key: "box", label: "Box" },
  { key: "pouches", label: "Pouches" },
  { key: "desiccants", label: "Desiccants" },
];

interface BatchRow { batch: string; bbd: string }
interface BulkRow {
  bulkCode: string;
  bulkDescription: string;
  bulkBatch: string;
  bulkBBD: string;
  used: string;
  wasteCapsules: string;
}

const emptyBulk = (): BulkRow => ({ bulkCode: "", bulkDescription: "", bulkBatch: "", bulkBBD: "", used: "", wasteCapsules: "" });

const inputCls =
  "w-full rounded-xl border border-[#e4ddd4] bg-white px-3.5 py-2.5 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-copper/30 focus:border-copper transition-all";
const labelCls = "block text-[10px] tracking-widest uppercase text-text-muted mb-1.5";
const addBtnCls =
  "text-xs font-medium text-copper hover:text-copper-light transition-colors inline-flex items-center gap-1";
const removeBtnCls =
  "text-[11px] text-text-muted hover:text-red-600 transition-colors";

export default function ProductionReportForm({ options }: { options: WorkOrderOption[] }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState("");

  const [woQuery, setWoQuery] = useState("");
  const [selected, setSelected] = useState<WorkOrderOption | null>(null);

  // editable pre-filled fields
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const [productType, setProductType] = useState("");

  // repeatable groups
  const [batches, setBatches] = useState<BatchRow[]>([{ batch: "", bbd: "" }]);
  const [bulks, setBulks] = useState<BulkRow[]>([emptyBulk()]);

  // manual report-level fields
  const [made, setMade] = useState("");
  const [people, setPeople] = useState("");
  const [woStatus, setWoStatus] = useState("complete");
  const [anc, setAnc] = useState<Record<AncKey, string>>({
    jars: "", lids: "", labels: "", box: "", pouches: "", desiccants: "",
  });
  const [disposalNumber, setDisposalNumber] = useState("");
  const [comments, setComments] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string; blended?: number; rows?: number } | null>(null);

  const matches = useMemo(() => {
    const q = woQuery.trim().toLowerCase();
    if (!q) return options.slice(0, 8);
    return options
      .filter(o => o.workOrder.toLowerCase().includes(q) || o.sku.toLowerCase().includes(q) || o.description.toLowerCase().includes(q))
      .slice(0, 8);
  }, [woQuery, options]);

  function resetVariableFields() {
    setBatches([{ batch: "", bbd: "" }]);
    setBulks([emptyBulk()]);
    setMade(""); setPeople(""); setWoStatus("complete");
    setAnc({ jars: "", lids: "", labels: "", box: "", pouches: "", desiccants: "" });
    setDisposalNumber(""); setComments("");
    setProductType("");
  }

  function selectWO(o: WorkOrderOption) {
    setSelected(o);
    setWoQuery(o.workOrder);
    setDescription(o.description);
    setSku(o.sku);
    setBatches([{ batch: o.productBatch, bbd: o.productBBD }]);
    setBulks([{ ...emptyBulk(), bulkCode: o.bulkCode, bulkDescription: o.bulkDescription }]);
  }

  // batch helpers
  const addBatch = () => setBatches(b => [...b, { batch: "", bbd: "" }]);
  const removeBatch = (i: number) => setBatches(b => (b.length > 1 ? b.filter((_, idx) => idx !== i) : b));
  const setBatch = (i: number, patch: Partial<BatchRow>) =>
    setBatches(b => b.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  // bulk helpers
  const addBulk = () => setBulks(b => [...b, emptyBulk()]);
  const removeBulk = (i: number) => setBulks(b => (b.length > 1 ? b.filter((_, idx) => idx !== i) : b));
  const setBulk = (i: number, patch: Partial<BulkRow>) =>
    setBulks(b => b.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  function checkPassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw === "12345") { setUnlocked(true); setPwError(""); }
    else setPwError("Incorrect password");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) { setResult({ ok: false, msg: "Please select a work order first." }); return; }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/production-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: pw,
          workOrder: selected.workOrder,
          sku, description, productType,
          batches,
          bulks,
          made, people, woStatus,
          ancWaste: anc,
          disposalNumber, comments,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setResult({ ok: false, msg: data.error || "Failed to save." }); }
      else {
        setResult({ ok: true, msg: "Report saved to the production sheet.", blended: data.wastage?.blendedPct, rows: data.rowsWritten });
        resetVariableFields();
        setSelected(null); setWoQuery("");
      }
    } catch {
      setResult({ ok: false, msg: "Network error — please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (!unlocked) {
    return (
      <form onSubmit={checkPassword} className="bg-white rounded-2xl border border-[#e4ddd4] p-6 max-w-sm">
        <label className={labelCls}>Enter password to continue</label>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} className={inputCls} autoFocus />
        {pwError && <p className="text-red-600 text-xs mt-2">{pwError}</p>}
        <button type="submit" className="mt-4 w-full bg-copper text-white rounded-xl py-2.5 text-sm font-medium hover:bg-copper-light transition-colors">
          Unlock
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Work order selector */}
      <div className="bg-white rounded-2xl border border-[#e4ddd4] p-5">
        <label className={labelCls}>Work Order</label>
        <input
          type="text"
          value={woQuery}
          onChange={e => { setWoQuery(e.target.value); setSelected(null); }}
          placeholder="Search by WO number, SKU or description…"
          className={inputCls}
          autoComplete="off"
        />
        {!selected && woQuery && (
          <div className="mt-2 border border-[#e4ddd4] rounded-xl overflow-hidden divide-y divide-[#e4ddd4]/60">
            {matches.length === 0 ? (
              <p className="px-3.5 py-3 text-xs text-text-muted">No matching work orders.</p>
            ) : matches.map(o => (
              <button type="button" key={o.workOrder} onClick={() => selectWO(o)}
                className="w-full text-left px-3.5 py-2.5 hover:bg-cream transition-colors">
                <span className="font-mono text-xs text-copper">{o.workOrder}</span>
                <span className="text-charcoal text-sm ml-2">{o.sku}</span>
                <span className="text-text-muted text-xs ml-2">{o.description}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <>
          {/* Product details */}
          <div className="bg-white rounded-2xl border border-[#e4ddd4] p-5">
            <p className="text-xs font-medium text-charcoal mb-4">Product details <span className="text-text-muted font-normal">— pre-filled, edit if needed</span></p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={labelCls}>Description</label><input className={inputCls} value={description} onChange={e => setDescription(e.target.value)} /></div>
              <div><label className={labelCls}>SKU</label><input className={inputCls} value={sku} onChange={e => setSku(e.target.value)} /></div>
              <div>
                <label className={labelCls}>Product Type</label>
                <select className={`${inputCls} cursor-pointer`} value={productType} onChange={e => setProductType(e.target.value)}>
                  <option value="">Select type…</option>
                  {PRODUCT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Product batches (repeatable) */}
          <div className="bg-white rounded-2xl border border-[#e4ddd4] p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-medium text-charcoal">Product batches <span className="text-text-muted font-normal">— add a batch for each finished-good batch produced</span></p>
              <button type="button" onClick={addBatch} className={addBtnCls}>+ Add batch</button>
            </div>
            <div className="space-y-3">
              {batches.map((row, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                  <div><label className={labelCls}>Batch {batches.length > 1 ? i + 1 : ""}</label><input className={inputCls} value={row.batch} onChange={e => setBatch(i, { batch: e.target.value })} /></div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1"><label className={labelCls}>BBD</label><input className={inputCls} value={row.bbd} onChange={e => setBatch(i, { bbd: e.target.value })} placeholder="DD/MM/YYYY" /></div>
                    {batches.length > 1 && (
                      <button type="button" onClick={() => removeBatch(i)} className={`${removeBtnCls} pb-2.5`} aria-label="Remove batch">Remove</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bulks (repeatable — each with its own used + capsule waste) */}
          <div className="bg-white rounded-2xl border border-[#e4ddd4] p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-medium text-charcoal">Bulks <span className="text-text-muted font-normal">— Daily Essentials may use several bulks; add one per bulk</span></p>
              <button type="button" onClick={addBulk} className={addBtnCls}>+ Add bulk</button>
            </div>
            <div className="space-y-4">
              {bulks.map((row, i) => (
                <div key={i} className="rounded-xl border border-[#e4ddd4] bg-cream/40 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] tracking-widest uppercase text-text-muted">Bulk {i + 1}{bulks.length > 1 ? ` of ${bulks.length}` : ""}</span>
                    {bulks.length > 1 && (
                      <button type="button" onClick={() => removeBulk(i)} className={removeBtnCls} aria-label="Remove bulk">Remove</button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={labelCls}>Bulk Code</label><input className={inputCls} value={row.bulkCode} onChange={e => setBulk(i, { bulkCode: e.target.value })} /></div>
                    <div><label className={labelCls}>Bulk Description</label><input className={inputCls} value={row.bulkDescription} onChange={e => setBulk(i, { bulkDescription: e.target.value })} /></div>
                    <div><label className={labelCls}>Bulk Batch</label><input className={inputCls} value={row.bulkBatch} onChange={e => setBulk(i, { bulkBatch: e.target.value })} placeholder="Read off the drum" /></div>
                    <div><label className={labelCls}>Bulk BBD</label><input className={inputCls} value={row.bulkBBD} onChange={e => setBulk(i, { bulkBBD: e.target.value })} placeholder="DD/MM/YYYY" /></div>
                    <div><label className={labelCls}>Used (caps)</label><input type="number" className={inputCls} value={row.used} onChange={e => setBulk(i, { used: e.target.value })} /></div>
                    <div><label className={labelCls}>Capsules Wasted</label><input type="number" className={inputCls} value={row.wasteCapsules} onChange={e => setBulk(i, { wasteCapsules: e.target.value })} /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Usage & output */}
          <div className="bg-white rounded-2xl border border-[#e4ddd4] p-5">
            <p className="text-xs font-medium text-charcoal mb-4">Output</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div><label className={labelCls}>Made (units)</label><input type="number" className={inputCls} value={made} onChange={e => setMade(e.target.value)} /></div>
              <div><label className={labelCls}>People</label><input type="number" className={inputCls} value={people} onChange={e => setPeople(e.target.value)} /></div>
              <div>
                <label className={labelCls}>WO Status</label>
                <select className={`${inputCls} cursor-pointer`} value={woStatus} onChange={e => setWoStatus(e.target.value)}>
                  <option value="complete">Complete</option>
                  <option value="partial">Partial</option>
                  <option value="on hold">On Hold</option>
                </select>
              </div>
            </div>
          </div>

          {/* Ancillary waste */}
          <div className="bg-white rounded-2xl border border-[#e4ddd4] p-5">
            <p className="text-xs font-medium text-charcoal mb-4">Ancillary waste <span className="text-text-muted font-normal">— quantity of each part wasted (capsule waste is per bulk, above)</span></p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {ANC_PARTS.map(p => (
                <div key={p.key}>
                  <label className={labelCls}>{p.label}</label>
                  <input type="number" className={inputCls} value={anc[p.key]}
                    onChange={e => setAnc(w => ({ ...w, [p.key]: e.target.value }))} />
                </div>
              ))}
            </div>
          </div>

          {/* Disposal & comments */}
          <div className="bg-white rounded-2xl border border-[#e4ddd4] p-5">
            <p className="text-xs font-medium text-charcoal mb-4">Disposal &amp; comments</p>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className={labelCls}>Disposal Number <span className="text-text-muted normal-case tracking-normal">(ERP reference for the waste disposed)</span></label>
                <input className={inputCls} value={disposalNumber} onChange={e => setDisposalNumber(e.target.value)} placeholder="e.g. DISP-00123" />
              </div>
              <div>
                <label className={labelCls}>Production Comments</label>
                <textarea className={`${inputCls} min-h-[80px] resize-y`} value={comments} onChange={e => setComments(e.target.value)} placeholder="Anything notable about this run…" />
              </div>
            </div>
          </div>

          {result && (
            <div className={`rounded-xl px-4 py-3 text-sm ${result.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {result.msg}
              {result.ok && result.blended !== undefined && <> Blended wastage: <strong>{result.blended}%</strong>{result.rows && result.rows > 1 ? ` (${result.rows} bulk rows written)` : ""}.</>}
            </div>
          )}

          <button type="submit" disabled={submitting}
            className="w-full bg-copper text-white rounded-xl py-3 text-sm font-medium hover:bg-copper-light transition-colors disabled:opacity-50">
            {submitting ? "Saving…" : "Submit Production Report"}
          </button>
        </>
      )}

      {result && !selected && (
        <div className={`rounded-xl px-4 py-3 text-sm ${result.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {result.msg}
          {result.ok && result.blended !== undefined && <> Blended wastage: <strong>{result.blended}%</strong>{result.rows && result.rows > 1 ? ` (${result.rows} bulk rows written)` : ""}.</>}
        </div>
      )}
    </form>
  );
}
