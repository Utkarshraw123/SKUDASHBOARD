"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type MarketMode = "all" | "dtc" | "eu" | "us" | "accessories";

const MODES: { id: MarketMode; label: string; sublabel: string; icon: string }[] = [
  {
    id: "all",
    label: "All SKUs",
    sublabel: "UK, EU, US and Accessories — everything",
    icon: "🌍",
  },
  {
    id: "dtc",
    label: "DTC & Retail Finished Goods",
    sublabel: "UK domestic products only — default view",
    icon: "🇬🇧",
  },
  {
    id: "eu",
    label: "EU Goods only",
    sublabel: "Products whose name starts with \"EU\"",
    icon: "🇪🇺",
  },
  {
    id: "us",
    label: "US Goods only",
    sublabel: "Products whose name starts with \"US\"",
    icon: "🇺🇸",
  },
  {
    id: "accessories",
    label: "Accessories & Books",
    sublabel: "Non-supplement items (tote bags, booklets, etc.)",
    icon: "🎁",
  },
];

export default function MarketModal({
  show,
  currentMode,
  onClose,
}: {
  show: boolean;
  currentMode: MarketMode;
  onClose?: () => void;
}) {
  const [selected, setSelected] = useState<MarketMode>(currentMode);
  const router = useRouter();

  function apply() {
    document.cookie = `marketMode=${selected};path=/;max-age=31536000`;
    document.cookie = `marketsConfigured=1;path=/;max-age=31536000`;
    router.refresh();
    onClose?.();
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-cream px-8 pt-8 pb-5 border-b border-[#e4ddd4]">
          <p className="font-serif text-2xl font-medium text-charcoal tracking-wide">Select Market View</p>
          <p className="text-text-muted text-sm mt-1.5">
            Choose which SKUs to show across the entire dashboard.
          </p>
        </div>

        {/* Options */}
        <div className="px-6 py-5 space-y-2.5">
          {MODES.map((m) => {
            const active = selected === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelected(m.id)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border-2 text-left transition-all ${
                  active
                    ? "border-copper bg-[#fdf3ee]"
                    : "border-[#e4ddd4] bg-white hover:border-copper/40"
                }`}
              >
                {/* Radio dot */}
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  active ? "border-copper" : "border-[#ccc]"
                }`}>
                  {active && <div className="w-2 h-2 rounded-full bg-copper" />}
                </div>
                <span className="text-lg flex-shrink-0">{m.icon}</span>
                <div className="min-w-0">
                  <p className="font-medium text-charcoal text-sm leading-snug">{m.label}</p>
                  <p className="text-xs text-text-muted mt-0.5">{m.sublabel}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-8 pb-7 pt-1 flex justify-between items-center">
          {onClose && (
            <button
              onClick={onClose}
              className="text-sm text-text-muted hover:text-charcoal transition-colors"
            >
              Cancel
            </button>
          )}
          {!onClose && <span />}
          <button
            onClick={apply}
            className="bg-copper text-white font-medium text-sm px-7 py-3 rounded-xl hover:bg-[#d9784a] transition-colors"
          >
            Apply →
          </button>
        </div>
      </div>
    </div>
  );
}
