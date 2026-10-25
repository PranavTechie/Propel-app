import React, { useRef } from "react";
import { cn } from "@/utils/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  "aria-label": string;
  className?: string;
}

/**
 * Segmented control (single choice). Same look as TabsList, but with
 * radio-group semantics: arrow keys move the selection.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  ...rest
}: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={rest["aria-label"]}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-control border border-line-subtle bg-surface-inset p-[3px]",
        className,
      )}
    >
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-[7px] px-3.5 text-body font-medium",
              "transition-[background-color,color,box-shadow] duration-fast ease-out",
              "focus-visible:outline-none focus-visible:shadow-ring [&>svg]:h-4 [&>svg]:w-4",
              selected
                ? "bg-surface-raised text-fg-1 shadow-[var(--shadow-1),var(--highlight-top)]"
                : "text-fg-3 hover:text-fg-1",
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
