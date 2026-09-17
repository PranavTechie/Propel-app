import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, History, ChevronDown, ChevronRight, Trash2,
  HardDrive, Clock, Files, AlertCircle, Tag,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatBytes } from '@/utils/format'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useCleanerHistoryStore } from '@/store/cleanerHistoryStore'
import type { CleanupReport } from '@/types'

const CATEGORY_LABELS: Record<string, string> = {
  'temp-files':      'Temp Files',
  'browser-cache':   'Browser Cache',
  'recycle-bin':     'Recycle Bin',
  'thumbnail-cache': 'Thumbnail Cache',
  'gpu-cache':       'GPU Cache',
  'crash-dumps':     'Crash Dumps',
  'windows-logs':    'Windows Logs',
}

function formatDuration(ms: number): string {
  if (ms < 1000)  return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0)  return `${d}d ago`
  if (h > 0)  return `${h}h ago`
  if (m > 0)  return `${m}m ago`
  return 'Just now'
}

const HistoryEntry: React.FC<{ report: CleanupReport }> = ({ report }) => {
  const [open, setOpen] = useState(false)
  const date = new Date(report.timestamp)

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        {open
          ? <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text-primary">{formatBytes(report.totalFreed)} freed</span>
            {report.errors > 0 && (
              <span className="text-2xs text-amber-400 flex items-center gap-0.5">
                <AlertCircle className="w-2.5 h-2.5" />
                {report.errors} error{report.errors > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-2xs text-text-muted">
            {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} · {timeAgo(report.timestamp)}
          </p>
        </div>
        <span className="text-2xs font-medium tabular-nums text-emerald-400 shrink-0">
          +{formatBytes(report.totalFreed)}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/30 px-4 py-3 space-y-3">
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: <HardDrive className="w-3 h-3 text-emerald-400" />, label: 'Freed',    value: formatBytes(report.totalFreed) },
                  { icon: <Files className="w-3 h-3 text-brand-primary" />,   label: 'Files',    value: report.filesRemoved.toLocaleString() },
                  { icon: <Clock className="w-3 h-3 text-amber-400" />,       label: 'Duration', value: formatDuration(report.durationMs) },
                ].map(item => (
                  <div key={item.label} className="bg-white/[0.03] rounded-lg px-2.5 py-2 flex items-center gap-1.5">
                    {item.icon}
                    <div>
                      <p className="text-2xs text-text-muted">{item.label}</p>
                      <p className="text-xs font-bold text-text-primary">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Categories */}
              <div>
                <p className="text-2xs text-text-muted mb-1.5 flex items-center gap-1">
                  <Tag className="w-2.5 h-2.5" />
                  Categories cleaned
                </p>
                <div className="flex flex-wrap gap-1">
                  {report.categories.map(cat => (
                    <span
                      key={cat}
                      className="text-2xs px-2 py-0.5 rounded-md bg-brand-primary/10 text-brand-primary font-medium"
                    >
                      {CATEGORY_LABELS[cat] ?? cat}
                    </span>
                  ))}
                </div>
              </div>

              {report.errors > 0 && (
                <p className="text-2xs text-amber-400/80 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {report.errors} file{report.errors > 1 ? 's' : ''} could not be deleted (in use or protected)
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface HistoryPanelProps {
  open:    boolean
  onClose: () => void
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ open, onClose }) => {
  const { history, clearHistory } = useCleanerHistoryStore()
  const [confirmClear, setConfirmClear] = useState(false)
  useEscapeKey(onClose, open)

  const totalFreed = history.reduce((a, r) => a + r.totalFreed, 0)

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/40"
            onClick={onClose}
          />
          {/* Slide-in panel from right */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, x: 340 }}
            animate={{ opacity: 1, x: 0   }}
            exit={{ opacity: 0,   x: 340  }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 z-[121] w-[360px] flex flex-col bg-bg-surface border-l border-border/50 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border/40 shrink-0">
              <div className="w-8 h-8 rounded-xl bg-brand-primary/15 flex items-center justify-center">
                <History className="w-4 h-4 text-brand-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-text-primary">Cleanup History</p>
                <p className="text-2xs text-text-muted">{history.length} session{history.length !== 1 ? 's' : ''} · {formatBytes(totalFreed)} total freed</p>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-white/5 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center pb-8">
                  <div className="w-14 h-14 rounded-2xl bg-brand-primary/10 flex items-center justify-center">
                    <History className="w-7 h-7 text-brand-primary/50" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-secondary">No cleanup history yet</p>
                    <p className="text-2xs text-text-muted mt-1">
                      Each time you run a cleanup, a record appears here.
                    </p>
                  </div>
                </div>
              ) : (
                history.map(report => (
                  <HistoryEntry key={report.id} report={report} />
                ))
              )}
            </div>

            {/* Footer */}
            {history.length > 0 && (
              <div className="px-4 py-3 border-t border-border/30 shrink-0">
                {confirmClear ? (
                  <div className="flex items-center gap-2">
                    <p className="text-2xs text-text-muted flex-1">Clear all {history.length} records?</p>
                    <button
                      onClick={() => { clearHistory(); setConfirmClear(false) }}
                      className="px-3 py-1.5 rounded-lg text-2xs font-bold text-white bg-red-500/80 hover:bg-red-500 transition-colors"
                    >
                      Clear All
                    </button>
                    <button
                      onClick={() => setConfirmClear(false)}
                      className="px-3 py-1.5 rounded-lg text-2xs text-text-muted border border-border hover:text-text-secondary transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="flex items-center gap-1.5 text-2xs text-text-muted hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear history
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
