import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bug, AlertCircle, AlertTriangle, Info,
  Trash2, Copy, CheckCircle2, ChevronDown, ChevronRight,
  Clock, RefreshCw,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import {
  getLogs, clearLogs, getLogSummary, getLogsAsText,
  type LogEntry,
} from '@/services/crashLogger'

const LEVEL_META: Record<LogEntry['level'], { icon: React.ReactNode; cls: string; rowCls: string }> = {
  error:   { icon: <AlertCircle className="w-3 h-3" />,   cls: 'text-red-400 bg-red-500/10',     rowCls: 'border-red-500/10' },
  warning: { icon: <AlertTriangle className="w-3 h-3" />, cls: 'text-amber-400 bg-amber-500/10', rowCls: 'border-amber-500/10' },
  info:    { icon: <Info className="w-3 h-3" />,          cls: 'text-text-muted bg-white/5',      rowCls: 'border-border/30' },
}

const CAT_LABELS: Record<LogEntry['category'], string> = {
  renderer:   'Renderer',
  cleaner:    'Cleaner',
  memory:     'Memory',
  activation: 'Activation',
  general:    'General',
}

function timeStr(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const LogRow: React.FC<{ entry: LogEntry }> = ({ entry }) => {
  const [open, setOpen] = useState(false)
  const meta = LEVEL_META[entry.level]

  return (
    <div className={cn('rounded-xl border overflow-hidden', meta.rowCls)}>
      <button
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/[0.02] transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        {open
          ? <ChevronDown className="w-3 h-3 text-text-muted shrink-0" />
          : <ChevronRight className="w-3 h-3 text-text-muted shrink-0" />
        }
        <span className={cn('inline-flex items-center gap-1 text-2xs font-medium px-1.5 py-0.5 rounded-md shrink-0', meta.cls)}>
          {meta.icon}
          {entry.level}
        </span>
        <span className="text-2xs text-text-muted/60 shrink-0 tabular-nums">
          {CAT_LABELS[entry.category]}
        </span>
        <span className="text-xs text-text-secondary flex-1 min-w-0 truncate">{entry.message}</span>
        <span className="text-2xs text-text-muted/40 shrink-0 flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          {timeStr(entry.timestamp)}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && entry.detail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2.5 pt-1 border-t border-border/20">
              <pre className="text-2xs text-text-muted font-mono whitespace-pre-wrap break-all leading-relaxed max-h-32 overflow-y-auto">
                {entry.detail}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export const DiagnosticsPanel: React.FC = () => {
  const [logs,         setLogs]         = useState<LogEntry[]>(() => getLogs())
  const [copied,       setCopied]       = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [filter,       setFilter]       = useState<LogEntry['level'] | 'all'>('all')

  const summary = getLogSummary()

  const refresh = useCallback(() => setLogs(getLogs()), [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getLogsAsText())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  const handleClear = () => {
    clearLogs()
    setLogs([])
    setConfirmClear(false)
  }

  const visible = filter === 'all' ? logs : logs.filter(l => l.level === filter)

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Entries', value: summary.total,    icon: <Bug className="w-3.5 h-3.5 text-brand-primary" /> },
          { label: 'Errors',        value: summary.errors,   icon: <AlertCircle className="w-3.5 h-3.5 text-red-400" /> },
          { label: 'Warnings',      value: summary.warnings, icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> },
        ].map(item => (
          <div key={item.label} className="glass rounded-xl p-3 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
              {item.icon}
            </div>
            <div>
              <p className="text-2xs text-text-muted">{item.label}</p>
              <p className="text-sm font-bold text-text-primary tabular-nums">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Filter */}
        <div className="flex gap-1 flex-1">
          {(['all', 'error', 'warning', 'info'] as const).map(lvl => (
            <button
              key={lvl}
              onClick={() => setFilter(lvl)}
              className={cn(
                'px-2.5 py-1.5 rounded-lg text-2xs font-medium transition-colors capitalize',
                filter === lvl
                  ? 'bg-brand-primary/15 text-brand-primary border border-brand-primary/30'
                  : 'text-text-muted border border-border/40 hover:text-text-secondary hover:bg-white/[0.03]',
              )}
            >
              {lvl === 'all' ? `All (${summary.total})` : lvl}
            </button>
          ))}
        </div>

        {/* Actions */}
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-2xs text-text-muted border border-border/40 hover:text-text-secondary hover:bg-white/[0.03] transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
        <button
          onClick={handleCopy}
          disabled={logs.length === 0}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-2xs text-text-muted border border-border/40 hover:text-text-secondary hover:bg-white/[0.03] disabled:opacity-40 transition-colors"
        >
          {copied
            ? <><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Copied!</>
            : <><Copy className="w-3 h-3" /> Copy Logs</>
          }
        </button>
        {logs.length > 0 && (
          confirmClear ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleClear}
                className="px-2.5 py-1.5 rounded-lg text-2xs font-bold text-white bg-red-500/70 hover:bg-red-500 transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="px-2.5 py-1.5 rounded-lg text-2xs text-text-muted border border-border/40 hover:text-text-secondary transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-2xs text-red-400/70 border border-red-500/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          )
        )}
      </div>

      {/* Log list */}
      <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-0.5">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-400/60" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-secondary">
                {filter === 'all' ? 'No diagnostic entries' : `No ${filter}s logged`}
              </p>
              <p className="text-2xs text-text-muted mt-0.5">System is running cleanly.</p>
            </div>
          </div>
        ) : (
          visible.map(entry => <LogRow key={entry.id} entry={entry} />)
        )}
      </div>

      <p className="text-2xs text-text-muted/60">
        Logs are stored locally and never sent anywhere. They reset when you clear browser storage.
      </p>
    </div>
  )
}
