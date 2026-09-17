import React, { useState, useCallback } from 'react'
import {
  Zap, RefreshCw, Trash2, Copy, CheckCircle2,
  ChevronDown, ChevronRight, Clock,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'
import {
  getPerfEntries, getPerfSummary, clearPerfEntries,
  getPerfAsText,
} from '@/services/perfProfiler'

const CAT_COLORS: Record<string, string> = {
  scan:    'text-brand-primary bg-brand-primary/10',
  ipc:     'text-blue-400 bg-blue-500/10',
  render:  'text-amber-400 bg-amber-500/10',
  general: 'text-text-muted bg-white/5',
}

function durationColor(ms: number): string {
  if (ms > 1000) return 'text-red-400 font-bold'
  if (ms > 200)  return 'text-amber-400 font-semibold'
  if (ms > 50)   return 'text-yellow-400'
  return 'text-emerald-400'
}

export const PerfPanel: React.FC = () => {
  const [entries,  setEntries]  = useState(() => getPerfEntries())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [copied,   setCopied]   = useState(false)

  const summary = getPerfSummary()

  const refresh = useCallback(() => setEntries(getPerfEntries()), [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getPerfAsText())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  const handleClear = () => {
    clearPerfEntries()
    setEntries([])
  }

  const toggle = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const recent = entries.slice(-50).reverse()

  return (
    <div className="space-y-4">
      {/* Summary */}
      {Object.keys(summary).length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(summary).map(([cat, s]) => (
            <div key={cat} className="glass rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn('text-2xs px-1.5 py-0.5 rounded font-medium capitalize', CAT_COLORS[cat] ?? CAT_COLORS.general)}>
                  {cat}
                </span>
                <span className="text-2xs text-text-muted ml-auto">{s.count} ops</span>
              </div>
              <p className={cn('text-sm tabular-nums', durationColor(s.maxMs))}>
                {s.maxMs.toFixed(0)}ms max
              </p>
              <p className="text-2xs text-text-muted mt-0.5 truncate">
                Slowest: {s.slowest}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-2xs text-text-muted border border-border/40 hover:text-text-secondary transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
        <button
          onClick={handleCopy}
          disabled={entries.length === 0}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-2xs text-text-muted border border-border/40 hover:text-text-secondary disabled:opacity-40 transition-colors"
        >
          {copied
            ? <><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Copied!</>
            : <><Copy className="w-3 h-3" /> Copy</>
          }
        </button>
        {entries.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-2xs text-red-400/70 border border-red-500/20 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
          >
            <Trash2 className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Entry list */}
      <div className="space-y-1 max-h-[260px] overflow-y-auto">
        {recent.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-2">
            <Zap className="w-8 h-8 text-text-muted/30" />
            <p className="text-xs text-text-muted">No perf data yet — run a scan to collect timings.</p>
          </div>
        ) : (
          recent.map(e => (
            <div key={e.id} className="rounded-lg border border-border/30 overflow-hidden">
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.02] transition-colors"
                onClick={() => e.meta ? toggle(e.id) : undefined}
              >
                {e.meta
                  ? (expanded.has(e.id) ? <ChevronDown className="w-3 h-3 text-text-muted shrink-0" /> : <ChevronRight className="w-3 h-3 text-text-muted shrink-0" />)
                  : <span className="w-3 h-3 shrink-0" />
                }
                <span className={cn('text-2xs px-1.5 py-0.5 rounded font-medium capitalize shrink-0', CAT_COLORS[e.category] ?? CAT_COLORS.general)}>
                  {e.category}
                </span>
                <span className="text-xs text-text-secondary flex-1 min-w-0 truncate">{e.label}</span>
                <span className={cn('text-2xs tabular-nums shrink-0', durationColor(e.durationMs))}>
                  {e.durationMs.toFixed(1)}ms
                </span>
              </button>

              <AnimatePresence initial={false}>
                {expanded.has(e.id) && e.meta && (
                  <motion.div
                    initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                    className="overflow-hidden border-t border-border/20"
                  >
                    <pre className="px-3 py-2 text-2xs text-text-muted font-mono whitespace-pre-wrap break-all">
                      {JSON.stringify(e.meta, null, 2)}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
