import React, { memo } from "react";
import { cn } from "@/utils/cn";
import { TONE_VAR, usageTone, type Tone, type UsageMetric } from "@/theme/thresholds";
import { TONE_TEXT } from "./tone";
import { clamp } from "./chartMath";

interface ProgressProps {
  value: number | null;
  /** Explicit tone. "brand" = neutral progress (scans, tasks). */
  tone?: Tone | "brand";
  /** Derive tone from usage thresholds (cpu / memory / disk). */
  metric?: UsageMetric;
  size?: "xs" | "sm" | "md";
  label?: React.ReactNode;
  valueLabel?: React.ReactNode;
  showValue?: boolean;
  indeterminate?: boolean;
  className?: string;
  "aria-label"?: string;
}

const H = { xs: "h-1", sm: "h-1.5", md: "h-2" } as const;

/** Linear progress / usage bar. Colors follow healthy/warning/critical. */
export const Progress = memo<ProgressProps>(
  ({
    value,
    tone,
    metric,
    size = "sm",
    label,
    valueLabel,
    showValue = false,
    indeterminate = false,
    className,
    ...rest
  }) => {
    const resolved: Tone | "brand" = tone ?? (metric ? usageTone(metric, value) : "brand");
    const colorVar = resolved === "brand" ? "--c-brand-solid" : TONE_VAR[resolved];
    const pct = value == null ? 0 : clamp(value, 0, 100);
    const header = label != null || showValue;
    return (
      <div className={cn("w-full", className)}>
        {header && (
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-caption">
            <span className="truncate text-fg-3">{label}</span>
            {showValue && (
              <span
                className={cn(
                  "shrink-0 font-semibold tabular",
                  resolved === "warning" || resolved === "critical"
                    ? TONE_TEXT[resolved]
                    : "text-fg-2",
                )}
              >
                {valueLabel ?? (value == null ? "--" : `${Math.round(pct)}%`)}
              </span>
            )}
          </div>
        )}
        <div
          role="progressbar"
          aria-label={rest["aria-label"] ?? (typeof label === "string" ? label : undefined)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={indeterminate || value == null ? undefined : Math.round(pct)}
          className={cn(
            "relative w-full overflow-hidden rounded-full bg-surface-inset shadow-[inset_0_0_0_1px_rgb(var(--c-line)/var(--a-line-1))]",
            H[size],
          )}
        >
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full",
              indeterminate
                ? "w-1/3 animate-[ds-indeterminate_1.3s_var(--ease-in-out)_infinite]"
                : "transition-[width,background-color] duration-slow ease-out",
            )}
            style={{
              width: indeterminate ? undefined : `${pct}%`,
              background: `linear-gradient(90deg, rgb(var(${colorVar}) / .78), rgb(var(${colorVar})))`,
            }}
          />
        </div>
      </div>
    );
  },
);
Progress.displayName = "Progress";
