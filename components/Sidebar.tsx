"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Overview", icon: "○" },
  { href: "/risk", label: "Cover Risk", icon: "△" },
  { href: "/inventory", label: "Inventory", icon: "□" },
  { href: "/variance", label: "Sales Variance", icon: "◇" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-60 shrink-0 min-h-screen flex flex-col border-r border-[#e4ddd4] bg-[#f7f3ee]">
      {/* Logo area */}
      <div className="px-6 py-8 border-b border-[#e4ddd4]">
        <p className="font-serif text-[#393836] font-medium text-xl tracking-wide leading-tight">
          Wild Nutrition
        </p>
        <p className="text-[#8a8480] text-xs mt-1 tracking-widest uppercase">
          SKU Dashboard
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-6 px-3">
        {nav.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md mb-1 text-sm tracking-wide transition-all ${
                active
                  ? "bg-[#c9612e] text-white font-medium"
                  : "text-[#393836] hover:bg-[#ede6db] hover:text-[#c9612e]"
              }`}
            >
              <span className="text-xs opacity-70">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-6 py-5 border-t border-[#e4ddd4]">
        <p className="text-[#8a8480] text-xs tracking-wide">Refreshes every 5 min</p>
      </div>
    </aside>
  );
}
