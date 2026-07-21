"use client";

import CountUp from "./CountUp";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: "default" | "red" | "amber" | "copper" | "green";
}

const colorMap = {
  default: "bg-white border-[#e4ddd4] text-[#393836]",
  red: "bg-red-50 border-red-200 text-red-800",
  amber: "bg-amber-50 border-amber-200 text-amber-800",
  copper: "bg-[#fdf3ee] border-[#c9612e]/30 text-[#c9612e]",
  green: "bg-emerald-50 border-emerald-200 text-emerald-800",
};

const valueColor = {
  default: "text-[#393836]",
  red: "text-red-700",
  amber: "text-amber-700",
  copper: "text-[#c9612e]",
  green: "text-emerald-700",
};

const dotColor = {
  default: "bg-[#8a8480]",
  red: "bg-red-500",
  amber: "bg-amber-500",
  copper: "bg-[#c9612e]",
  green: "bg-emerald-500",
};

/** Pull a number (and its decimals / suffix) out of a value like "1,234" or "92.5%". */
function parseValue(value: string | number): { n: number; decimals: number; suffix: string } | null {
  if (typeof value === "number") return isFinite(value) ? { n: value, decimals: 0, suffix: "" } : null;
  const m = value.trim().match(/^(-?[\d,]+(?:\.\d+)?)\s*(%|k|x)?$/i);
  if (!m) return null;
  const raw = m[1].replace(/,/g, "");
  const n = parseFloat(raw);
  if (!isFinite(n)) return null;
  const dot = raw.indexOf(".");
  return { n, decimals: dot === -1 ? 0 : raw.length - dot - 1, suffix: m[2] ?? "" };
}

export default function KpiCard({ title, value, subtitle, color = "default" }: KpiCardProps) {
  const parsed = parseValue(value);
  const live = color === "red" && parsed !== null && parsed.n > 0;

  return (
    <div className={`group relative overflow-hidden rounded-xl border p-5 transition-shadow duration-300 hover:shadow-[0_2px_20px_-8px_rgba(57,56,54,0.25)] ${colorMap[color]}`}>
      <div className="flex items-center gap-1.5">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor[color]} ${live ? "animate-pulse" : "opacity-40"}`} />
        <p className="text-xs font-medium tracking-widest uppercase opacity-60">{title}</p>
      </div>
      <p className={`mt-2 text-3xl font-serif font-medium ${valueColor[color]}`}>
        {parsed ? (
          <CountUp value={parsed.n} decimals={parsed.decimals} suffix={parsed.suffix} />
        ) : (
          value
        )}
      </p>
      {subtitle && <p className="mt-1 text-xs opacity-50">{subtitle}</p>}
    </div>
  );
}
