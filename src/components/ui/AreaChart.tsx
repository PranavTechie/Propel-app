import React, { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { Activity } from "lucide-react";
import { cn } from "@/utils/cn";
import { clamp, monotonePath, svgId } from "./chartMath";
import { Skeleton } from "./Skeleton";

export interface AreaSeries {
  key: string;
  label: string;
  values: number[];
  /** CSS color, e.g. "rgb(var(--c-chart-1))". */
  color: string;
}

interface AreaChartProps {
  labels: string[];
  series: AreaSeries[];
  height?: number;
  yMax?: number;
  yTicks?: number[];
  formatValue?: (v: number) => string;
  formatTick?: (v: number) => string;
  "aria-label": string;
  emptyLabel?: string;
  className?: string;
}

const M = { top: 10, right: 10, bottom: 24, left: 36 };

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Multi-series area chart in plain SVG: gradient fills, dashed grid,
 * hover crosshair + tooltip, arrow-key inspection.
 */
export const AreaChart = memo<AreaChartProps>(
  ({
    labels,
    series,
    height = 220,
    yMax = 100,
    yTicks = [0, 25, 50, 75, 100],
    formatValue = (v) => `${Math.round(v)}%`,
    formatTick = (v) => `${v}%`,
    emptyLabel = "Collecting live data",
    className,
    ...rest
  }) => {
    const [wrapRef, width] = useWidth<HTMLDivElement>();
    const [idx, setIdx] = useState<number | null>(null);
    const uid = svgId(useId());
    const n = labels.length;
    const plotW = Math.max(0, width - M.left - M.right);
    const plotH = height - M.top - M.bottom;
    const x = (i: number) => M.left + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
    const y = (v: number) => M.top + plotH - (clamp(v, 0, yMax) / yMax) * plotH;

    const paths = useMemo(() => {
      if (n < 2 || plotW <= 0) return [];
      return series.map((s) => {
        const pts = s.values.slice(0, n).map((v, i) => [x(i), y(v)] as const);
        const line = monotonePath(pts);
        const base = M.top + plotH;
        return { key: s.key, line, area: `${line}L${x(pts.length - 1)},${base}L${x(0)},${base}Z` };
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [series, n, plotW, plotH, yMax]);

    // Keep the hovered index valid as new points stream in.
    const active = idx == null ? null : clamp(idx, 0, Math.max(0, n - 1));

    const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
      if (n < 2 || plotW <= 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const px = e.clientX - rect.left - M.left;
      setIdx(clamp(Math.round((px / plotW) * (n - 1)), 0, n - 1));
    };
    const onKey = (e: React.KeyboardEvent) => {
      if (n < 2) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const start = active ?? n - 1;
        setIdx(clamp(start + (e.key === "ArrowRight" ? 1 : -1), 0, n - 1));
      } else if (e.key === "Escape") setIdx(null);
    };

    const emptyView = (
      <div className="absolute inset-0 flex flex-col justify-end gap-3" role="status">
        <div className="absolute inset-0 flex flex-col justify-between py-3">
          {yTicks.map((t) => (
            <div key={t} className="border-t border-dashed border-line-subtle" />
          ))}
        </div>
        <div className="relative mx-auto flex items-center gap-2 rounded-full border border-line-subtle bg-surface-raised px-3 py-1.5 text-caption text-fg-3 shadow-1">
          <Activity className="h-3.5 w-3.5 text-brand" />
          {emptyLabel}
        </div>
        <Skeleton className="relative mb-6 h-10 w-full opacity-60" />
      </div>
    );

    const tickIdx = n >= 3 ? [0, Math.floor((n - 1) / 2), n - 1] : [0, n - 1];
    const tipLeft = active != null ? x(active) : 0;
    const flip = tipLeft > width - 170;

    return (
      <div ref={wrapRef} className={cn("relative select-none", className)} style={{ height }}>
        {n < 2 && emptyView}
        {n >= 2 && width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={rest["aria-label"]}
            tabIndex={0}
            onPointerMove={onPointer}
            onPointerLeave={() => setIdx(null)}
            onKeyDown={onKey}
            onBlur={() => setIdx(null)}
            className="block rounded-chip focus-visible:shadow-ring focus-visible:outline-none"
          >
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={s.color} stopOpacity={0.24} />
                  <stop offset="0.7" stopColor={s.color} stopOpacity={0.05} />
                  <stop offset="1" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>

            {yTicks.map((t) => (
              <g key={t}>
                <line
                  x1={M.left}
                  x2={M.left + plotW}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="rgb(var(--c-chart-grid) / var(--a-chart-grid))"
                  strokeDasharray={t === 0 ? undefined : "3 4"}
                />
                <text
                  x={M.left - 8}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-fg-3 text-[10px] tabular"
                >
                  {formatTick(t)}
                </text>
              </g>
            ))}

            {tickIdx.map((i, k) => (
              <text
                key={i}
                x={x(i)}
                y={height - 6}
                textAnchor={k === 0 ? "start" : k === tickIdx.length - 1 ? "end" : "middle"}
                className="fill-fg-3 text-[10px] tabular"
              >
                {labels[i]}
              </text>
            ))}

            {paths.map((p) => (
              <path key={`a-${p.key}`} d={p.area} fill={`url(#${uid}-${p.key})`} />
            ))}
            {paths.map((p, i) => (
              <path
                key={`l-${p.key}`}
                d={p.line}
                fill="none"
                stroke={series[i].color}
                strokeWidth={i === 0 ? 2 : 1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {active != null && (
              <g pointerEvents="none">
                <line
                  x1={x(active)}
                  x2={x(active)}
                  y1={M.top}
                  y2={M.top + plotH}
                  stroke="rgb(var(--c-line) / .28)"
                  strokeDasharray="2 3"
                />
                {series.map((s) => (
                  <circle
                    key={s.key}
                    cx={x(active)}
                    cy={y(s.values[active] ?? 0)}
                    r={4}
                    fill={s.color}
                    stroke="rgb(var(--c-surface-raised))"
                    strokeWidth={2}
                  />
                ))}
              </g>
            )}
          </svg>
        )}

        {n >= 2 && active != null && (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-1 z-10 min-w-[136px] rounded-control border border-line bg-surface-popover px-3 py-2 shadow-[var(--shadow-4)]"
            style={{
              left: tipLeft,
              transform: flip ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
            }}
          >
            <p className="mb-1.5 text-[10.5px] font-medium text-fg-3 tabular">{labels[active]}</p>
            {series.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-4 text-body-sm">
                <span className="flex items-center gap-1.5 text-fg-2">
                  <i className="h-2 w-2 rounded-[3px]" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="font-semibold text-fg-1 tabular">
                  {formatValue(s.values[active] ?? 0)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
);
AreaChart.displayName = "AreaChart";
