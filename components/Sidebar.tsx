"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Overview", icon: "📊" },
  { href: "/risk", label: "Cover Risk", icon: "⚠️" },
  { href: "/inventory", label: "Inventory", icon: "📦" },
  { href: "/variance", label: "Sales Variance", icon: "📈" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 shrink-0 bg-brand-green min-h-screen flex flex-col">
      <div className="px-5 py-6 border-b border-white/20">
        <p className="text-white font-bold text-lg leading-tight">Wild Nutrition</p>
        <p className="text-white/60 text-xs mt-0.5">SKU Dashboard</p>
      </div>
      <nav className="flex-1 py-4 px-2">
        {nav.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-medium transition-colors ${
                active
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span>{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 text-white/40 text-xs">
        Data refreshes every 5 min
      </div>
    </aside>
  );
}
