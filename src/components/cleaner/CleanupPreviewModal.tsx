import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HardDrive, ChevronDown, ChevronRight, Zap, ShieldCheck,
  ArrowUpDown, Globe, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { Progress } from '@/components/ui/Progress'
import { formatBytes } from '@/utils/format'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import type { ScanCategory } from '@/types'

type SortKey = 'size' | 'name' | 'files'

const RISK_MAP: Record<string, { label: string; cls: string }> = {
  'recycle-bin':     { label: 'Safe',           cls: 'bg-success-soft text-success-fg' },
  'temp-files':      { label: 'Safe',           cls: 'bg-success-soft text-success-fg' },
  'browser-cache':   { label: 'Safe',           cls: 'bg-success-soft text-success-fg' },
  'thumbnail-cache': { label: 'Safe',           cls: 'bg-success-soft text-success-fg' },
  'gpu-cache':       { label: 'Safe',           cls: 'bg-success-soft text-success-fg' },
  'crash-dumps':     { label: 'Safe to remove', cls: 'bg-success-soft text-success-fg' },
  'windows-logs':    { label: 'Safe to remove', cls: 'bg-success-soft text-success-fg' },
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
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v) onCancel()
      }}
      size="md"
      tone="brand"
      icon={<HardDrive />}
      title="Cleanup Preview"
      description={`${formatBytes(selectedSize)} across ${selectedIds.size} ${selectedIds.size === 1 ? 'category' : 'categories'}`}
      footer={
        <>
          <div className="mr-auto">
            <p className="text-body-sm font-semibold text-fg-1 tabular">{formatBytes(selectedSize)} will be freed</p>
            <p className="text-caption text-fg-3">
              {selectedIds.size} {selectedIds.size === 1 ? 'category' : 'categories'} selected
            </p>
          </div>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button icon={<Zap />} onClick={onConfirm} autoFocus>
            Start Clean
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <Callout tone="success" icon={<ShieldCheck />} compact>
          All selected categories are <span className="font-semibold text-success-fg">safe to clean</span> — Windows system files are never touched.
        </Callout>
        {hasBrowserCache && (
          <Callout tone="warning" icon={<Globe />} compact>
            <span className="font-semibold text-warning-fg">Browser cache</span> selected — if any browser is currently open, some cache files may be skipped.
          </Callout>
        )}
      </div>

      <div className="mt-4 flex items-center gap-1.5">
        <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-fg-3" />
        <span className="mr-1 text-caption text-fg-3">Sort:</span>
        <div className="flex items-center rounded-control border border-line-subtle bg-surface-inset p-[3px]">
          {SORT_OPTS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setSortKey(opt.key)}
              aria-pressed={sortKey === opt.key}
              className={cn(
                'h-6 rounded-[6px] px-2.5 text-caption font-medium transition-colors duration-fast focus-visible:shadow-ring',
                sortKey === opt.key
                  ? 'bg-surface-raised text-fg-1 shadow-[var(--shadow-1)]'
                  : 'text-fg-3 hover:text-fg-1',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {selectedCats.map(cat => {
          const isOpen = expanded.has(cat.id)
          const pct    = Math.min(100, (cat.totalSize / (selectedSize || 1)) * 100)
          const risk   = RISK_MAP[cat.id] ?? { label: 'Safe', cls: 'bg-success-soft text-success-fg' }

          return (
            <li key={cat.id} className="overflow-hidden rounded-card border border-line-subtle bg-surface-raised">
              <button
                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors duration-fast hover:bg-state/[var(--a-hover)] focus-visible:shadow-[inset_0_0_0_2px_rgb(var(--c-brand)/.45)]"
                onClick={() => toggle(cat.id)}
                aria-expanded={isOpen}
              >
                {isOpen
                  ? <ChevronDown className="h-4 w-4 shrink-0 text-fg-3" />
                  : <ChevronRight className="h-4 w-4 shrink-0 text-fg-3" />
                }
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-body-sm font-semibold text-fg-1">{cat.name}</p>
                    <span className={cn('flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold', risk.cls)}>
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      {risk.label}
                    </span>
                  </div>
                  <p className="text-caption text-fg-3 tabular">
                    {formatBytes(cat.totalSize)} · {cat.fileCount.toLocaleString()} files
                  </p>
                </div>
                <span className="shrink-0 text-caption font-semibold text-brand-fg tabular">{Math.round(pct)}%</span>
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
                    <div className="space-y-2 border-t border-line-subtle px-3.5 pb-3 pt-2">
                      {cat.description && <p className="text-caption text-fg-3">{cat.description}</p>}
                      {cat.id === 'browser-cache' && (
                        <p className="flex items-center gap-1.5 text-caption text-warning-fg">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          Files in use by open browsers will be skipped automatically.
                        </p>
                      )}
                      <Progress value={pct} tone="brand" size="xs" aria-label={`${cat.name} share of cleanup`} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
