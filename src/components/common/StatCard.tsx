import React, { useEffect, useRef, memo } from "react";
import { motion, animate } from "framer-motion";
import { cn } from "@/utils/cn";
import { staggerItem } from "@/animations/variants";
function useAnimatedValue(target: number, duration = 0.5) {
  const [display, setDisplay] = React.useState(target);
  const prev = useRef(target);
  useEffect(() => {
    const from = prev.current;
    prev.current = target;
    if (from === target) return;
    const c = animate(from, target, {
      duration,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setDisplay(Math.round(v * 10) / 10),
    });
    return c.stop;
  }, [target, duration]);
  return display;
}
interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  percent?: number;
  color?: "blue" | "purple" | "emerald" | "orange" | "red";
  trend?: "up" | "down" | "stable";
  className?: string;
}
export const StatCard = memo<Props>(function StatCard({
  title,
  value,
  subtitle,
  icon,
  percent,
  className,
}) {
  const safe = Math.min(100, Math.max(0, percent ?? 0));
  const animated = useAnimatedValue(safe);
  return (
    <motion.div
      variants={staggerItem}
      className={cn(
        "group rounded-xl border border-border/70 bg-bg-elevated/75 p-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.13em] text-text-muted">
            {title}
          </p>
          <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-.04em] text-text-primary tabular-nums">
            {value}
          </p>
          {subtitle && (
            <p className="mt-2 text-[11px] text-text-secondary">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/[.08] text-brand-secondary">
            <span className="h-[18px] w-[18px]">{icon}</span>
          </div>
        )}
      </div>
      {percent !== undefined && (
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-[10px] text-text-muted">
            <span>Current load</span>
            <span className="font-semibold tabular-nums text-text-secondary">
              {Math.round(animated)}%
            </span>
          </div>
          <div className="stat-bar">
            <div className="stat-bar-fill" style={{ width: `${animated}%` }} />
          </div>
        </div>
      )}
    </motion.div>
  );
});
