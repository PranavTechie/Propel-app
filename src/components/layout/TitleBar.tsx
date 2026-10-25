import React, { memo } from "react";
import { Minus, Square, X, Leaf } from "lucide-react";
import { cn } from "@/utils/cn";
import { usageTone, type UsageMetric } from "@/theme/thresholds";
import { TONE_DOT, TONE_TEXT } from "@/components/ui/tone";
import { Tooltip } from "@/components/ui/Tooltip";
import { useGatedStore } from "@/components/ui/hooks/useGatedStore";

const Chip = memo<{ label: string; metric: UsageMetric; value: number | null; title: string }>(
  ({ label, metric, value, title }) => {
    const tone = usageTone(metric, value);
    const elevated = tone === "warning" || tone === "critical";
    return (
      <Tooltip content={title} side="bottom">
        <div
          role="group"
          className="no-drag flex h-7 items-center gap-2 rounded-full border border-line-subtle bg-surface-raised/70 px-2.5 text-caption shadow-[var(--highlight-top)]"
          aria-label={`${title}: ${value == null ? "reading" : `${Math.round(value)}%`}`}
        >
          <span
            aria-hidden
            className={cn("h-1.5 w-1.5 rounded-full transition-colors duration-base", TONE_DOT[tone])}
          />
          <span className="font-medium text-fg-3">{label}</span>
          <span
            className={cn(
              "min-w-[30px] text-right font-semibold tabular",
              elevated ? TONE_TEXT[tone] : "text-fg-1",
            )}
          >
            {value == null ? "--" : `${Math.round(value)}%`}
          </span>
        </div>
      </Tooltip>
    );
  },
);
Chip.displayName = "Chip";

const Control: React.FC<{
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}> = ({ label, onClick, danger, children }) => (
  <button
    aria-label={label}
    title={label}
    onClick={onClick}
    className={cn(
      "flex h-full w-[46px] items-center justify-center text-fg-2 transition-colors duration-fast",
      "focus-visible:shadow-[inset_0_0_0_2px_rgb(var(--c-brand)/.5)]",
      danger
        ? "hover:bg-danger hover:text-fg-on-danger active:bg-danger/85"
        : "hover:bg-state/[var(--a-hover)] hover:text-fg-1 active:bg-state/[var(--a-pressed)]",
    )}
  >
    {children}
  </button>
);

export const TitleBar: React.FC = () => {
  const stats = useGatedStore((s) => s.stats);
  return (
    <header className="drag-region relative z-20 flex h-11 shrink-0 items-center border-b border-line-subtle bg-surface-chrome pl-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-brand-solid bg-[linear-gradient(180deg,rgb(var(--c-brand-solid-top)),rgb(var(--c-brand-solid)))] text-fg-on-brand shadow-[var(--shadow-brand),var(--highlight-brand)]">
          <Leaf className="h-4 w-4" strokeWidth={2.25} />
        </div>
        <div className="leading-none">
          <p className="text-[13px] font-bold tracking-[-.01em] text-fg-1">PROPEL</p>
          <p className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-[.14em] text-fg-3">
            System care
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center gap-2">
        <Chip label="CPU" metric="cpu" value={stats?.cpu ?? null} title="Processor load" />
        <Chip label="Mem" metric="memory" value={stats?.ram.percent ?? null} title="Memory in use" />
        <Chip label="Disk" metric="disk" value={stats?.disk.percent ?? null} title="System disk used" />
      </div>

      <div className="no-drag flex h-full items-center">
        <Control label="Minimize" onClick={() => window.electronAPI?.window.minimize()}>
          <Minus className="h-4 w-4" strokeWidth={1.5} />
        </Control>
        <Control label="Maximize or restore" onClick={() => window.electronAPI?.window.maximize()}>
          <Square className="h-3 w-3" strokeWidth={1.75} />
        </Control>
        <Control label="Close" danger onClick={() => window.electronAPI?.window.close()}>
          <X className="h-4 w-4" strokeWidth={1.5} />
        </Control>
      </div>
    </header>
  );
};
