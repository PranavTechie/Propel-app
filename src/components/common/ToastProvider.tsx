import React, { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useAppStore, selectToasts } from '@/store/appStore'
import type { ToastMessage } from '@/types'
import { cn } from '@/utils/cn'

const iconMap = {
  success: <CheckCircle2 className="w-4 h-4" />,
  error: <XCircle className="w-4 h-4" />,
  warning: <AlertTriangle className="w-4 h-4" />,
  info: <Info className="w-4 h-4" />,
}

const colorMap = {
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  error: 'border-red-500/30 bg-red-500/10 text-red-400',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  info: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
}

const ToastItem: React.FC<{ toast: ToastMessage }> = ({ toast }) => {
  const removeToast = useAppStore(s => s.removeToast)
  const colors = colorMap[toast.type]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={cn(
        'relative flex items-start gap-3 p-4 rounded-2xl border backdrop-blur-xl',
        'shadow-card min-w-[300px] max-w-[400px]',
        'bg-bg-surface',
        'border-border',
      )}
    >
      <div className={cn('p-1.5 rounded-lg shrink-0', colors)}>{iconMap[toast.type]}</div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm font-semibold text-text-primary">{toast.title}</p>
        {toast.description && (
          <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{toast.description}</p>
        )}
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        className="p-1 rounded-lg text-text-muted hover:text-text-secondary hover:bg-white/5 transition-colors shrink-0 mt-0.5"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  )
}

export const ToastProvider: React.FC = () => {
  const toasts       = useAppStore(selectToasts)

  return (
    <div className={cn('fixed z-[9999] bottom-5 right-5 flex flex-col gap-2 pointer-events-none')}>
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
