"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface InventoryChartProps {
  data: { type: string; units: number }[];
}

const COLORS = ["#2D6A4F", "#52B788", "#74C69D", "#95D5B2", "#B7E4C7", "#D8F3DC", "#40916C"];

export default function InventoryChart({ data }: InventoryChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="type" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(v: number) => [v.toLocaleString(), "Units"]} />
        <Bar dataKey="units" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
