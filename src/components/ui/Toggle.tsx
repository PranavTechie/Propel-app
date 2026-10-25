import React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/utils/cn";

interface ToggleProps
  extends Omit<React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>, "children"> {
  size?: "sm" | "md";
}

/** Switch with an animated thumb. Use for instant on/off settings. */
export const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  ({ className, size = "md", ...props }, ref) => (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        "group/toggle relative inline-flex shrink-0 cursor-pointer items-center rounded-full border transition-[background-color,border-color,box-shadow] duration-base ease-out",
        "border-line-strong bg-surface-inset hover:border-[rgb(var(--c-line)/calc(var(--a-line-3)*1.6))]",
        "data-[state=checked]:border-transparent data-[state=checked]:bg-brand-solid data-[state=checked]:hover:bg-brand-solid-hover",
        "focus-visible:outline-none focus-visible:shadow-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "md" ? "h-5 w-9" : "h-4 w-7",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block rounded-full bg-surface-raised shadow-[var(--shadow-1)] transition-transform duration-base ease-out",
          "group-active/toggle:scale-95",
          size === "md"
            ? "h-4 w-4 translate-x-[1px] data-[state=checked]:translate-x-[17px]"
            : "h-3 w-3 translate-x-[1px] data-[state=checked]:translate-x-[13px]",
        )}
      />
    </SwitchPrimitive.Root>
  ),
);
Toggle.displayName = "Toggle";
