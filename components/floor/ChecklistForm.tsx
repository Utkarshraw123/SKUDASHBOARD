"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Item { id: number; sortOrder: number; category: string; label: string; critical: boolean; }
interface Check { itemId: number; phase: string; result: "confirm" | "deny"; comment: string | null; }

export default function ChecklistForm({ phase }: { phase: "start" | "end" }) {
  const router = useRouter();
  const date = new Date().toISOString().slice(0, 10);
  const [items, setItems] = useState<Item[]>([]);
  const [checks, setChecks] = useState<Record<number, { result: "confirm" | "deny"; comment: string }>>({});
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/floor/readiness?date=${date}`).then((x) => x.json());
      setItems(r.items);
      const existing: Record<number, { result: "confirm" | "deny"; comment: string }> = {};
      for (const c of r.checks as Check[]) {
        if (c.phase === phase) existing[c.itemId] = { result: c.result, comment: c.comment ?? "" };
      }
      setChecks(existing);
      setDone(phase === "start" ? !!r.day.startCompletedBy : !!r.day.endCompletedBy);
    })();
  }, [date, phase]);

  async function setResult(itemId: number, result: "confirm" | "deny") {
    const comment = checks[itemId]?.comment ?? "";
    setChecks((c) => ({ ...c, [itemId]: { result, comment } }));
    if (result === "deny" && comment.trim() === "") return; // wait for comment before saving
    await save(itemId, result, comment);
  }
  async function setComment(itemId: number, comment: string) {
    const result = checks[itemId]?.result ?? "confirm";
    setChecks((c) => ({ ...c, [itemId]: { result, comment } }));
  }
  async function save(itemId: number, result: "confirm" | "deny", comment: string) {
    const res = await fetch("/api/floor/readiness/check", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, itemId, phase, result, comment }),
    });
    if (!res.ok) setError((await res.json()).error ?? "Save failed.");
  }

  const answered = items.filter((i) => checks[i.id]).length;

  async function complete() {
    setError("");
    // ensure every deny has a saved comment
    for (const i of items) {
      const c = checks[i.id];
      if (c?.result === "deny" && c.comment.trim() === "") { setError(`Add a comment for "${i.label}".`); return; }
      if (c?.result === "deny") await save(i.id, "deny", c.comment);
    }
    const res = await fetch("/api/floor/readiness/complete", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, phase }),
    });
    if (res.ok) { router.push("/floor"); router.refresh(); }
    else setError((await res.json()).error ?? "Could not complete.");
  }

  return (
    <div className="min-h-full p-5 max-w-md mx-auto space-y-4">
      <h1 className="font-serif text-2xl text-charcoal capitalize">{phase}-of-Day checks</h1>
      <p className="text-sm text-text-muted">{answered}/{items.length} answered</p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {items.map((it) => {
        const c = checks[it.id];
        return (
          <div key={it.id} className="rounded-xl bg-white border border-[#e4ddd4] p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <span className="text-charcoal">{it.label}{it.critical && <span className="text-red-500"> *</span>}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setResult(it.id, "confirm")}
                className={`flex-1 rounded-lg py-2 text-sm ${c?.result === "confirm" ? "bg-green-600 text-white" : "border border-[#e4ddd4]"}`}>Confirm</button>
              <button onClick={() => setResult(it.id, "deny")}
                className={`flex-1 rounded-lg py-2 text-sm ${c?.result === "deny" ? "bg-amber-600 text-white" : "border border-[#e4ddd4]"}`}>Deny</button>
            </div>
            {c?.result === "deny" && (
              <input value={c.comment} onChange={(e) => setComment(it.id, e.target.value)}
                onBlur={() => c.comment.trim() && save(it.id, "deny", c.comment)}
                placeholder="Reason (required)" className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm" />
            )}
          </div>
        );
      })}

      <button onClick={complete} disabled={answered !== items.length || done}
        className="w-full rounded-xl bg-copper text-white py-3 font-medium disabled:opacity-50">
        {done ? "Completed ✓" : `Complete ${phase}-of-Day`}
      </button>
    </div>
  );
}
