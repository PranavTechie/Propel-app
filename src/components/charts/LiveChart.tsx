import React, { memo, useMemo } from "react";
import type { ChartDataPoint } from "@/types";
import { AreaChart, type AreaSeries } from "@/components/ui/AreaChart";

interface LiveChartProps {
  data: ChartDataPoint[];
  showCPU?: boolean;
  showRAM?: boolean;
  height?: number;
}

const CPU_COLOR = "rgb(var(--c-chart-1))";
const RAM_COLOR = "rgb(var(--c-chart-2))";

/** Live CPU / memory chart (same props as before, now plain SVG). */
export const LiveChart = memo<LiveChartProps>(
  ({ data, showCPU = true, showRAM = true, height = 200 }) => {
    const labels = useMemo(() => data.map((d) => d.time), [data]);
    const series = useMemo(() => {
      const s: AreaSeries[] = [];
      if (showCPU)
        s.push({ key: "cpu", label: "CPU", color: CPU_COLOR, values: data.map((d) => d.cpu) });
      if (showRAM)
        s.push({ key: "ram", label: "Memory", color: RAM_COLOR, values: data.map((d) => d.ram) });
      return s;
    }, [data, showCPU, showRAM]);
    return (
      <AreaChart
        labels={labels}
        series={series}
        height={height}
        aria-label="CPU and memory usage over the last few minutes"
      />
    );
  },
);
LiveChart.displayName = "LiveChart";
