import React from "react";
import { cn } from "@/utils/cn";

type EmptyTone = "neutral" | "brand" | "warning" | "danger";

const DISC: Record<EmptyTone, string> = {
  neutral: "bg-surface-raised text-fg-3 border-line",
  brand: "bg-brand-soft text-brand-fg border-brand/20",
  warning: "bg-warning-soft text-warning-fg border-warning/25",
  danger: "bg-danger-soft text-danger-fg border-danger/25",
};

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  tone?: EmptyTone;
  compact?: boolean;
  className?: string;
}

/**
 * Designed empty / error / first-run state: icon disc on soft concentric
 * rings, short title, one line of guidance, optional single action.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  tone = "neutral",
  compact = false,
  className,
}) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center px-6 text-center",
      compact ? "py-8" : "py-12",
      className,
    )}
  >
    <div className="relative grid h-14 w-14 place-items-center">
      <svg
        aria-hidden
        viewBox="0 0 120 120"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[120px] w-[120px] -translate-x-1/2 -translate-y-1/2"
      >
        <circle cx="60" cy="60" r="40" fill="none" stroke="rgb(var(--c-line) / .1)" />
        <circle
          cx="60"
          cy="60"
          r="56"
          fill="none"
          stroke="rgb(var(--c-line) / .07)"
          strokeDasharray="2 4"
        />
      </svg>
      <div
        className={cn(
          "relative grid h-14 w-14 place-items-center rounded-card border shadow-[var(--shadow-1),var(--highlight-top)] [&>svg]:h-6 [&>svg]:w-6",
          DISC[tone],
        )}
      >
        {icon}
      </div>
    </div>
    <h3 className="mt-6 text-title font-semibold text-fg-1">{title}</h3>
    {description && <p className="mt-1 max-w-sm text-body text-fg-3">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);
