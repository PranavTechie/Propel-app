import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/utils/cn";

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

/** Custom-drawn checkbox on a real <input>, so forms and keyboard work. */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => (
    <span className={cn("relative inline-flex h-4 w-4 shrink-0", className)}>
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          "peer h-4 w-4 cursor-pointer appearance-none rounded-[5px] border border-line-strong bg-surface-raised",
          "transition-[background-color,border-color,box-shadow] duration-fast ease-out",
          "hover:border-brand/60",
          "checked:border-transparent checked:bg-brand-solid",
          "focus-visible:outline-none focus-visible:shadow-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
        {...props}
      />
      <Check
        aria-hidden
        strokeWidth={3.2}
        className="pointer-events-none absolute inset-0 m-auto h-3 w-3 scale-50 text-fg-on-brand opacity-0 transition-[opacity,transform] duration-fast ease-out peer-checked:scale-100 peer-checked:opacity-100"
      />
    </span>
  ),
);
Checkbox.displayName = "Checkbox";
