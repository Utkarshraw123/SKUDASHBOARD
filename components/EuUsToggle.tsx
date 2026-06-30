"use client";

import { useRouter } from "next/navigation";

export default function EuUsToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  function toggle() {
    document.cookie = `includeEuUs=${enabled ? "0" : "1"};path=/;max-age=31536000`;
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      title={enabled ? "Click to hide EU/US SKUs" : "Click to include EU/US SKUs"}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all ${
        enabled
          ? "bg-[#c9612e]/10 text-[#c9612e] border border-[#c9612e]/30"
          : "text-[#8a8480] hover:bg-[#ede6db]"
      }`}
    >
      <span className={`w-8 h-4 rounded-full relative flex-shrink-0 transition-colors ${enabled ? "bg-[#c9612e]" : "bg-[#e4ddd4]"}`}>
        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${enabled ? "left-4" : "left-0.5"}`} />
      </span>
      <span className="text-xs tracking-wide">
        {enabled ? "EU / US included" : "UK only (excl. EU/US)"}
      </span>
    </button>
  );
}
