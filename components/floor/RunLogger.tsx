"use client";

import { useEffect, useState } from "react";
import { efficiency } from "@/lib/floor/metrics";

interface Ref { id: number; name: string; }
interface SkuOption { sku: string; desc: string; }
interface Run {
  id: number; shift: string; machineId: number; operatorId: number;
  productSku: string; productDesc: string; plannedQty: number | null; actualQty: number | null;
  downtimeMin: number | null; void: boolean;
}
const EMPTY = {
  shift: "1", machineId: "", operatorId: "", productSku: "", productDesc: "",
  plannedQty: "", actualQty: "", startTime: "", endTime: "", downtimeMin: "", comments: "",
};

export default function RunLogger({ date }: { date: string }) {
  const [machines, setMachines] = useState<Ref[]>([]);
  const [operators, setOperators] = useState<Ref[]>([]);
  const [skus, setSkus] = useState<SkuOption[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function loadRuns() {
    const r = await fetch(`/api/floor/runs?date=${date}`).then((x) => x.json());
    setRuns(r.runs);
  }
  useEffect(() => {
    (async () => {
      const cat = await fetch("/api/floor/catalog").then((x) => x.json());
      setMachines(cat.machines); setOperators(cat.operators); setSkus(cat.skus);
      await loadRuns();
    })();
  }, [date]);

  function set<K extends keyof typeof EMPTY>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit() {
    setSaving(true); setErrors([]);
    const desc = skus.find((s) => s.sku === form.productSku)?.desc ?? form.productDesc;
    const body = { date, ...form, productDesc: desc };
    const res = editId
      ? await fetch(`/api/floor/runs/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/floor/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) { setForm(EMPTY); setEditId(null); await loadRuns(); }
    else { const j = await res.json().catch(() => ({})); setErrors(j.errors ?? [j.error ?? "Save failed."]); }
  }

  function edit(r: Run) {
    setEditId(r.id);
    setForm({
      shift: r.shift, machineId: String(r.machineId), operatorId: String(r.operatorId),
      productSku: r.productSku, productDesc: r.productDesc,
      plannedQty: r.plannedQty?.toString() ?? "", actualQty: r.actualQty?.toString() ?? "",
      startTime: "", endTime: "", downtimeMin: r.downtimeMin?.toString() ?? "", comments: "",
    });
  }

  async function voidRun(id: number) {
    const reason = prompt("Reason for voiding this run?");
    if (!reason) return;
    const res = await fetch(`/api/floor/runs/${id}/void`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
    if (res.ok) await loadRuns();
  }

  const nameOf = (list: Ref[], id: number) => list.find((x) => x.id === id)?.name ?? `#${id}`;

  return (
    <div className="min-h-full p-5 max-w-md mx-auto space-y-4">
      <h1 className="font-serif text-2xl text-charcoal">Runs · {date}</h1>

      <div className="rounded-2xl bg-white border border-[#e4ddd4] p-4 space-y-3">
        <h2 className="font-medium text-charcoal">{editId ? "Edit run" : "New run"}</h2>
        {errors.length > 0 && <ul className="text-sm text-red-600 list-disc pl-5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
        <div className="grid grid-cols-2 gap-2">
          <select value={form.shift} onChange={(e) => set("shift", e.target.value)} className="rounded-lg border border-[#e4ddd4] px-3 py-2">
            <option value="1">Shift 1</option><option value="2">Shift 2</option>
          </select>
          <select value={form.machineId} onChange={(e) => set("machineId", e.target.value)} className="rounded-lg border border-[#e4ddd4] px-3 py-2">
            <option value="">Machine…</option>{machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select value={form.operatorId} onChange={(e) => set("operatorId", e.target.value)} className="rounded-lg border border-[#e4ddd4] px-3 py-2">
            <option value="">Operator…</option>{operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <select value={form.productSku} onChange={(e) => set("productSku", e.target.value)} className="rounded-lg border border-[#e4ddd4] px-3 py-2">
            <option value="">Product…</option>{skus.map((s) => <option key={s.sku} value={s.sku}>{s.desc}</option>)}
          </select>
          <input inputMode="numeric" placeholder="Planned" value={form.plannedQty} onChange={(e) => set("plannedQty", e.target.value)} className="rounded-lg border border-[#e4ddd4] px-3 py-2" />
          <input inputMode="numeric" placeholder="Actual" value={form.actualQty} onChange={(e) => set("actualQty", e.target.value)} className="rounded-lg border border-[#e4ddd4] px-3 py-2" />
          <input type="datetime-local" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} className="rounded-lg border border-[#e4ddd4] px-3 py-2" />
          <input type="datetime-local" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} className="rounded-lg border border-[#e4ddd4] px-3 py-2" />
          <input inputMode="numeric" placeholder="Downtime (min)" value={form.downtimeMin} onChange={(e) => set("downtimeMin", e.target.value)} className="rounded-lg border border-[#e4ddd4] px-3 py-2 col-span-2" />
          <input placeholder="Comments" value={form.comments} onChange={(e) => set("comments", e.target.value)} className="rounded-lg border border-[#e4ddd4] px-3 py-2 col-span-2" />
        </div>
        <button onClick={submit} disabled={saving} className="w-full rounded-xl bg-copper text-white py-3 font-medium disabled:opacity-50">
          {saving ? "Saving…" : editId ? "Save changes" : "Add run"}
        </button>
        {editId && <button onClick={() => { setEditId(null); setForm(EMPTY); }} className="w-full text-sm text-text-muted">Cancel edit</button>}
      </div>

      <div className="space-y-2">
        {runs.map((r) => {
          const eff = efficiency(r.actualQty, r.plannedQty);
          return (
            <div key={r.id} className={`rounded-xl border p-3 ${r.void ? "opacity-50 border-[#e4ddd4]" : "bg-white border-[#e4ddd4]"}`}>
              <div className="flex justify-between">
                <span className="text-charcoal">{r.productDesc}</span>
                <span className="text-sm text-text-muted">{eff != null ? `${Math.round(eff * 100)}%` : "—"}</span>
              </div>
              <p className="text-sm text-text-muted">
                {nameOf(machines, r.machineId)} · {nameOf(operators, r.operatorId)} · {r.actualQty ?? 0}/{r.plannedQty ?? 0}
                {r.void && " · VOID"}
              </p>
              {!r.void && (
                <div className="flex gap-3 mt-1 text-sm">
                  <button onClick={() => edit(r)} className="text-copper">Edit</button>
                  <button onClick={() => voidRun(r.id)} className="text-red-600">Void</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
