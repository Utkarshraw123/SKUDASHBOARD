"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/planning", label: "Schedule" },
  { href: "/planning/performance", label: "Performance" },
  { href: "/planning/yield", label: "Yield" },
  { href: "/planning/readiness", label: "Readiness" },
];

export default function InternalProductionTabs() {
  const pathname = usePathname();

  // The Production Report form lives under /planning/report but is a data-entry
  // form, not one of the four consolidated views — no sub-tab bar there.
  if (pathname.startsWith("/planning/report")) return null;

  return (
    <div className="mb-8 border-b border-[#e4ddd4]">
      <nav className="flex gap-1 -mb-px">
        {tabs.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`px-4 py-2.5 text-sm tracking-wide border-b-2 transition-colors ${
                active
                  ? "border-[#c9612e] text-[#c9612e] font-medium"
                  : "border-transparent text-[#8a8480] hover:text-[#c9612e] hover:border-[#e4ddd4]"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
