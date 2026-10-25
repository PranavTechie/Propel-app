// Display-only tone thresholds. These decide colors in the UI (healthy /
// warning / critical). They are NOT plan gating and do not affect behavior.

export type Tone = "healthy" | "warning" | "critical" | "neutral";
export type UsageMetric = "cpu" | "memory" | "disk";

// Warn levels match the previous TitleBar; critical levels added on top.
const USAGE_LIMITS: Record<UsageMetric, { warn: number; crit: number }> = {
  cpu: { warn: 75, crit: 90 },
  memory: { warn: 80, crit: 90 },
  disk: { warn: 85, crit: 95 },
};

/** Tone for a resource usage percentage (higher is worse). */
export function usageTone(metric: UsageMetric, pct: number | null | undefined): Tone {
  if (pct == null || Number.isNaN(pct)) return "neutral";
  const { warn, crit } = USAGE_LIMITS[metric];
  if (pct >= crit) return "critical";
  if (pct >= warn) return "warning";
  return "healthy";
}

/** Tone for a 0-100 health score (higher is better). Matches the Sidebar. */
export function scoreTone(score: number | null | undefined): Tone {
  if (score == null || Number.isNaN(score)) return "neutral";
  if (score >= 75) return "healthy";
  if (score >= 45) return "warning";
  return "critical";
}

/** Short human label for a tone, so status never relies on color alone. */
export const TONE_LABEL: Record<Tone, string> = {
  healthy: "Healthy",
  warning: "Elevated",
  critical: "Critical",
  neutral: "Reading",
};

/** CSS color channel var per tone, for SVG strokes and inline styles. */
export const TONE_VAR: Record<Tone, string> = {
  healthy: "--c-success",
  warning: "--c-warning",
  critical: "--c-danger",
  neutral: "--c-fg-4",
};

export const toneColor = (tone: Tone, alpha = 1) =>
  `rgb(var(${TONE_VAR[tone]}) / ${alpha})`;
