import type { Tone } from "@/theme/thresholds";

/** Tailwind class sets per tone. All map to tokens. */
export const TONE_TEXT: Record<Tone, string> = {
  healthy: "text-success-fg",
  warning: "text-warning-fg",
  critical: "text-danger-fg",
  neutral: "text-fg-3",
};

export const TONE_SOFT: Record<Tone, string> = {
  healthy: "bg-success-soft text-success-fg",
  warning: "bg-warning-soft text-warning-fg",
  critical: "bg-danger-soft text-danger-fg",
  neutral: "bg-surface-inset text-fg-3",
};

export const TONE_DOT: Record<Tone, string> = {
  healthy: "bg-success",
  warning: "bg-warning",
  critical: "bg-danger",
  neutral: "bg-fg-4",
};
