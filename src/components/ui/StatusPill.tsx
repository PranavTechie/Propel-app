import React from "react";
import { cn } from "@/utils/cn";
import { TONE_LABEL, type Tone } from "@/theme/thresholds";
import { TONE_DOT, TONE_SOFT } from "./tone";

interface StatusPillProps {
  tone: Tone;
  children?: React.ReactNode;
  /** Optional leading icon; replaces the tone dot. */
  icon?: React.ReactNode;
  className?: string;
}

/** Tone dot + text label. Status never relies on color alone. */
export const StatusPill: React.FC<StatusPillProps> = ({ tone, children, icon, className }) => (
  <span
    className={cn(
      "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 text-[11px] font-semibold leading-none",
      TONE_SOFT[tone],
      className,
    )}
  >
    {icon ?? <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[tone])} />}
    {children ?? TONE_LABEL[tone]}
  </span>
);
