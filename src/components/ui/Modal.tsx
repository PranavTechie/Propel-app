import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, AlertTriangle } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "./Button";

type ModalTone = "neutral" | "brand" | "danger" | "warning";

const ICON_TONE: Record<ModalTone, string> = {
  neutral: "bg-surface-inset text-fg-2",
  brand: "bg-brand-soft text-brand-fg",
  danger: "bg-danger-soft text-danger-fg",
  warning: "bg-warning-soft text-warning-fg",
};

const SIZE = { sm: "max-w-[400px]", md: "max-w-[480px]", lg: "max-w-[640px]" } as const;

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: ModalTone;
  size?: keyof typeof SIZE;
  /** false while an operation runs: blocks Esc, outside click and the X. */
  dismissible?: boolean;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Modal dialog: solid scrim (no blur), scale + fade in, focus trap,
 * Esc to close. Built on Radix Dialog.
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onOpenChange,
  title,
  description,
  icon,
  tone = "neutral",
  size = "md",
  dismissible = true,
  footer,
  children,
  className,
}) => {
  const block = (e: Event) => {
    if (!dismissible) e.preventDefault();
  };
  return (
    <Dialog.Root open={open} onOpenChange={(v) => {
      if (dismissible || v) onOpenChange(v);
    }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-[rgb(var(--c-scrim)/var(--a-scrim))] data-[state=open]:animate-[ds-fade-in_var(--dur-base)_var(--ease-out)] data-[state=closed]:animate-[ds-fade-out_var(--dur-fast)_var(--ease-out)]" />
        <div className="pointer-events-none fixed inset-0 z-[101] grid place-items-center p-6">
          <Dialog.Content
            onEscapeKeyDown={block}
            onPointerDownOutside={block}
            onInteractOutside={block}
            className={cn(
              "pointer-events-auto relative flex max-h-[min(86vh,760px)] w-full flex-col overflow-hidden rounded-panel border border-line bg-surface-overlay shadow-[var(--shadow-3),var(--highlight-top)]",
              "focus-visible:outline-none",
              "data-[state=open]:animate-[ds-pop-in_var(--dur-base)_var(--ease-out)] data-[state=closed]:animate-[ds-pop-out_var(--dur-fast)_var(--ease-out)]",
              SIZE[size],
              className,
            )}
          >
            <div className="flex items-start gap-3.5 px-5 pb-4 pt-5">
              {icon && (
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-control [&>svg]:h-5 [&>svg]:w-5",
                    ICON_TONE[tone],
                  )}
                >
                  {icon}
                </div>
              )}
              <div className="min-w-0 flex-1 pt-0.5">
                <Dialog.Title className="text-title font-semibold text-fg-1">{title}</Dialog.Title>
                {description ? (
                  <Dialog.Description className="mt-1 text-body text-fg-2">
                    {description}
                  </Dialog.Description>
                ) : (
                  <Dialog.Description className="sr-only">{title}</Dialog.Description>
                )}
              </div>
              {dismissible && (
                <Dialog.Close asChild>
                  <Button variant="ghost" size="icon" aria-label="Close" className="-mr-2 -mt-1 h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                </Dialog.Close>
              )}
            </div>
            {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>}
            {footer && (
              <div className="flex items-center justify-end gap-2 border-t border-line-subtle bg-surface-inset/60 px-5 py-3">
                {footer}
              </div>
            )}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export interface AffectedItem {
  id?: string;
  label: React.ReactNode;
  meta?: React.ReactNode;
  icon?: React.ReactNode;
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** The exact items this action affects. Shown as a scrollable list. */
  items?: AffectedItem[];
  /** e.g. "12 items · 1.4 GB" shown above the list. */
  summary?: React.ReactNode;
  note?: React.ReactNode;
  tone?: "danger" | "brand" | "warning";
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  loading?: boolean;
  icon?: React.ReactNode;
}

/** Confirmation for destructive actions, listing the affected items. */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  items,
  summary,
  note,
  tone = "danger",
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  loading,
  icon,
}) => (
  <Modal
    open={open}
    onOpenChange={onOpenChange}
    title={title}
    description={description}
    tone={tone}
    icon={icon ?? <AlertTriangle />}
    dismissible={!loading}
    footer={
      <>
        <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant={tone === "danger" ? "danger" : "primary"}
          onClick={onConfirm}
          loading={loading}
          autoFocus
        >
          {confirmLabel}
        </Button>
      </>
    }
  >
    {items && items.length > 0 && (
      <div className="overflow-hidden rounded-card border border-line-subtle bg-surface-inset">
        {summary && (
          <div className="border-b border-line-subtle px-3.5 py-2 text-caption font-semibold text-fg-2 tabular">
            {summary}
          </div>
        )}
        <ul className="max-h-56 divide-y divide-line-subtle overflow-y-auto">
          {items.map((item, i) => (
            <li key={item.id ?? i} className="flex items-center gap-3 px-3.5 py-2">
              {item.icon && (
                <span className="shrink-0 text-fg-3 [&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>
              )}
              <span className="min-w-0 flex-1 truncate text-body-sm text-fg-1">{item.label}</span>
              {item.meta && (
                <span className="shrink-0 text-caption text-fg-3 tabular">{item.meta}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    )}
    {note && <p className="mt-3 text-body-sm text-fg-3">{note}</p>}
  </Modal>
);

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  width?: number;
}

/** Side panel that slides in from the right. Same focus/Esc behavior as Modal. */
export const Sheet: React.FC<SheetProps> = ({
  open,
  onOpenChange,
  title,
  description,
  icon,
  footer,
  children,
  width = 380,
}) => (
  <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[120] bg-[rgb(var(--c-scrim)/var(--a-scrim))] data-[state=open]:animate-[ds-fade-in_var(--dur-base)_var(--ease-out)] data-[state=closed]:animate-[ds-fade-out_var(--dur-fast)_var(--ease-out)]" />
      <Dialog.Content
        className="fixed inset-y-0 right-0 z-[121] flex flex-col border-l border-line bg-surface-overlay shadow-[var(--shadow-3)] focus-visible:outline-none data-[state=open]:animate-[ds-slide-in_var(--dur-slow)_var(--ease-out)] data-[state=closed]:animate-[ds-slide-out_var(--dur-base)_var(--ease-out)]"
        style={{ width }}
      >
        <div className="flex items-center gap-3 border-b border-line-subtle px-5 py-4">
          {icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-fg [&>svg]:h-4 [&>svg]:w-4">
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <Dialog.Title className="text-title font-semibold text-fg-1">{title}</Dialog.Title>
            {description ? (
              <Dialog.Description className="truncate text-caption text-fg-3">
                {description}
              </Dialog.Description>
            ) : (
              <Dialog.Description className="sr-only">{title}</Dialog.Description>
            )}
          </div>
          <Dialog.Close asChild>
            <Button variant="ghost" size="icon" aria-label="Close" className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </Dialog.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer && <div className="border-t border-line-subtle px-4 py-3">{footer}</div>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);
