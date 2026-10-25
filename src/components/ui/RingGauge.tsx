import React, { memo, useEffect, useState } from "react";
import { cn } from "@/utils/cn";
import { toneColor, type Tone } from "@/theme/thresholds";
import { clamp } from "./chartMath";

interface RingGaugeProps {
  /** 0-100, or null while loading. */
  value: number | null;
  tone?: Tone;
  size?: number;
  thickness?: number;
  /** Decorative inner tick ring (hero use). */
  ticks?: boolean;
  children?: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}

/** Score ring. Draws in on mount, then eases between values. */
export const RingGauge = memo<RingGaugeProps>(
  ({ value, tone = "healthy", size = 152, thickness = 12, ticks = false, children, className, ...rest }) => {
    const [drawn, setDrawn] = useState(false);
    useEffect(() => {
      const id = requestAnimationFrame(() => setDrawn(true));
      return () => cancelAnimationFrame(id);
    }, []);

    const r = (size - thickness) / 2;
    const c = 2 * Math.PI * r;
    const pct = value == null ? 0 : clamp(value, 0, 100);
    const offset = c * (1 - (drawn ? pct : 0) / 100);
    const center = size / 2;
    const tickR = r - thickness / 2 - 7;

    return (
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value ?? undefined}
        aria-label={rest["aria-label"]}
        className={cn("relative inline-grid shrink-0 place-items-center", className)}
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0" aria-hidden>
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            strokeWidth={thickness}
            style={{
              stroke: value == null ? "rgb(var(--c-surface-inset))" : toneColor(tone, 0.14),
              transition: "stroke var(--dur-slow) var(--ease-out)",
            }}
          />
          {ticks && tickR > 0 && (
            <circle
              cx={center}
              cy={center}
              r={tickR}
              fill="none"
              stroke="rgb(var(--c-line) / .2)"
              strokeWidth={1}
              strokeDasharray="1.5 4.5"
            />
          )}
          <g transform={`rotate(-90 ${center} ${center})`}>
            <circle
              cx={center}
              cy={center}
              r={r}
              fill="none"
              strokeWidth={thickness}
              strokeLinecap="round"
              strokeDasharray={c}
              style={{
                stroke: toneColor(tone),
                strokeDashoffset: offset,
                opacity: value == null ? 0 : 1,
                transition:
                  "stroke-dashoffset var(--dur-slow) var(--ease-out), stroke var(--dur-slow) var(--ease-out)",
              }}
            />
          </g>
        </svg>
        <div className="relative flex flex-col items-center justify-center text-center">{children}</div>
      </div>
    );
  },
);
RingGauge.displayName = "RingGauge";
