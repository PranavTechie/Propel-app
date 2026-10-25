import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X } from 'lucide-react'
import { Progress } from './Progress'
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
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        className="fixed bottom-6 right-6 z-[150] w-[340px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-card border border-line bg-surface-popover p-4 shadow-[var(--shadow-4),var(--highlight-top)]"
        role="status"
      >
        <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-brand" />
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-fg">
            <Download className="h-4 w-4" />
          </span>

          <button
            className="min-w-0 flex-1 select-none rounded-chip text-left focus-visible:shadow-ring"
            onClick={onOpenModal}
            title="Click to view update details"
          >
            <span className="flex items-center gap-1.5">
              <span className="text-body-sm font-semibold text-fg-1">New update available</span>
              <span className="rounded-tiny bg-brand-soft px-1.5 py-px font-mono text-[10.5px] font-medium text-brand-fg">
                v{state.latestVersion}
              </span>
            </span>
            <span className="mt-1 flex items-center justify-between text-caption text-fg-3 tabular">
              <span className="font-medium text-brand-fg">Downloading... {percent}%</span>
              {speedMbps && <span>{speedMbps} MB/s</span>}
            </span>
            <Progress
              value={Math.min(100, Math.max(0, percent))}
              tone="brand"
              size="sm"
              className="mt-2"
              aria-label="Update download progress"
            />
          </button>

          <button
            onClick={onDismiss}
            aria-label="Hide update notification"
            title="Hide banner (download will continue in background)"
            className="shrink-0 rounded-chip p-1 text-fg-3 transition-colors hover:bg-state/[var(--a-hover)] hover:text-fg-1 focus-visible:shadow-ring"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
