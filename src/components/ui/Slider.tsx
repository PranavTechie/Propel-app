import React from "react";
import { cn } from "@/utils/cn";

type SliderProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

/** Styled native range input. Filled portion follows the value. */
export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, style, min = 0, max = 100, value, defaultValue, ...props }, ref) => {
    const lo = Number(min);
    const hi = Number(max);
    const v = Number(value ?? defaultValue ?? lo);
    const pct = hi > lo ? ((v - lo) / (hi - lo)) * 100 : 0;
    return (
      <input
        ref={ref}
        type="range"
        min={min}
        max={max}
        value={value}
        defaultValue={defaultValue}
        className={cn("ds-range", className)}
        style={{ ...style, ["--fill" as string]: `${pct}%` }}
        {...props}
      />
    );
  },
);
Slider.displayName = "Slider";
