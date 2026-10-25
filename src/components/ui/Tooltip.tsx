import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/utils/cn";

export const TooltipProvider = TooltipPrimitive.Provider;

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  shortcut?: string;
  delay?: number;
  disabled?: boolean;
}

/** Inverted tooltip (fg on surface) so it reads in both themes. */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  side = "top",
  shortcut,
  delay = 350,
  disabled,
}) => {
  if (disabled) return children;
  return (
    <TooltipPrimitive.Root delayDuration={delay}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={8}
          collisionPadding={8}
          className={cn(
            "z-[200] flex max-w-xs items-center gap-2 rounded-chip bg-fg-1 px-2.5 py-1.5 text-caption font-medium text-surface-raised shadow-[var(--shadow-4)]",
            "data-[state=delayed-open]:animate-[ds-pop-in_var(--dur-fast)_var(--ease-out)] data-[state=instant-open]:animate-[ds-pop-in_var(--dur-fast)_var(--ease-out)]",
          )}
        >
          <span>{content}</span>
          {shortcut && (
            <kbd className="rounded-tiny bg-surface-raised/15 px-1.5 font-sans text-[10px] font-semibold tracking-wide text-surface-raised/80">
              {shortcut}
            </kbd>
          )}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
};
