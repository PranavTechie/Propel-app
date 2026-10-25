import React from "react";
import { Crown, User, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

export type PlanId = "FREE" | "PRO" | "MAX";

/**
 * Single source of truth for plan visuals. Every place that shows the
 * user's plan icon renders this component; never copy the mapping.
 * MAX uses a brand-green gradient on purpose: amber means "warning" here.
 */
const PLAN_VISUAL: Record<PlanId, { icon: LucideIcon; disc: string; label: string }> = {
  FREE: {
    icon: User,
    disc: "bg-surface-inset text-fg-3 shadow-[inset_0_0_0_1px_rgb(var(--c-line)/var(--a-line-2))]",
    label: "FREE",
  },
  PRO: {
    icon: Zap,
    disc: "bg-brand-solid text-fg-on-brand",
    label: "PRO",
  },
  MAX: {
    icon: Crown,
    disc: "bg-[linear-gradient(135deg,rgb(var(--green-700)),rgb(var(--green-400)))] text-[rgb(var(--neutral-0))]",
    label: "MAX",
  },
};

/** Normalizes whatever the entitlement carries; unknown values fall back to FREE. */
export function toPlanId(plan: string | null | undefined): PlanId {
  return plan === "PRO" || plan === "MAX" ? plan : "FREE";
}

interface PlanIconProps {
  plan: PlanId | string | null | undefined;
  /** Outer size in px (disc diameter for "badge", glyph size for "glyph"). */
  size?: number;
  /**
   * "badge": colored disc with the icon (avatar corner, standalone).
   * "glyph": icon only in currentColor (inside pills and text labels).
   */
  variant?: "badge" | "glyph";
  /** Ring that separates the badge from what it sits on, e.g. "ring-surface-chrome". */
  ringClassName?: string;
  className?: string;
}

export const PlanIcon: React.FC<PlanIconProps> = ({
  plan,
  size = 14,
  variant = "badge",
  ringClassName,
  className,
}) => {
  const id = toPlanId(plan);
  const { icon: Icon, disc, label } = PLAN_VISUAL[id];

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

  return (
    <span
      role="img"
      aria-label={`${label} plan`}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        disc,
        ringClassName && cn("ring-2", ringClassName),
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Icon
        aria-hidden
        strokeWidth={2.6}
        style={{ width: Math.round(size * 0.58), height: Math.round(size * 0.58) }}
      />
    </span>
  );
};

interface AccountAvatarProps {
  /** Email or name; the first letter becomes the initial. */
  identity?: string | null;
  plan: PlanId | string | null | undefined;
  size?: number;
  /** Background of the surface the avatar sits on, used for the badge ring. */
  ringClassName?: string;
  className?: string;
}

/** Initial-letter avatar with the plan badge on its bottom-right corner. */
export const AccountAvatar: React.FC<AccountAvatarProps> = ({
  identity,
  plan,
  size = 32,
  ringClassName = "ring-surface-raised",
  className,
}) => {
  const initial = (identity?.trim()?.[0] ?? "P").toUpperCase();
  const badge = size >= 40 ? 16 : 14;
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      <span
        className="flex h-full w-full items-center justify-center rounded-full bg-brand-soft font-bold text-brand-fg ring-1 ring-brand/20"
        style={{ fontSize: Math.round(size * 0.4) }}
      >
        {initial}
      </span>
      <PlanIcon
        plan={plan}
        size={badge}
        ringClassName={ringClassName}
        className="absolute -bottom-0.5 -right-0.5"
      />
    </span>
  );
};
