import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, X } from 'lucide-react'
import type { UpdateState } from '@/types'

interface UpdateBannerProps {
  state: UpdateState
  visible: boolean
  onDismiss: () => void
  onOpenModal: () => void
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({
  state,
  visible,
  onDismiss,
  onOpenModal,
}) => {
  if (!visible || state.status !== 'downloading') return null

  const percent = state.progress?.percent ?? 0
  const speedMbps = state.progress?.bytesPerSecond
    ? (state.progress.bytesPerSecond / (1024 * 1024)).toFixed(1)
    : null

  return (
    <AnimatePresence>
      <motion.div
        key="update-banner"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        className="fixed bottom-6 right-6 z-[150] w-[340px] max-w-[calc(100vw-3rem)] rounded-2xl bg-bg-surface/95 backdrop-blur-xl border border-brand-primary/30 p-4 shadow-2xl shadow-brand-primary/10 overflow-hidden"
      >
        {/* Glow accent */}
        <div className="absolute -top-10 -right-10 w-28 h-28 bg-brand-primary/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex items-start justify-between gap-3">
          {/* Animated icon */}
          <div className="w-9 h-9 rounded-xl bg-brand-primary/15 border border-brand-primary/30 flex items-center justify-center shrink-0">
            <RefreshCw className="w-4 h-4 text-brand-primary animate-spin" style={{ animationDuration: '3s' }} />
          </div>

          {/* Text & Progress details */}
          <div
            className="flex-1 min-w-0 cursor-pointer select-none"
            onClick={onOpenModal}
            title="Click to view update details"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-text-primary tracking-tight">
                New update available
              </span>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-brand-primary/15 text-brand-primary">
                v{state.latestVersion}
              </span>
            </div>

            <div className="flex items-center justify-between text-2xs text-text-muted mt-1 font-mono">
              <span className="text-brand-primary font-medium">
                Downloading... {percent}%
              </span>
              {speedMbps && (
                <span>{speedMbps} MB/s</span>
              )}
            </div>

            {/* Progress Bar */}
            <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-brand-primary to-emerald-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* Dismiss button (X) — only hides banner, does NOT cancel download */}
          <button
            onClick={onDismiss}
            aria-label="Hide update notification"
            title="Hide banner (download will continue in background)"
            className="text-text-muted hover:text-text-primary hover:bg-white/10 rounded-lg p-1 transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
