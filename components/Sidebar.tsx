"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  { href: "/goods-in", label: "Goods In", icon: "⬇" },
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
  // Mobile nav drawer (desktop always shows the sidebar; only <md uses this).
  const [navOpen, setNavOpen] = useState(false);
  // Close the drawer whenever the route changes (tapping a nav link).
  useEffect(() => setNavOpen(false), [pathname]);

  function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
    // Internal Production owns all /planning/* sub-tabs, so highlight it on any of them.
    const active =
      pathname === href || (href === "/planning" && pathname.startsWith("/planning/"));
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
      {/* Mobile top bar (hidden on md+): hamburger + logo */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-[#f7f3ee] border-b border-[#e4ddd4] flex items-center gap-3 px-4">
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Open menu"
          className="p-1.5 -ml-1.5 rounded-md text-[#393836] hover:bg-[#ede6db]"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <Image src="/brand/wn-logo.png" alt="Wild Nutrition" width={460} height={133} priority className="h-auto w-[120px]" />
      </div>

      {/* Backdrop when the drawer is open on mobile */}
      {navOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setNavOpen(false)} aria-hidden />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 overflow-y-auto transform transition-transform duration-200 ease-out
          ${navOpen ? "translate-x-0" : "-translate-x-full"}
          md:static md:z-auto md:translate-x-0 md:shrink-0 md:transition-none md:overflow-visible
          min-h-screen flex flex-col border-r border-[#e4ddd4] bg-[#f7f3ee]`}
      >
        <div className="px-6 py-8 border-b border-[#e4ddd4] flex items-start justify-between">
          <div>
            <Image
              src="/brand/wn-logo.png"
              alt="Wild Nutrition"
              width={460}
              height={133}
              priority
              className="h-auto w-[172px]"
            />
            <p className="text-[#8a8480] text-xs mt-2 tracking-widest uppercase">
              SKU Dashboard
            </p>
          </div>
          {/* Close button (mobile drawer only) */}
          <button
            onClick={() => setNavOpen(false)}
            aria-label="Close menu"
            className="md:hidden p-1 -mr-1 rounded-md text-[#8a8480] hover:bg-[#ede6db]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
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
