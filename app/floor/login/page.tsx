"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FloorLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/floor/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/floor");
    } else {
      const { error } = await res.json().catch(() => ({ error: "Login failed." }));
      setError(error ?? "Login failed.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-cream px-4 overflow-auto">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl border border-[#e4ddd4] p-6 space-y-4">
        <h1 className="font-serif text-2xl text-charcoal">Production Login</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input
          className="w-full rounded-xl border border-[#e4ddd4] px-3 py-3 text-base"
          placeholder="Username" autoCapitalize="none" autoCorrect="off"
          value={username} onChange={(e) => setUsername(e.target.value)} />
        <input
          className="w-full rounded-xl border border-[#e4ddd4] px-3 py-3 text-base"
          type="password" placeholder="Password"
          value={password} onChange={(e) => setPassword(e.target.value)} />
        <button
          type="submit" disabled={busy}
          className="w-full rounded-xl bg-copper text-white py-3 text-base font-medium disabled:opacity-50">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
