import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  History, ChevronDown, Trash2,
  HardDrive, Clock, Files, AlertCircle, Tag,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatBytes } from '@/utils/format'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useCleanerHistoryStore } from '@/store/cleanerHistoryStore'
import { Sheet } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusPill } from '@/components/ui/StatusPill'
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
    <div
      className={cn(
        'overflow-hidden rounded-card border bg-surface-raised transition-[border-color,box-shadow] duration-base',
        open ? 'border-line shadow-[var(--shadow-1)]' : 'border-line-subtle hover:border-line',
      )}
    >
      <button
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors duration-fast hover:bg-state/[var(--a-hover)] focus-visible:shadow-[inset_0_0_0_2px_rgb(var(--c-brand)/.45)]"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-fg-3 transition-transform duration-base', !open && '-rotate-90')}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-body font-semibold text-fg-1 tabular">{formatBytes(report.totalFreed)} freed</span>
            {report.errors > 0 && (
              <StatusPill tone="warning">
                {report.errors} error{report.errors > 1 ? 's' : ''}
              </StatusPill>
            )}
          </div>
          <p className="text-caption text-fg-3 tabular">
            {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} · {timeAgo(report.timestamp)}
          </p>
        </div>
        <span className="shrink-0 text-caption font-semibold text-success-fg tabular">
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
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-line-subtle px-3.5 py-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: <HardDrive className="h-3.5 w-3.5" />, label: 'Freed',    value: formatBytes(report.totalFreed) },
                  { icon: <Files className="h-3.5 w-3.5" />,     label: 'Files',    value: report.filesRemoved.toLocaleString() },
                  { icon: <Clock className="h-3.5 w-3.5" />,     label: 'Duration', value: formatDuration(report.durationMs) },
                ].map(item => (
                  <div key={item.label} className="rounded-control bg-surface-inset px-2.5 py-2">
                    <p className="flex items-center gap-1 text-[10.5px] text-fg-3">
                      {item.icon}
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-body-sm font-semibold text-fg-1 tabular">{item.value}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="mb-1.5 flex items-center gap-1 text-caption text-fg-3">
                  <Tag className="h-3 w-3" />
                  Categories cleaned
                </p>
                <div className="flex flex-wrap gap-1">
                  {report.categories.map(cat => (
                    <span
                      key={cat}
                      className="rounded-chip bg-surface-inset px-2 py-0.5 text-caption font-medium text-fg-2"
                    >
                      {CATEGORY_LABELS[cat] ?? cat}
                    </span>
                  ))}
                </div>
              </div>

              {report.errors > 0 && (
                <p className="flex items-center gap-1.5 text-caption text-warning-fg">
                  <AlertCircle className="h-3.5 w-3.5" />
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
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
      title="Cleanup History"
      description={`${history.length} session${history.length !== 1 ? 's' : ''} · ${formatBytes(totalFreed)} total freed`}
      icon={<History />}
      footer={
        history.length > 0 ? (
          confirmClear ? (
            <div className="flex items-center gap-2">
              <p className="flex-1 text-body-sm text-fg-2">Clear all {history.length} records?</p>
              <Button variant="secondary" size="sm" onClick={() => setConfirmClear(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => { clearHistory(); setConfirmClear(false) }}
              >
                Clear All
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 />}
              onClick={() => setConfirmClear(true)}
              className="hover:text-danger-fg"
            >
              Clear history
            </Button>
          )
        ) : undefined
      }
    >
      {history.length === 0 ? (
        <EmptyState
          icon={<History />}
          tone="brand"
          title="No cleanup history yet"
          description="Each time you run a cleanup, a record appears here."
          className="h-full"
        />
      ) : (
        <div className="space-y-2">
          {history.map(report => (
            <HistoryEntry key={report.id} report={report} />
          ))}
        </div>
      )}
    </Sheet>
  )
}
