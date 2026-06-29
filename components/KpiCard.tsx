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

export default function KpiCard({ title, value, subtitle, color = "default" }: KpiCardProps) {
  return (
    <div className={`rounded-xl border p-5 ${colorMap[color]}`}>
      <p className="text-xs font-medium tracking-widest uppercase opacity-60">{title}</p>
      <p className={`mt-2 text-3xl font-serif font-medium ${valueColor[color]}`}>{value}</p>
      {subtitle && <p className="mt-1 text-xs opacity-50">{subtitle}</p>}
    </div>
  );
}
