import React, { memo } from "react";
import { Minus, Square, X, Leaf, CircleUserRound } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/utils/cn";

const Metric = memo<{ label: string; value: string; warn: boolean }>(
  ({ label, value, warn }) => (
    <div className="flex items-center gap-1.5 text-[11px] tabular-nums">
      <span className="text-text-muted">{label}</span>
      <span
        className={cn(
          "font-semibold",
          warn ? "text-amber-600" : "text-text-primary",
        )}
      >
        {value}
      </span>
    </div>
  ),
);
Metric.displayName = "Metric";

export const TitleBar: React.FC = () => {
  const entitlement = useAppStore((s) => s.entitlementStatus);
  const stats = useAppStore((s) => s.stats);
  const plan = entitlement.trial_active ? "PRO trial" : entitlement.plan;
  const control =
    "flex h-9 w-10 items-center justify-center text-text-muted hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/5";
  return (
    <header className="drag-region relative z-20 flex h-12 shrink-0 items-center border-b border-border/50 bg-bg-surface/90 pl-4 backdrop-blur-xl">
      <div className="no-drag flex w-[232px] items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-primary text-white shadow-sm">
          <Leaf className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[13px] font-bold leading-none tracking-tight text-text-primary">
            PROPEL
          </p>
          <p className="mt-1 text-[9px] font-medium uppercase tracking-[.16em] text-text-muted">
            System care
          </p>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center gap-5">
        {stats && (
          <>
            <Metric
              label="CPU"
              value={`${Math.round(stats.cpu)}%`}
              warn={stats.cpu >= 75}
            />
            <span className="h-3 w-px bg-border/70" />
            <Metric
              label="Memory"
              value={`${Math.round(stats.ram.percent)}%`}
              warn={stats.ram.percent >= 80}
            />
            <span className="h-3 w-px bg-border/70" />
            <Metric
              label="Disk"
              value={`${Math.round(stats.disk.percent)}%`}
              warn={stats.disk.percent >= 85}
            />
          </>
        )}
      </div>
      <div className="no-drag flex items-center">
        <div className="mr-3 flex items-center gap-2 rounded-lg border border-border/60 bg-bg-elevated/60 px-2.5 py-1.5">
          <CircleUserRound className="h-3.5 w-3.5 text-text-muted" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
            {plan}
          </span>
        </div>
        <button
          aria-label="Minimize"
          title="Minimize"
          onClick={() => window.electronAPI?.window.minimize()}
          className={control}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          aria-label="Maximize or restore"
          title="Maximize or restore"
          onClick={() => window.electronAPI?.window.maximize()}
          className={control}
        >
          <Square className="h-3 w-3" />
        </button>
        <button
          aria-label="Close"
          title="Close"
          onClick={() => window.electronAPI?.window.close()}
          className={cn(control, "hover:bg-red-500 hover:text-white")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
};
