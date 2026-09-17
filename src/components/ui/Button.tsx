import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/utils/cn";
type Variant =
  "primary" | "secondary" | "ghost" | "danger" | "success" | "outline";
type Size = "sm" | "md" | "lg" | "icon";
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}
const variants: Record<Variant, string> = {
  primary:
    "bg-brand-primary text-white border border-brand-secondary/30 shadow-[var(--t-btn-shadow)] hover:bg-brand-secondary",
  secondary:
    "bg-bg-elevated text-text-primary border border-border/80 shadow-sm hover:border-brand-primary/35 hover:bg-brand-primary/[.04]",
  ghost:
    "bg-transparent text-text-secondary border border-transparent hover:bg-brand-primary/[.06] hover:text-text-primary",
  danger:
    "bg-red-600 text-white border border-red-700/30 shadow-sm hover:bg-red-700",
  success:
    "bg-brand-secondary text-white border border-brand-secondary shadow-sm hover:bg-brand-primary",
  outline:
    "bg-transparent text-brand-secondary border border-brand-primary/45 hover:bg-brand-primary/[.07]",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-lg",
  lg: "h-11 px-5 text-sm gap-2.5 rounded-lg",
  icon: "h-10 w-10 p-0 rounded-lg",
};
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading,
      icon,
      iconRight,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const off = disabled || loading;
    return (
      <motion.button
        ref={ref}
        whileHover={off ? {} : { y: -1 }}
        whileTap={off ? {} : { scale: 0.98 }}
        transition={{ duration: 0.12 }}
        className={cn(
          "relative inline-flex items-center justify-center font-semibold tracking-[-.01em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45",
          variants[variant],
          sizes[size],
          className,
        )}
        disabled={off}
        {...(props as React.ComponentProps<typeof motion.button>)}
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
        ) : (
          <>
            {icon && <span className="shrink-0">{icon}</span>}
            {children && <span>{children}</span>}
            {iconRight && <span className="shrink-0">{iconRight}</span>}
          </>
        )}
      </motion.button>
    );
  },
);
Button.displayName = "Button";
