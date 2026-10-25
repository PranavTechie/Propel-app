import React, { memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/utils/cn";
import { rise } from "@/theme/motion";
import { usageTone, type UsageMetric } from "@/theme/thresholds";
import { Progress } from "@/components/ui/Progress";
import { StatusPill } from "@/components/ui/StatusPill";

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  percent?: number;
  /** Which usage thresholds color the bar. Omit for a neutral bar. */
  metric?: UsageMetric;
  // legacy props, ignored (color now comes from thresholds)
  color?: "blue" | "purple" | "emerald" | "orange" | "red";
  trend?: "up" | "down" | "stable";
  className?: string;
}

/** Compact metric card: label, value, threshold-toned bar. */
export const StatCard = memo<Props>(function StatCard({
  title,
  value,
  subtitle,
  icon,
  percent,
  metric,
  className,
}) {
  const tone = metric && percent !== undefined ? usageTone(metric, percent) : null;
  return (
    <motion.div
      variants={rise}
      className={cn(
        "rounded-card border border-line bg-surface-raised p-4 shadow-[var(--shadow-1),var(--highlight-top)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon && (
            <span className="flex h-7 w-7 items-center justify-center rounded-chip bg-surface-inset text-fg-2">
              <span className="h-4 w-4">{icon}</span>
            </span>
          )}
          <p className="text-body-sm font-medium text-fg-2">{title}</p>
        </div>
        {tone && <StatusPill tone={tone} />}
      </div>
      <p className="mt-3 font-display text-metric font-semibold text-fg-1 tabular">{value}</p>
      {subtitle && <p className="mt-1 text-caption text-fg-3">{subtitle}</p>}
      {percent !== undefined && (
        <Progress value={percent} metric={metric} className="mt-3" aria-label={`${title} usage`} />
      )}
    </motion.div>
  );
});
