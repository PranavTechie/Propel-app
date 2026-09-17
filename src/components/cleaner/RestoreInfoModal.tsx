import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, RotateCcw, ShieldCheck, AlertTriangle, HardDrive,
  ExternalLink, Trash2, Globe, FileText, Cpu, Image,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatBytes } from '@/utils/format'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import type { CleanupReport } from '@/types'

interface RestoreInfoModalProps {
  open:    boolean
  report:  CleanupReport
  onClose: () => void
}

const CATEGORY_META: Record<string, {
  label:       string
  icon:        React.ReactNode
  recoverNote: string
  safe:        boolean
}> = {
  'temp-files':      {
    label: 'Temporary Files',
    icon:  <Trash2 className="w-3.5 h-3.5" />,
    recoverNote: 'Permanently deleted. Apps regenerate these automatically.',
    safe: true,
  },
  'browser-cache':   {
    label: 'Browser Cache',
    icon:  <Globe className="w-3.5 h-3.5" />,
    recoverNote: 'Permanently deleted. Browsers rebuild cache on next visit.',
    safe: true,
  },
  'recycle-bin':     {
    label: 'Recycle Bin',
    icon:  <Trash2 className="w-3.5 h-3.5" />,
    recoverNote: 'Recycle Bin was emptied via Windows Shell. Files cannot be recovered through Propel. Use a file recovery tool if needed.',
    safe: false,
  },
  'thumbnail-cache': {
    label: 'Thumbnail Cache',
    icon:  <Image className="w-3.5 h-3.5" />,
    recoverNote: 'Permanently deleted. Windows rebuilds thumbnails automatically on next folder browse.',
    safe: true,
  },
  'gpu-cache':       {
    label: 'GPU Shader Cache',
    icon:  <Cpu className="w-3.5 h-3.5" />,
    recoverNote: 'Permanently deleted. Your GPU driver regenerates shader caches automatically.',
    safe: true,
  },
  'crash-dumps':     {
    label: 'Crash Dumps',
    icon:  <FileText className="w-3.5 h-3.5" />,
    recoverNote: 'Permanently deleted. These were diagnostic files from past crashes.',
    safe: true,
  },
  'windows-logs':    {
    label: 'Windows Log Files',
    icon:  <FileText className="w-3.5 h-3.5" />,
    recoverNote: 'Permanently deleted. Windows continues generating new logs normally.',
    safe: true,
  },
}

export const RestoreInfoModal: React.FC<RestoreInfoModalProps> = ({ open, report, onClose }) => {
  useEscapeKey(onClose, open)

  const hasUnrecoverable = report.categories.includes('recycle-bin')

  const openRestorePoint = () => {
    window.electronAPI?.shell?.openExternal('ms-settings:recovery')
      .catch(() => {
        // Fallback — open via systempropertiesprotection.exe path guidance
      })
  }

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
          onClick={onClose}
        >
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{ opacity: 0,   scale: 0.95,  y: 8  }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-[520px] max-h-[84vh] flex flex-col bg-bg-surface border border-border/60 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-brand-primary/[0.05] rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-border/40 shrink-0 relative z-10">
              <div className="w-9 h-9 rounded-xl bg-brand-primary/15 border border-brand-primary/25 flex items-center justify-center">
                <RotateCcw className="w-4 h-4 text-brand-primary" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text-primary">Cleanup Details & Recovery</h2>
                <p className="text-2xs text-text-muted">
                  {formatBytes(report.totalFreed)} freed · {report.filesRemoved.toLocaleString()} files removed
                </p>
              </div>
              <button
                onClick={onClose}
                className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-white/5 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Recoverability notice */}
            <div className={cn(
              'flex items-center gap-2 px-6 py-2.5 border-b shrink-0',
              hasUnrecoverable
                ? 'bg-amber-500/[0.04] border-amber-500/15'
                : 'bg-emerald-500/[0.04] border-emerald-500/15',
            )}>
              {hasUnrecoverable
                ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                : <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              }
              <p className="text-2xs text-text-secondary">
                {hasUnrecoverable
                  ? 'Recycle Bin items cannot be recovered. All other categories regenerate automatically.'
                  : 'All cleaned items are safe — apps and Windows regenerate them automatically.'
                }
              </p>
            </div>

            {/* Category recovery breakdown */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {report.categories.map(catId => {
                const meta = CATEGORY_META[catId] ?? {
                  label: catId,
                  icon: <HardDrive className="w-3.5 h-3.5" />,
                  recoverNote: 'Files were permanently deleted.',
                  safe: true,
                }
                return (
                  <div key={catId} className="rounded-xl border border-border/40 p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-6 h-6 rounded-lg flex items-center justify-center',
                        meta.safe ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10',
                      )}>
                        {meta.icon}
                      </div>
                      <p className="text-xs font-semibold text-text-primary">{meta.label}</p>
                      <span className={cn(
                        'ml-auto text-2xs px-1.5 py-0.5 rounded-md font-medium',
                        meta.safe ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10',
                      )}>
                        {meta.safe ? 'Auto-regenerates' : 'Not recoverable'}
                      </span>
                    </div>
                    <p className="text-2xs text-text-muted leading-relaxed pl-8">{meta.recoverNote}</p>
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border/30 bg-white/[0.01] shrink-0 space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.03] border border-border/30">
                <RotateCcw className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-2xs font-medium text-text-secondary">Need full system recovery?</p>
                  <p className="text-2xs text-text-muted">Use a Windows System Restore Point created before this cleanup.</p>
                </div>
                <button
                  onClick={openRestorePoint}
                  className="flex items-center gap-1 text-2xs text-brand-primary hover:text-text-accent transition-colors shrink-0"
                >
                  Open <ExternalLink className="w-2.5 h-2.5" />
                </button>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl border border-border text-xs font-medium text-text-secondary hover:text-text-primary hover:border-border/80 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
