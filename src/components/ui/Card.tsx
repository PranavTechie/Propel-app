import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/utils/cn";

/**
 * Surface levels:
 *  inset    - recessed well (lists inside cards, tracks)
 *  flat     - raised tone, hairline border, no shadow (dense secondary info)
 *  raised   - default card
 *  elevated - emphasised card
 *  feature  - the one hero per screen: larger radius, brand top hairline
 */
export type CardLevel = "inset" | "flat" | "raised" | "elevated" | "feature";

interface SurfaceOptions {
  level?: CardLevel;
  interactive?: boolean;
  // legacy props
  hover?: boolean;
  glow?: boolean;
  elevated?: boolean;
}

const LEVEL: Record<CardLevel, string> = {
  inset: "rounded-card bg-surface-inset border border-line-subtle",
  flat: "rounded-card bg-surface-raised border border-line-subtle",
  raised:
    "rounded-card bg-surface-raised border border-line shadow-[var(--shadow-1),var(--highlight-top)]",
  elevated:
    "rounded-card bg-surface-raised border border-line shadow-[var(--shadow-2),var(--highlight-top)]",
  feature:
    "overflow-hidden rounded-panel bg-surface-raised border border-line shadow-[var(--shadow-2),var(--highlight-top)] before:pointer-events-none before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgb(var(--c-brand)/.55),transparent)]",
};

export function surfaceClasses(
  { level, interactive, hover, glow, elevated }: SurfaceOptions,
  className?: string,
) {
  const resolved: CardLevel = level ?? (elevated ? "elevated" : "raised");
  return cn(
    "relative",
    LEVEL[resolved],
    (interactive || hover) &&
      "cursor-pointer transition-[transform,box-shadow,border-color] duration-base ease-out hover:-translate-y-px hover:border-line-strong hover:shadow-[var(--shadow-2),var(--highlight-top)]",
    glow && "ring-4 ring-brand/10",
    className,
  );
}

interface CardProps extends React.HTMLAttributes<HTMLDivElement>, SurfaceOptions {
  as?: "div" | "motion";
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    { className, level, interactive, hover, glow, elevated, as: _as, children, ...props },
    ref,
  ) => (
    <div
      ref={ref}
      className={surfaceClasses({ level, interactive, hover, glow, elevated }, className)}
      {...props}
    >
      {children}
    </div>
  ),
);
Card.displayName = "Card";

interface MotionCardProps
  extends React.ComponentProps<typeof motion.div>,
    SurfaceOptions {}

export const MotionCard: React.FC<MotionCardProps> = ({
  className,
  level,
  interactive,
  hover,
  glow,
  elevated,
  children,
  ...props
}) => (
  <motion.div
    className={surfaceClasses({ level, interactive, hover, glow, elevated }, className)}
    {...props}
  >
    {children}
  </motion.div>
);

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex items-center justify-between gap-4 px-5 pb-3 pt-4", className)}
    {...props}
  />
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => <div className={cn("px-5 pb-5", className)} {...props} />;

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  ...props
}) => (
  <h3
    className={cn("text-title font-semibold text-fg-1", className)}
    {...props}
  />
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  ...props
}) => <p className={cn("text-body-sm text-fg-3", className)} {...props} />;

/** Small uppercase eyebrow used above card titles. */
export const CardEyebrow: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  ...props
}) => <p className={cn("section-label", className)} {...props} />;
