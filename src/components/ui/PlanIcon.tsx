import React from "react";
import { Crown, User, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

export type PlanId = "FREE" | "PRO" | "MAX";

/**
 * Single source of truth for plan visuals. Every place that shows the
 * user's plan icon renders this component; never copy the mapping.
 * MAX uses a brand-green gradient on purpose: amber means "warning" here.
 */
const MAX_GRADIENT = "bg-[linear-gradient(135deg,rgb(var(--green-700)),rgb(var(--green-400)))]";

const PLAN_VISUAL: Record<
  PlanId,
  { icon: LucideIcon; label: string; badge: string; avatar: string }
> = {
  FREE: {
    icon: User,
    label: "FREE",
    badge: "bg-surface-inset text-fg-3 shadow-[inset_0_0_0_1px_rgb(var(--c-line)/var(--a-line-2))]",
    avatar: "bg-surface-inset text-fg-3 ring-1 ring-line",
  },
  PRO: {
    icon: Zap,
    label: "PRO",
    badge: "bg-brand-solid text-fg-on-brand",
    avatar: "bg-brand-soft text-brand ring-1 ring-brand/20",
  },
  MAX: {
    icon: Crown,
    label: "MAX",
    badge: `${MAX_GRADIENT} text-fg-on-brand`,
    avatar: `${MAX_GRADIENT} text-fg-on-brand ring-1 ring-brand/30`,
  },
};

/** Normalizes whatever the entitlement carries; unknown values fall back to FREE. */
export function toPlanId(plan: string | null | undefined): PlanId {
  return plan === "PRO" || plan === "MAX" ? plan : "FREE";
}

interface PlanIconProps {
  plan: PlanId | string | null | undefined;
  /** Outer size in px (circle diameter, or glyph size for "glyph"). */
  size?: number;
  /**
   * "avatar": account circle with the plan icon inside (Sidebar, Settings).
   * "badge":  small colored disc next to a plan label.
   * "glyph":  icon only in currentColor (inside pills).
   */
  variant?: "avatar" | "badge" | "glyph";
  className?: string;
}

export const PlanIcon: React.FC<PlanIconProps> = ({
  plan,
  size = 14,
  variant = "badge",
  className,
}) => {
  const id = toPlanId(plan);
  const visual = PLAN_VISUAL[id];
  const Icon = visual.icon;

  if (variant === "glyph") {
    return (
      <Icon
        aria-hidden
        strokeWidth={2.4}
        className={cn("shrink-0", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  const isAvatar = variant === "avatar";
  // Avatar: icon ~55% of the circle, stroke 2. Badge: denser glyph.
  const iconSize = Math.round(size * (isAvatar ? 0.55 : 0.58));

  return (
    <span
      role="img"
      aria-label={`${visual.label} plan`}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        isAvatar ? visual.avatar : visual.badge,
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Icon
        aria-hidden
        strokeWidth={isAvatar ? 2 : 2.6}
        style={{ width: iconSize, height: iconSize }}
      />
    </span>
  );
};
