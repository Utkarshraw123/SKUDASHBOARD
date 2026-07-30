"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Tab = "users" | "operators" | "machines" | "checklist";
type Role = "supervisor" | "manager" | "admin";
interface User { id: number; username: string; name: string; role: Role; active: boolean; }
interface Named { id: number; name: string; active: boolean; }
interface Item { id: number; category: string; label: string; critical: boolean; }

async function jget(url: string) { const r = await fetch(url); return r.ok ? r.json() : null; }
async function jsend(url: string, method: string, body: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

export default function AdminApp() {
  const [tab, setTab] = useState<Tab>("users");
  return (
    <div className="min-h-full p-5 max-w-2xl mx-auto space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-charcoal">Admin</h1>
        <Link href="/floor" className="text-sm text-copper">← Back</Link>
      </header>
      <nav className="flex gap-1 border-b border-[#e4ddd4] text-sm">
        {(["users", "operators", "machines", "checklist"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2 -mb-px border-b-2 capitalize ${tab === t ? "border-copper text-copper" : "border-transparent text-text-muted"}`}>
            {t}
          </button>
        ))}
      </nav>
      {tab === "users" && <UsersPanel />}
      {tab === "operators" && <NamedPanel kind="operators" />}
      {tab === "machines" && <NamedPanel kind="machines" />}
      {tab === "checklist" && <ChecklistPanel />}
    </div>
  );
}

function Err({ msg }: { msg: string }) { return msg ? <p className="text-sm text-red-600">{msg}</p> : null; }

function UsersPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ username: "", name: "", role: "supervisor" as Role, password: "" });
  const [err, setErr] = useState("");
  async function load() { const d = await jget("/api/floor/admin/users"); if (d) setUsers(d.users); }
  useEffect(() => { load(); }, []);

  async function create() {
    setErr("");
    const { ok, data } = await jsend("/api/floor/admin/users", "POST", form);
    if (ok) { setForm({ username: "", name: "", role: "supervisor", password: "" }); load(); }
    else setErr((data.errors ?? [data.error]).join(" "));
  }
  async function patch(id: number, body: unknown) {
    const { ok, data } = await jsend(`/api/floor/admin/users/${id}`, "PATCH", body);
    if (ok) load(); else setErr(data.error ?? "Update failed.");
  }
  async function resetPw(id: number) {
    const pw = prompt("New password (min 6 chars):");
    if (pw) patch(id, { password: pw });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white border border-[#e4ddd4] p-4 space-y-2">
        <h2 className="font-medium text-charcoal">New user</h2>
        <Err msg={err} />
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Username" autoCapitalize="none" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="rounded-lg border border-[#e4ddd4] px-3 py-2" />
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-[#e4ddd4] px-3 py-2" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className="rounded-lg border border-[#e4ddd4] px-3 py-2">
            <option value="supervisor">supervisor</option><option value="manager">manager</option><option value="admin">admin</option>
          </select>
          <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="rounded-lg border border-[#e4ddd4] px-3 py-2" />
        </div>
        <button onClick={create} className="w-full rounded-xl bg-copper text-white py-2.5 font-medium">Add user</button>
      </div>
      <ul className="space-y-2">
        {users.map((u) => (
          <li key={u.id} className={`rounded-xl border border-[#e4ddd4] p-3 ${u.active ? "bg-white" : "bg-[#f3efe8] opacity-70"}`}>
            <div className="flex justify-between">
              <span className="text-charcoal">{u.name} <span className="text-text-muted">@{u.username}</span></span>
              <select value={u.role} onChange={(e) => patch(u.id, { role: e.target.value })} className="text-sm border border-[#e4ddd4] rounded px-1">
                <option value="supervisor">supervisor</option><option value="manager">manager</option><option value="admin">admin</option>
              </select>
            </div>
            <div className="flex gap-3 mt-1 text-sm">
              <button onClick={() => patch(u.id, { active: !u.active })} className="text-copper">{u.active ? "Deactivate" : "Reactivate"}</button>
              <button onClick={() => resetPw(u.id)} className="text-copper">Reset password</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NamedPanel({ kind }: { kind: "operators" | "machines" }) {
  const [rows, setRows] = useState<Named[]>([]);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const base = `/api/floor/admin/${kind}`;
  const key = kind;
  async function load() { const d = await jget(base); if (d) setRows(d[key]); }
  useEffect(() => { load(); }, [kind]);
  async function create() {
    setErr("");
    const { ok, data } = await jsend(base, "POST", { name });
    if (ok) { setName(""); load(); } else setErr((data.errors ?? [data.error]).join(" "));
  }
  async function patch(id: number, body: unknown) { const { ok } = await jsend(`${base}/${id}`, "PATCH", body); if (ok) load(); }
  async function rename(id: number, current: string) { const n = prompt("New name:", current); if (n) patch(id, { name: n }); }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white border border-[#e4ddd4] p-4 space-y-2">
        <Err msg={err} />
        <div className="flex gap-2">
          <input placeholder={`New ${kind.slice(0, -1)}`} value={name} onChange={(e) => setName(e.target.value)} className="flex-1 rounded-lg border border-[#e4ddd4] px-3 py-2" />
          <button onClick={create} className="rounded-xl bg-copper text-white px-4 font-medium">Add</button>
        </div>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className={`rounded-xl border border-[#e4ddd4] p-3 flex justify-between items-center ${r.active ? "bg-white" : "bg-[#f3efe8] opacity-70"}`}>
            <span className="text-charcoal">{r.name}</span>
            <div className="flex gap-3 text-sm">
              <button onClick={() => rename(r.id, r.name)} className="text-copper">Rename</button>
              <button onClick={() => patch(r.id, { active: !r.active })} className="text-copper">{r.active ? "Deactivate" : "Reactivate"}</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChecklistPanel() {
  const [items, setItems] = useState<Item[]>([]);
  const [tpl, setTpl] = useState<{ code: string; version: string } | null>(null);
  const [form, setForm] = useState({ category: "", label: "", critical: false });
  const [err, setErr] = useState("");
  async function load() {
    const d = await jget("/api/floor/admin/checklist");
    if (d) { setItems(d.items); setTpl(d.template); }
  }
  useEffect(() => { load(); }, []);
  async function add() {
    setErr("");
    const { ok, data } = await jsend("/api/floor/admin/checklist", "POST", form);
    if (ok) { setForm({ category: "", label: "", critical: false }); load(); } else setErr(data.error ?? "Failed.");
  }
  async function patch(id: number, body: unknown) { const { ok } = await jsend(`/api/floor/admin/checklist/${id}`, "PATCH", body); if (ok) load(); }
  async function rename(id: number, current: string) { const n = prompt("New label:", current); if (n) patch(id, { label: n }); }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">{tpl ? `${tpl.code} ${tpl.version}` : "…"} · {items.length} active items</p>
      <div className="rounded-xl bg-white border border-[#e4ddd4] p-4 space-y-2">
        <h2 className="font-medium text-charcoal">Add item</h2>
        <Err msg={err} />
        <input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-lg border border-[#e4ddd4] px-3 py-2" />
        <input placeholder="Label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="w-full rounded-lg border border-[#e4ddd4] px-3 py-2" />
        <label className="flex items-center gap-2 text-sm text-charcoal">
          <input type="checkbox" checked={form.critical} onChange={(e) => setForm({ ...form, critical: e.target.checked })} /> Critical
        </label>
        <button onClick={add} className="w-full rounded-xl bg-copper text-white py-2.5 font-medium">Add item</button>
      </div>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="rounded-xl border border-[#e4ddd4] bg-white p-3">
            <div className="flex justify-between">
              <span className="text-charcoal">{it.label}{it.critical && <span className="text-red-500"> *</span>}</span>
              <span className="text-xs text-text-muted">{it.category}</span>
            </div>
            <div className="flex gap-3 mt-1 text-sm">
              <button onClick={() => rename(it.id, it.label)} className="text-copper">Edit</button>
              <button onClick={() => patch(it.id, { critical: !it.critical })} className="text-copper">{it.critical ? "Unmark critical" : "Mark critical"}</button>
              <button onClick={() => patch(it.id, { active: false })} className="text-red-600">Remove</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
