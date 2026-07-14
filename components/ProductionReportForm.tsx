"use client";

import { useState, useMemo } from "react";

export interface WorkOrderOption {
  workOrder: string;
  sku: string;
  description: string;
  productBatch: string;
  productBBD: string;
  bulkCode: string;
  bulkDescription: string;
}

type WasteKey = "capsules" | "jars" | "lids" | "labels" | "box" | "pouches" | "desiccants";
const WASTE_PARTS: { key: WasteKey; label: string }[] = [
  { key: "capsules", label: "Capsules" },
  { key: "jars", label: "Jars" },
  { key: "lids", label: "Lids" },
  { key: "labels", label: "Labels" },
  { key: "box", label: "Box" },
  { key: "pouches", label: "Pouches" },
  { key: "desiccants", label: "Desiccants" },
];

const inputCls =
  "w-full rounded-xl border border-[#e4ddd4] bg-white px-3.5 py-2.5 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-copper/30 focus:border-copper transition-all";
const labelCls = "block text-[10px] tracking-widest uppercase text-text-muted mb-1.5";

export default function ProductionReportForm({ options }: { options: WorkOrderOption[] }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState("");

  const [woQuery, setWoQuery] = useState("");
  const [selected, setSelected] = useState<WorkOrderOption | null>(null);

  // editable pre-filled fields
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const [productBatch, setProductBatch] = useState("");
  const [productBBD, setProductBBD] = useState("");
  const [bulkCode, setBulkCode] = useState("");
  const [bulkDescription, setBulkDescription] = useState("");

  // manual fields
  const [bulkBatch, setBulkBatch] = useState("");
  const [bulkBBD, setBulkBBD] = useState("");
  const [used, setUsed] = useState("");
  const [made, setMade] = useState("");
  const [people, setPeople] = useState("");
  const [woStatus, setWoStatus] = useState("complete");
  const [waste, setWaste] = useState<Record<WasteKey, string>>({
    capsules: "", jars: "", lids: "", labels: "", box: "", pouches: "", desiccants: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string; blended?: number } | null>(null);

  const matches = useMemo(() => {
    const q = woQuery.trim().toLowerCase();
    if (!q) return options.slice(0, 8);
    return options
      .filter(o => o.workOrder.toLowerCase().includes(q) || o.sku.toLowerCase().includes(q) || o.description.toLowerCase().includes(q))
      .slice(0, 8);
  }, [woQuery, options]);

  function selectWO(o: WorkOrderOption) {
    setSelected(o);
    setWoQuery(o.workOrder);
    setDescription(o.description);
    setSku(o.sku);
    setProductBatch(o.productBatch);
    setProductBBD(o.productBBD);
    setBulkCode(o.bulkCode);
    setBulkDescription(o.bulkDescription);
  }

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
          sku, description, productBatch, productBBD, bulkCode, bulkDescription,
          bulkBatch, bulkBBD,
          used, made, people, woStatus,
          waste,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setResult({ ok: false, msg: data.error || "Failed to save." }); }
      else {
        setResult({ ok: true, msg: "Report saved to the production sheet.", blended: data.wastage?.blendedPct });
        // reset variable fields for next entry
        setUsed(""); setMade(""); setPeople(""); setWoStatus("complete");
        setWaste({ capsules: "", jars: "", lids: "", labels: "", box: "", pouches: "", desiccants: "" });
        setBulkBatch(""); setBulkBBD("");
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
          {/* Pre-filled (editable) */}
          <div className="bg-white rounded-2xl border border-[#e4ddd4] p-5">
            <p className="text-xs font-medium text-charcoal mb-4">Product &amp; Bulk details <span className="text-text-muted font-normal">— pre-filled, edit if needed</span></p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={labelCls}>Description</label><input className={inputCls} value={description} onChange={e => setDescription(e.target.value)} /></div>
              <div><label className={labelCls}>SKU</label><input className={inputCls} value={sku} onChange={e => setSku(e.target.value)} /></div>
              <div><label className={labelCls}>Product Batch</label><input className={inputCls} value={productBatch} onChange={e => setProductBatch(e.target.value)} /></div>
              <div><label className={labelCls}>Product BBD</label><input className={inputCls} value={productBBD} onChange={e => setProductBBD(e.target.value)} /></div>
              <div><label className={labelCls}>Bulk Code</label><input className={inputCls} value={bulkCode} onChange={e => setBulkCode(e.target.value)} /></div>
              <div><label className={labelCls}>Bulk Description</label><input className={inputCls} value={bulkDescription} onChange={e => setBulkDescription(e.target.value)} /></div>
              <div><label className={labelCls}>Bulk Batch</label><input className={inputCls} value={bulkBatch} onChange={e => setBulkBatch(e.target.value)} placeholder="Read off the drum" /></div>
              <div><label className={labelCls}>Bulk BBD</label><input className={inputCls} value={bulkBBD} onChange={e => setBulkBBD(e.target.value)} placeholder="DD/MM/YYYY" /></div>
            </div>
          </div>

          {/* Usage & output */}
          <div className="bg-white rounded-2xl border border-[#e4ddd4] p-5">
            <p className="text-xs font-medium text-charcoal mb-4">Usage &amp; output</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div><label className={labelCls}>Used (bulk caps)</label><input type="number" className={inputCls} value={used} onChange={e => setUsed(e.target.value)} /></div>
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

          {/* Waste */}
          <div className="bg-white rounded-2xl border border-[#e4ddd4] p-5">
            <p className="text-xs font-medium text-charcoal mb-4">Waste <span className="text-text-muted font-normal">— quantity of each part wasted (leave blank / 0 if none)</span></p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {WASTE_PARTS.map(p => (
                <div key={p.key}>
                  <label className={labelCls}>{p.label}</label>
                  <input type="number" className={inputCls} value={waste[p.key]}
                    onChange={e => setWaste(w => ({ ...w, [p.key]: e.target.value }))} />
                </div>
              ))}
            </div>
          </div>

          {result && (
            <div className={`rounded-xl px-4 py-3 text-sm ${result.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {result.msg}{result.ok && result.blended !== undefined && <> Blended wastage: <strong>{result.blended}%</strong>.</>}
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
          {result.msg}{result.ok && result.blended !== undefined && <> Blended wastage: <strong>{result.blended}%</strong>.</>}
        </div>
      )}
    </form>
  );
}
