"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import MarketModal, { type MarketMode } from "./MarketModal";

const mainNav = [
  { href: "/", label: "Overview", icon: "○" },
  { href: "/risk", label: "Cover Risk", icon: "△" },
  { href: "/inventory", label: "Inventory", icon: "□" },
  { href: "/variance", label: "Sales Variance", icon: "◇" },
];

const productionNav = [
  { href: "/production", label: "External Production", icon: "↗" },
  { href: "/planning", label: "Internal Production", icon: "⊞" },
  { href: "/planning/performance", label: "Production Performance", icon: "◔" },
  { href: "/planning/yield", label: "Internal Production Yield", icon: "❋" },
  { href: "/planning/readiness", label: "Production Readiness", icon: "⚑" },
  { href: "/packing", label: "Packing Schedule", icon: "⊡" },
  { href: "/purchase-orders", label: "Open Purchase Orders", icon: "≡" },
];

const formulaNav = [
  { href: "/bom", label: "Bill of Materials", icon: "⎆" },
  { href: "/procurement", label: "Procurement Planner", icon: "◎" },
  { href: "/procurement/actions", label: "Procurement Actions", icon: "⛁" },
  { href: "/component-cover", label: "Component Cover", icon: "◈" },
];

const MODE_LABELS: Record<MarketMode, string> = {
  all: "All SKUs",
  dtc: "DTC & Retail",
  eu: "EU Goods only",
  us: "US Goods only",
  accessories: "Accessories",
};

export default function Sidebar({ mode }: { mode: MarketMode }) {
  const pathname = usePathname();
  const [showModal, setShowModal] = useState(false);

  function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
    const active = pathname === href;
    return (
      <Link
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
  }

  return (
    <>
      <aside className="w-64 shrink-0 min-h-screen flex flex-col border-r border-[#e4ddd4] bg-[#f7f3ee]">
        <div className="px-6 py-8 border-b border-[#e4ddd4]">
          <p className="font-serif text-[#393836] font-medium text-xl tracking-wide leading-tight">
            Wild Nutrition
          </p>
          <p className="text-[#8a8480] text-xs mt-1 tracking-widest uppercase">
            SKU Dashboard
          </p>
        </div>

        <nav className="flex-1 py-6 px-3">
          {mainNav.map((item) => <NavLink key={item.href} {...item} />)}

          <div className="mt-5 mb-2 px-3">
            <p className="text-[10px] tracking-widest uppercase text-[#8a8480] font-medium">Production</p>
          </div>

          {productionNav.map((item) => <NavLink key={item.href} {...item} />)}

          <div className="mt-5 mb-2 px-3">
            <p className="text-[10px] tracking-widest uppercase text-[#8a8480] font-medium">Formulation</p>
          </div>

          {formulaNav.map((item) => <NavLink key={item.href} {...item} />)}
        </nav>

        {/* Market mode panel */}
        <div className="px-3 pb-3 border-t border-[#e4ddd4] pt-4">
          <p className="text-[10px] tracking-widest uppercase text-[#8a8480] font-medium px-3 mb-2">Market View</p>
          <div className="px-3 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-copper flex-shrink-0" />
            <span className="text-xs text-[#393836] font-medium">{MODE_LABELS[mode]}</span>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-[#c9612e] hover:bg-[#ede6db] transition-all font-medium"
          >
            <span>⇄</span>
            Switch Market View
          </button>
        </div>

        <div className="px-6 py-4 border-t border-[#e4ddd4]">
          <p className="text-[#8a8480] text-xs tracking-wide">Refreshes every 5 min</p>
        </div>
      </aside>

      {showModal && (
        <MarketModal
          show={true}
          currentMode={mode}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
