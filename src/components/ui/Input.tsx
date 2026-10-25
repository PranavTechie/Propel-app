import React from "react";
import { cn } from "@/utils/cn";

/** Shared field chrome for Input / Select. */
export const fieldClasses = cn(
  "h-9 w-full rounded-control border bg-surface-raised px-3 text-body text-fg-1",
  "border-line-strong shadow-[inset_0_1px_1px_rgb(var(--c-line)/.05)]",
  "placeholder:text-fg-4",
  "transition-[border-color,box-shadow] duration-fast ease-out",
  "hover:border-[rgb(var(--c-line)/calc(var(--a-line-3)*1.6))]",
  "focus:outline-none focus:border-brand focus-visible:shadow-ring focus:shadow-ring",
  "disabled:cursor-not-allowed disabled:bg-surface-inset disabled:text-fg-4",
  "aria-[invalid=true]:border-danger aria-[invalid=true]:focus:shadow-[0_0_0_2px_rgb(var(--c-surface-raised)),0_0_0_4px_rgb(var(--c-danger)/.4)]",
);

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, invalid, ...props }, ref) => (
    <div className="relative w-full">
      {icon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3 [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </span>
      )}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(fieldClasses, icon && "pl-9", className)}
        {...props}
      />
    </div>
  ),
);
Input.displayName = "Input";

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}

/** Label + control + hint/error, with consistent spacing. */
export const Field: React.FC<FieldProps> = ({ label, htmlFor, hint, error, children, className }) => (
  <div className={cn("space-y-1.5", className)}>
    <label htmlFor={htmlFor} className="block text-body-sm font-medium text-fg-2">
      {label}
    </label>
    {children}
    {error ? (
      <p role="alert" className="text-caption text-danger-fg">
        {error}
      </p>
    ) : hint ? (
      <p className="text-caption text-fg-3">{hint}</p>
    ) : null}
  </div>
);
