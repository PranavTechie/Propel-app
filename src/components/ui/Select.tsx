import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";
import { fieldClasses } from "./Input";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

/**
 * Styled native select. The popup list follows the token color-scheme.
 * (No Radix Select is installed; a native list keeps full keyboard support
 * without a new dependency.)
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, children, ...props }, ref) => (
    <div className="relative w-full">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(fieldClasses, "cursor-pointer appearance-none pr-9", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3"
      />
    </div>
  ),
);
Select.displayName = "Select";
