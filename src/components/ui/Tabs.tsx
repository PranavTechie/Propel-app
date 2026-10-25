import React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/utils/cn";

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex items-center gap-0.5 rounded-control border border-line-subtle bg-surface-inset p-[3px]",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex h-7 items-center gap-1.5 rounded-[7px] px-3 text-body-sm font-medium text-fg-3",
      "transition-[background-color,color,box-shadow] duration-fast ease-out",
      "hover:text-fg-1",
      "data-[state=active]:bg-surface-raised data-[state=active]:text-fg-1 data-[state=active]:shadow-[var(--shadow-1),var(--highlight-top)]",
      "focus-visible:outline-none focus-visible:shadow-ring disabled:pointer-events-none disabled:opacity-50",
      "[&>svg]:h-3.5 [&>svg]:w-3.5",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("mt-4 focus-visible:outline-none data-[state=active]:animate-[ds-fade-in_var(--dur-base)_var(--ease-out)]", className)}
    {...props}
  />
));
TabsContent.displayName = "TabsContent";
