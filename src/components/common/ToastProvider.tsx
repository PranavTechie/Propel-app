import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useAppStore, selectToasts } from '@/store/appStore'
import type { ToastMessage } from '@/types'
import { cn } from '@/utils/cn'
import { DUR, EASE_OUT } from '@/theme/motion'

const iconMap = {
  success: <CheckCircle2 className="h-4 w-4" />,
  error: <XCircle className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
}

const toneMap = {
  success: { icon: 'bg-success-soft text-success-fg', bar: 'bg-success' },
  error: { icon: 'bg-danger-soft text-danger-fg', bar: 'bg-danger' },
  warning: { icon: 'bg-warning-soft text-warning-fg', bar: 'bg-warning' },
  info: { icon: 'bg-surface-inset text-fg-2', bar: 'bg-fg-4' },
}

const ToastItem: React.FC<{ toast: ToastMessage }> = ({ toast }) => {
  const removeToast = useAppStore(s => s.removeToast)
  const tone = toneMap[toast.type]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: DUR.base, ease: EASE_OUT } }}
      exit={{ opacity: 0, x: 24, transition: { duration: DUR.fast } }}
      role={toast.type === 'error' ? 'alert' : 'status'}
      className={cn(
        'relative flex w-[360px] items-start gap-3 overflow-hidden rounded-card border border-line',
        'bg-surface-popover py-3 pl-4 pr-3 shadow-[var(--shadow-4),var(--highlight-top)]',
      )}
    >
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-[3px]', tone.bar)} />
      <div className={cn('mt-0.5 shrink-0 rounded-chip p-1.5', tone.icon)}>{iconMap[toast.type]}</div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-body font-semibold text-fg-1">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-body-sm text-fg-2">{toast.description}</p>
        )}
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        aria-label="Dismiss notification"
        className="mt-0.5 shrink-0 rounded-chip p-1.5 text-fg-3 hover:bg-state/[var(--a-hover)] hover:text-fg-1 focus-visible:shadow-ring"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  )
}

export const ToastProvider: React.FC = () => {
  const toasts = useAppStore(selectToasts)

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-[9999] flex flex-col gap-2"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
