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

const COLORS = ["#c9612e", "#393836", "#d9784a", "#8a8480", "#e4ddd4", "#ede6db"];

export default function InventoryChart({ data }: InventoryChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4ddd4" />
        <XAxis dataKey="type" tick={{ fontSize: 11, fill: "#8a8480", fontFamily: "Nunito Sans" }} />
        <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "#8a8480" }} />
        <Tooltip
          formatter={(v: number) => [v.toLocaleString(), "Units"]}
          contentStyle={{ borderRadius: 8, border: "1px solid #e4ddd4", backgroundColor: "#f7f3ee", fontSize: 12 }}
        />
        <Bar dataKey="units" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
