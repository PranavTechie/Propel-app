import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, CheckCircle2, RefreshCw, X, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from './Button'
import type { UpdateState } from '@/types'

interface UpdateModalProps {
  state: UpdateState
  onClose: () => void
  onRestartAndInstall: () => void
  onRetry?: () => void
}

// ── Version Pill ───────────────────────────────────────────────────────────
const VersionPill: React.FC<{
  label: string
  version: string
  highlight?: boolean
}> = ({ label, version, highlight }) => (
  <div
    className={cn(
      'flex-1 rounded-xl px-4 py-2.5 text-center border transition-all duration-200',
      highlight
        ? 'bg-brand-primary/10 border-brand-primary/30 shadow-glow-sm'
        : 'bg-white/[0.03] border-border/60',
    )}
  >
    <p className={cn('text-2xs mb-0.5 font-medium', highlight ? 'text-brand-primary/80' : 'text-text-muted')}>
      {label}
    </p>
    <p className={cn('text-sm font-mono font-bold', highlight ? 'text-brand-primary' : 'text-text-secondary')}>
      v{version}
    </p>
  </div>
)

export const UpdateModal: React.FC<UpdateModalProps> = ({
  state,
  onClose,
  onRestartAndInstall,
  onRetry,
}) => {
  const [isInstalling, setIsInstalling] = useState(false)

  const handleInstallClick = () => {
    setIsInstalling(true)
    setTimeout(() => {
      onRestartAndInstall()
    }, 600)
  }

  const percent = state.progress?.percent ?? (state.status === 'downloaded' ? 100 : 0)
  const speedMbps = state.progress?.bytesPerSecond
    ? (state.progress.bytesPerSecond / (1024 * 1024)).toFixed(1)
    : null
  const transferredMB = state.progress?.transferred
    ? (state.progress.transferred / (1024 * 1024)).toFixed(1)
    : null
  const totalMB = state.progress?.total
    ? (state.progress.total / (1024 * 1024)).toFixed(1)
    : null

  // Format release notes if present
  const notes = Array.isArray(state.releaseNotes)
    ? state.releaseNotes
    : typeof state.releaseNotes === 'string'
      ? state.releaseNotes.split('\n').map(s => s.replace(/^[-*•]\s*/, '').trim()).filter(Boolean)
      : ['Performance improvements and bug fixes', 'Engine stability updates', 'Enhanced memory optimization']

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
          onClick={!isInstalling ? onClose : undefined}
        />

        {/* Modal card */}
        <motion.div
          key="card"
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="relative z-10 w-full max-w-[440px] bg-bg-surface border border-brand-primary/25 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Ambient Glow */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none" />

          {/* ── STATE 4: Centered Installing Screen ── */}
          {isInstalling ? (
            <div className="px-8 py-12 flex flex-col items-center justify-center text-center space-y-5">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-brand-primary/15 border border-brand-primary/30 flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-brand-primary animate-spin" style={{ animationDuration: '2s' }} />
                </div>
                <div className="absolute -inset-2 rounded-2xl bg-brand-primary/10 blur-md pointer-events-none" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-text-primary tracking-tight">
                  Installing update...
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  Restarting Propel...
                </p>
              </div>

              <div className="w-48 h-1.5 rounded-full bg-white/10 overflow-hidden relative">
                <motion.div
                  className="h-full bg-gradient-to-r from-brand-primary to-emerald-400 rounded-full"
                  animate={{
                    x: ['-100%', '100%'],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.4,
                    ease: 'easeInOut',
                  }}
                  style={{ width: '60%' }}
                />
              </div>
            </div>
          ) : state.status === 'error' ? (
            /* ── STATE 5: Error Screen ── */
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-primary">
                    Update Check Unavailable
                  </h3>
                  <p className="text-xs text-text-muted">
                    Propel continues running normally.
                  </p>
                </div>
              </div>

              <p className="text-xs text-text-secondary leading-relaxed bg-white/[0.02] border border-border/50 rounded-xl p-3 mb-5">
                {state.error || 'Could not connect to GitHub releases. Please check your internet connection or try again later.'}
              </p>

              <div className="flex gap-2.5">
                <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>
                  Close
                </Button>
                {onRetry && (
                  <Button variant="primary" size="sm" className="flex-1" onClick={onRetry}>
                    Try Again
                  </Button>
                )}
              </div>
            </div>
          ) : state.status === 'downloaded' ? (
            /* ── STATE 3: Update Ready Screen ── */
            <div>
              <div className="p-6 pb-4">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-glow-sm">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-text-primary">
                          Update Ready
                        </h3>
                        <span className="text-2xs px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 font-mono font-medium">
                          v{state.latestVersion}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted mt-0.5">
                        Download verified and ready to install.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-text-muted hover:text-text-primary rounded-lg p-1 hover:bg-white/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Version comparison */}
                <div className="flex items-center gap-2.5 my-4">
                  <VersionPill label="Current" version={state.currentVersion} />
                  <ArrowRight className="w-4 h-4 text-brand-primary/60 shrink-0" />
                  <VersionPill label="Ready" version={state.latestVersion} highlight />
                </div>

                {/* Changelog */}
                {notes.length > 0 && (
                  <div className="mt-4">
                    <p className="text-2xs text-text-muted uppercase tracking-widest mb-2 font-semibold">
                      What's New in v{state.latestVersion}
                    </p>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {notes.map((item, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-text-secondary leading-snug">
                          <CheckCircle2 className="w-3.5 h-3.5 text-brand-primary shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="p-4 border-t border-border/40 bg-white/[0.01] flex gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={onClose}
                >
                  Later
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  onClick={handleInstallClick}
                >
                  Restart & Update
                </Button>
              </div>
            </div>
          ) : (
            /* ── STATE 1 & 2: Update Available / Downloading ── */
            <div>
              <div className="p-6 pb-4">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-primary/15 border border-brand-primary/30 flex items-center justify-center text-brand-primary shrink-0">
                      <RefreshCw className="w-5 h-5 animate-spin" style={{ animationDuration: '3s' }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-text-primary">
                          New Update Available
                        </h3>
                        <span className="text-2xs px-2 py-0.5 rounded-full bg-brand-primary/15 border border-brand-primary/25 text-brand-primary font-mono font-medium">
                          v{state.latestVersion}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted mt-0.5">
                        Downloading update package in background...
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-text-muted hover:text-text-primary rounded-lg p-1 hover:bg-white/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Version comparison */}
                <div className="flex items-center gap-2.5 my-4">
                  <VersionPill label="Current" version={state.currentVersion} />
                  <ArrowRight className="w-4 h-4 text-brand-primary/60 shrink-0" />
                  <VersionPill label="New" version={state.latestVersion} highlight />
                </div>

                {/* Progress Box */}
                <div className="bg-white/[0.02] border border-border/50 rounded-xl p-3.5 my-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-brand-primary font-semibold">
                      Downloading... {percent}%
                    </span>
                    {transferredMB && totalMB ? (
                      <span className="text-text-muted text-2xs">
                        {transferredMB} MB / {totalMB} MB
                      </span>
                    ) : null}
                  </div>

                  <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-brand-primary to-emerald-400 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>

                  {speedMbps && (
                    <div className="flex justify-end text-2xs text-text-muted font-mono">
                      <span>{speedMbps} MB/s</span>
                    </div>
                  )}
                </div>

                {/* Changelog */}
                {notes.length > 0 && (
                  <div className="mt-3">
                    <p className="text-2xs text-text-muted uppercase tracking-widest mb-2 font-semibold">
                      Highlights
                    </p>
                    <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                      {notes.map((item, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-text-secondary leading-snug">
                          <CheckCircle2 className="w-3.5 h-3.5 text-brand-primary/70 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="p-4 border-t border-border/40 bg-white/[0.01] flex gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={onClose}
                >
                  Continue in Background
                </Button>
              </div>
            </div>
          )}

          {/* Footer note */}
          {!isInstalling && (
            <div className="px-6 pb-3 pt-1 flex items-center gap-1.5 border-t border-white/[0.04]">
              <ShieldCheck className="w-3 h-3 text-brand-primary/60 shrink-0" />
              <p className="text-[10px] text-text-muted">
                Official release verified with SHA-512 and Propel ASAR integrity.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
