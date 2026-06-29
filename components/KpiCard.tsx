interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: "default" | "red" | "amber" | "green" | "blue";
}

const colorMap = {
  default: "bg-white border-gray-200 text-gray-900",
  red: "bg-red-50 border-red-200 text-red-700",
  amber: "bg-amber-50 border-amber-200 text-amber-700",
  green: "bg-green-50 border-green-200 text-green-700",
  blue: "bg-blue-50 border-blue-200 text-blue-700",
};

export default function KpiCard({ title, value, subtitle, color = "default" }: KpiCardProps) {
  return (
    <div className={`rounded-xl border p-5 ${colorMap[color]}`}>
      <p className="text-sm font-medium opacity-70">{title}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      {subtitle && <p className="mt-1 text-xs opacity-60">{subtitle}</p>}
    </div>
  );
}
