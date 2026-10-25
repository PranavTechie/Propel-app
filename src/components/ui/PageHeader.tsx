import React from "react";
import { cn } from "@/utils/cn";

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  eyebrow?: string;
  /** Quiet info shown left of the action (clock, last scan time). */
  meta?: React.ReactNode;
  /** The page's single primary action. Never two buttons for one action. */
  action?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  eyebrow,
  meta,
  action,
  className,
}) => (
  <header className={cn("mb-6 flex items-end justify-between gap-6", className)}>
    <div className="min-w-0">
      {eyebrow && <p className="section-label mb-1.5">{eyebrow}</p>}
      <h1 className="font-display text-h1 font-semibold text-fg-1">{title}</h1>
      {subtitle && <p className="mt-1 truncate text-body text-fg-3">{subtitle}</p>}
    </div>
    {(meta || action) && (
      <div className="flex shrink-0 items-center gap-4">
        {meta && <div className="text-body-sm text-fg-3">{meta}</div>}
        {action}
      </div>
    )}
  </header>
);
