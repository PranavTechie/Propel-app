import React, { memo, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ChartDataPoint } from "@/types";
function cssVar(name: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  );
}
interface LiveChartProps {
  data: ChartDataPoint[];
  showCPU?: boolean;
  showRAM?: boolean;
  height?: number;
}
const CustomTooltip = memo(
  ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-border/80 bg-bg-elevated px-3 py-2 text-xs shadow-lg">
        <p className="mb-1 text-[10px] text-text-muted">{label}</p>
        {payload.map((p) => (
          <p
            key={p.name}
            className="font-semibold tabular-nums"
            style={{ color: p.color }}
          >
            {p.name} <span className="ml-2">{p.value}%</span>
          </p>
        ))}
      </div>
    );
  },
);
CustomTooltip.displayName = "CustomTooltip";
export const LiveChart = memo<LiveChartProps>(
  ({ data, showCPU = true, showRAM = true, height = 200 }) => {
    const c1 = useMemo(() => cssVar("--graph-1", "#4f9636"), []);
    const c2 = useMemo(() => cssVar("--graph-2", "#9a7b45"), []);
    const grid = useMemo(
      () => cssVar("--t-chart-grid", "rgba(87,101,81,.1)"),
      [],
    );
    const muted = useMemo(
      () => `rgb(${cssVar("--t-text-muted", "150 157 145")})`,
      [],
    );
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={data}
          margin={{ top: 8, right: 6, left: -22, bottom: 0 }}
        >
          <defs>
            <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={c1} stopOpacity={0.16} />
              <stop offset="100%" stopColor={c1} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={c2} stopOpacity={0.11} />
              <stop offset="100%" stopColor={c2} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={grid} />
          <XAxis
            dataKey="time"
            tick={{ fill: muted, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tick={{ fill: muted, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          {showCPU && (
            <Area
              type="monotone"
              dataKey="cpu"
              name="CPU"
              stroke={c1}
              strokeWidth={2}
              fill="url(#cpuGrad)"
              dot={false}
              activeDot={{ r: 3, fill: c1, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          )}{" "}
          {showRAM && (
            <Area
              type="monotone"
              dataKey="ram"
              name="Memory"
              stroke={c2}
              strokeWidth={1.75}
              fill="url(#ramGrad)"
              dot={false}
              activeDot={{ r: 3, fill: c2, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    );
  },
);
LiveChart.displayName = "LiveChart";
