import React, { memo, useId, useMemo } from "react";
import { cn } from "@/utils/cn";
import { clamp, monotonePath, svgId } from "./chartMath";

interface SparklineProps {
  data: number[];
  /** CSS color, e.g. toneColor("healthy") or "rgb(var(--c-chart-1))". */
  color?: string;
  min?: number;
  max?: number;
  height?: number;
  className?: string;
  "aria-label"?: string;
}

const VB_W = 100;
const PAD = 2;

/** Minimal trend line with a gradient area. Scales to its container width. */
export const Sparkline = memo<SparklineProps>(
  ({ data, color = "rgb(var(--c-chart-1))", min, max, height = 36, className, ...rest }) => {
    const gid = svgId(useId());
    const { line, area } = useMemo(() => {
      if (data.length < 2) return { line: "", area: "" };
      const lo = min ?? Math.min(...data);
      const hiRaw = max ?? Math.max(...data);
      const hi = hiRaw - lo < 1e-6 ? lo + 1 : hiRaw;
      const n = data.length;
      const pts = data.map((v, i) => {
        const x = (i / (n - 1)) * VB_W;
        const y = PAD + (1 - (clamp(v, lo, hi) - lo) / (hi - lo)) * (height - PAD * 2);
        return [x, y] as const;
      });
      const l = monotonePath(pts);
      return { line: l, area: `${l}L${VB_W},${height}L0,${height}Z` };
    }, [data, min, max, height]);

    return (
      <svg
        role="img"
        aria-label={rest["aria-label"] ?? "Trend"}
        viewBox={`0 0 ${VB_W} ${height}`}
        preserveAspectRatio="none"
        className={cn("block w-full overflow-visible", className)}
        style={{ height }}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity={0.22} />
            <stop offset="1" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {line ? (
          <>
            <path d={area} fill={`url(#${gid})`} />
            <path
              d={line}
              fill="none"
              stroke={color}
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : (
          <line
            x1={0}
            x2={VB_W}
            y1={height - PAD}
            y2={height - PAD}
            stroke="rgb(var(--c-line) / .2)"
            strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    );
  },
);
Sparkline.displayName = "Sparkline";
