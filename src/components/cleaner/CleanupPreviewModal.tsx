import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, HardDrive, ChevronDown, ChevronRight, Zap, ShieldCheck,
  ArrowUpDown, Globe, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatBytes } from '@/utils/format'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import type { ScanCategory } from '@/types'

type SortKey = 'size' | 'name' | 'files'

const RISK_MAP: Record<string, { label: string; cls: string }> = {
  'recycle-bin':     { label: 'Safe',           cls: 'text-emerald-400 bg-emerald-500/10' },
  'temp-files':      { label: 'Safe',           cls: 'text-emerald-400 bg-emerald-500/10' },
  'browser-cache':   { label: 'Safe',           cls: 'text-emerald-400 bg-emerald-500/10' },
  'thumbnail-cache': { label: 'Safe',           cls: 'text-emerald-400 bg-emerald-500/10' },
  'gpu-cache':       { label: 'Safe',           cls: 'text-emerald-400 bg-emerald-500/10' },
  'crash-dumps':     { label: 'Safe to remove', cls: 'text-emerald-400 bg-emerald-500/10' },
  'windows-logs':    { label: 'Safe to remove', cls: 'text-emerald-400 bg-emerald-500/10' },
}

interface CleanupPreviewModalProps {
  open:         boolean
  categories:   ScanCategory[]
  selectedIds:  Set<string>
  selectedSize: number
  onConfirm:    () => void
  onCancel:     () => void
}

export const CleanupPreviewModal: React.FC<CleanupPreviewModalProps> = ({
  open, categories, selectedIds, selectedSize, onConfirm, onCancel,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [sortKey,  setSortKey]  = useState<SortKey>('size')

  useEscapeKey(onCancel, open)

  const selectedCats = useMemo(() => {
    const cats = categories.filter(c => selectedIds.has(c.id))
    return [...cats].sort((a, b) => {
      if (sortKey === 'size')  return b.totalSize - a.totalSize
      if (sortKey === 'files') return b.fileCount - a.fileCount
      return a.name.localeCompare(b.name)
    })
  }, [categories, selectedIds, sortKey])

  const hasBrowserCache = selectedIds.has('browser-cache')

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const SORT_OPTS: { key: SortKey; label: string }[] = [
    { key: 'size',  label: 'Size' },
    { key: 'files', label: 'Files' },
    { key: 'name',  label: 'Name' },
  ]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(10px)' }}
          onClick={onCancel}
        >
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{ opacity: 0,   scale: 0.95,  y: 8  }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-[540px] max-h-[84vh] flex flex-col bg-bg-surface border border-border/60 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Ambient glow */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-primary/[0.07] rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 relative z-10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-brand-primary/15 border border-brand-primary/25 flex items-center justify-center">
                  <HardDrive className="w-4 h-4 text-brand-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-text-primary">Cleanup Preview</h2>
                  <p className="text-2xs text-text-muted">{formatBytes(selectedSize)} across {selectedIds.size} {selectedIds.size === 1 ? 'category' : 'categories'}</p>
                </div>
              </div>
              <button
                onClick={onCancel}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-white/5 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Trust / safety notice */}
            <div className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500/[0.05] border-b border-emerald-500/15 shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <p className="text-2xs text-text-secondary">
                All selected categories are <span className="font-semibold text-emerald-400">safe to clean</span> — Windows system files are never touched.
              </p>
            </div>

            {/* Browser warning */}
            {hasBrowserCache && (
              <div className="flex items-center gap-2 px-6 py-2.5 bg-amber-500/[0.05] border-b border-amber-500/15 shrink-0">
                <Globe className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <p className="text-2xs text-text-secondary">
                  <span className="font-semibold text-amber-400">Browser cache</span> selected — if any browser is currently open, some cache files may be skipped.
                </p>
              </div>
            )}

            {/* Sort bar */}
            <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-border/20 shrink-0">
              <ArrowUpDown className="w-3 h-3 text-text-muted shrink-0" />
              <span className="text-2xs text-text-muted mr-1">Sort:</span>
              {SORT_OPTS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setSortKey(opt.key)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-2xs font-medium transition-colors',
                    sortKey === opt.key
                      ? 'bg-brand-primary/15 text-brand-primary'
                      : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.03]',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Category list */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {selectedCats.map(cat => {
                const isOpen = expanded.has(cat.id)
                const pct    = Math.min(100, (cat.totalSize / (selectedSize || 1)) * 100)
                const risk   = RISK_MAP[cat.id] ?? { label: 'Safe', cls: 'text-emerald-400 bg-emerald-500/10' }

                return (
                  <div key={cat.id} className="rounded-xl border border-border/50 overflow-hidden">
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
                      onClick={() => toggle(cat.id)}
                    >
                      {isOpen
                        ? <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" />
                        : <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-text-primary truncate">{cat.name}</p>
                          <span className={cn('text-2xs px-1.5 py-0.5 rounded-md font-medium flex items-center gap-1 shrink-0', risk.cls)}>
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            {risk.label}
                          </span>
                        </div>
                        <p className="text-2xs text-text-muted">
                          {formatBytes(cat.totalSize)} · {cat.fileCount.toLocaleString()} files
                        </p>
                      </div>
                      <span className="text-2xs font-bold tabular-nums text-brand-primary shrink-0">
                        {Math.round(pct)}%
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          key="detail"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-3 pt-2 border-t border-border/30 space-y-2">
                            <p className="text-2xs text-text-muted leading-relaxed">{cat.description}</p>
                            {cat.id === 'browser-cache' && (
                              <div className="flex items-center gap-1.5 text-2xs text-amber-400/80">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                Files in use by open browsers will be skipped automatically.
                              </div>
                            )}
                            <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-border/40 bg-white/[0.01] shrink-0">
              <div className="flex-1">
                <p className="text-xs font-bold text-text-primary">{formatBytes(selectedSize)} will be freed</p>
                <p className="text-2xs text-text-muted">{selectedIds.size} {selectedIds.size === 1 ? 'category' : 'categories'} selected</p>
              </div>
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-xl border border-border bg-bg-surface text-xs font-medium text-text-secondary hover:text-text-primary hover:border-border/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white [background:var(--t-btn-bg)] hover:brightness-105 shadow-glow-sm transition-all"
              >
                <Zap className="w-3.5 h-3.5" />
                Start Clean
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
