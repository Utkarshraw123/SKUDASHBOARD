"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  async function signOut() {
    await fetch("/api/floor/logout", { method: "POST" });
    router.push("/floor/login");
    router.refresh();
  }
  return (
    <button onClick={signOut} className="rounded-xl border border-copper text-copper px-4 py-2">
      Sign out
    </button>
  );
}
