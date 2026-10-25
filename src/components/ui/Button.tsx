import React from "react";
import { cn } from "@/utils/cn";

type Variant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  // legacy aliases
  | "success"
  | "outline";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

// State layer: a token-colored overlay whose opacity changes on hover/press.
// Works on every variant and in both themes.
const stateLayer =
  "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-state after:opacity-0 after:transition-opacity after:duration-fast hover:after:opacity-[var(--a-hover)] active:after:opacity-[var(--a-pressed)]";

const primary =
  "text-fg-on-brand bg-brand-solid bg-[linear-gradient(180deg,rgb(var(--c-brand-solid-top)),rgb(var(--c-brand-solid)))] shadow-[var(--shadow-brand),var(--highlight-brand)] hover:bg-[linear-gradient(180deg,rgb(var(--c-brand-solid)),rgb(var(--c-brand-solid-hover)))]";

const variants: Record<Variant, string> = {
  primary,
  success: primary,
  secondary:
    "bg-surface-raised text-fg-1 border border-line-strong shadow-[var(--shadow-1),var(--highlight-top)]",
  ghost: "bg-transparent text-fg-2 hover:text-fg-1",
  outline: "bg-transparent text-brand-fg border border-brand/40",
  danger:
    "text-fg-on-danger bg-danger shadow-[0_1px_2px_rgb(var(--c-danger)/.25),0_4px_12px_-2px_rgb(var(--c-danger)/.3),var(--highlight-brand)]",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-body-sm gap-1.5 rounded-control",
  md: "h-9 px-4 text-body gap-2 rounded-control",
  lg: "h-10 px-5 text-body gap-2 rounded-control",
  icon: "h-9 w-9 p-0 rounded-control",
};

const Spinner = () => (
  <span
    aria-hidden
    className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent"
  />
);

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
      type = "button",
      ...props
    },
    ref,
  ) => {
    const off = disabled || loading;
    return (
      <button
        ref={ref}
        type={type}
        disabled={off}
        aria-busy={loading || undefined}
        className={cn(
          "group/btn relative isolate inline-flex select-none items-center justify-center whitespace-nowrap font-semibold tracking-[-.006em]",
          "transition-[transform,box-shadow,background-color,color,opacity] duration-fast ease-out",
          "active:scale-[.98] focus-visible:outline-none focus-visible:shadow-ring",
          "disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
          stateLayer,
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <Spinner />
        ) : (
          icon && (
            <span className="inline-flex shrink-0 transition-transform duration-fast ease-out [&>svg]:h-4 [&>svg]:w-4">
              {icon}
            </span>
          )
        )}
        {children !== undefined && children !== null && (
          <span className="truncate">{children}</span>
        )}
        {iconRight && !loading && (
          <span className="inline-flex shrink-0 transition-transform duration-fast ease-out group-hover/btn:translate-x-0.5 [&>svg]:h-4 [&>svg]:w-4">
            {iconRight}
          </span>
        )}
      </button>
    );
  },
);
Button.displayName = "Button";
