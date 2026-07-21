"use client";

import { useState } from "react";
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

// Warm palette, cycled. Each gets a top→bottom gradient for a bit of depth.
const COLORS = ["#c9612e", "#393836", "#d9784a", "#8a8480", "#c9a15e", "#a8794f"];

export default function InventoryChart({ data }: InventoryChartProps) {
  const [active, setActive] = useState<number | null>(null);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
        onMouseLeave={() => setActive(null)}
      >
        <defs>
          {COLORS.map((c, i) => (
            <linearGradient key={i} id={`invBar${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c} stopOpacity={0.95} />
              <stop offset="100%" stopColor={c} stopOpacity={0.62} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4ddd4" vertical={false} />
        <XAxis dataKey="type" tickLine={false} axisLine={{ stroke: "#e4ddd4" }} tick={{ fontSize: 11, fill: "#8a8480", fontFamily: "Nunito Sans" }} />
        <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "#8a8480" }} />
        <Tooltip
          cursor={{ fill: "rgba(201,97,46,0.06)" }}
          formatter={(v: number) => [v.toLocaleString(), "Units"]}
          contentStyle={{ borderRadius: 10, border: "1px solid #e4ddd4", backgroundColor: "#fffdf9", fontSize: 12, boxShadow: "0 8px 24px -12px rgba(57,56,54,0.35)" }}
          labelStyle={{ color: "#393836", fontWeight: 600 }}
        />
        <Bar
          dataKey="units"
          radius={[5, 5, 0, 0]}
          animationDuration={950}
          animationEasing="ease-out"
          onMouseEnter={(_, i) => setActive(i)}
        >
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={`url(#invBar${i % COLORS.length})`}
              fillOpacity={active === null || active === i ? 1 : 0.35}
              style={{ transition: "fill-opacity 200ms ease" }}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
