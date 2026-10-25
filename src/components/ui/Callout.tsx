import React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/utils/cn";

type CalloutTone = "info" | "success" | "warning" | "danger" | "brand";

const TONE: Record<CalloutTone, { box: string; icon: string }> = {
  info: { box: "bg-surface-inset border-line-subtle", icon: "text-fg-3" },
  success: { box: "bg-success-soft border-success/20", icon: "text-success-fg" },
  warning: { box: "bg-warning-soft border-warning/25", icon: "text-warning-fg" },
  danger: { box: "bg-danger-soft border-danger/25", icon: "text-danger-fg" },
  brand: { box: "bg-brand-soft border-brand/20", icon: "text-brand-fg" },
};

const DEFAULT_ICON: Record<CalloutTone, React.ReactNode> = {
  info: <Info />,
  success: <CheckCircle2 />,
  warning: <AlertTriangle />,
  danger: <XCircle />,
  brand: <Info />,
};

interface CalloutProps {
  tone?: CalloutTone;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  compact?: boolean;
  className?: string;
  role?: string;
}

/** Inline notice: info, success, warning or error. Text stays readable in both themes. */
export const Callout: React.FC<CalloutProps> = ({
  tone = "info",
  title,
  icon,
  action,
  children,
  compact = false,
  className,
  role,
}) => (
  <div
    role={role ?? (tone === "danger" ? "alert" : undefined)}
    className={cn(
      "flex items-start gap-2.5 rounded-control border",
      compact ? "px-3 py-2 text-body-sm" : "px-3.5 py-3 text-body-sm",
      TONE[tone].box,
      className,
    )}
  >
    <span className={cn("mt-px shrink-0 [&>svg]:h-4 [&>svg]:w-4", TONE[tone].icon)}>
      {icon ?? DEFAULT_ICON[tone]}
    </span>
    <div className="min-w-0 flex-1 text-fg-2">
      {title && <p className="font-semibold text-fg-1">{title}</p>}
      {children && <div className={cn(title && "mt-0.5")}>{children}</div>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);
