import React, { memo, useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { cn } from "@/utils/cn";
import { DUR, EASE_OUT } from "@/theme/motion";
import { useLiveGate } from "./hooks/useLiveGate";

interface CountUpProps {
  value: number;
  decimals?: number;
  format?: (v: number) => string;
  className?: string;
}

/**
 * Animated number: counts up from 0 on mount, then eases between values.
 * Jumps straight to the value under reduced motion or when not live.
 */
export const CountUp = memo<CountUpProps>(({ value, decimals = 0, format, className }) => {
  const reduce = useReducedMotion();
  const live = useLiveGate();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const shown = useRef(display);

  useEffect(() => {
    if (reduce || !live) {
      shown.current = value;
      setDisplay(value);
      return;
    }
    const controls = animate(shown.current, value, {
      duration: DUR.slow,
      ease: [...EASE_OUT],
      onUpdate: (v) => {
        shown.current = v;
        setDisplay(v);
      },
    });
    return () => controls.stop();
  }, [value, reduce, live]);

  return (
    <span className={cn("tabular", className)}>
      {format ? format(display) : display.toFixed(decimals)}
    </span>
  );
});
CountUp.displayName = "CountUp";
