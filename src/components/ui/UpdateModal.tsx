import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUp, ArrowRight, ExternalLink, AlertTriangle, CheckCircle2, Shield } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from './Button'
import type { UpdateState } from '@/types'

interface UpdateModalProps {
  state:      UpdateState
  onSkip:     () => void
  onUpdate:   () => void
}

// ── Animated arrow icon ────────────────────────────────────────────────────
const BouncingArrow: React.FC = () => (
  <div className="w-10 h-10 rounded-xl bg-brand-primary/15 border border-brand-primary/25 flex items-center justify-center shrink-0 shadow-glow-sm">
    <motion.div
      animate={{ y: [-2, 2, -2] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
    >
      <ArrowUp className="w-5 h-5 text-brand-primary" />
    </motion.div>
  </div>
)

// ── Version pill ───────────────────────────────────────────────────────────
const VersionPill: React.FC<{
  label: string
  version: string
  highlight?: boolean
}> = ({ label, version, highlight }) => (
  <div className={cn(
    'flex-1 rounded-xl px-4 py-2.5 text-center border',
    highlight
      ? 'bg-brand-primary/10 border-brand-primary/30'
      : 'bg-white/[0.03] border-border/60',
  )}>
    <p className={cn('text-2xs mb-0.5', highlight ? 'text-brand-primary/70' : 'text-text-muted')}>
      {label}
    </p>
    <p className={cn(
      'text-sm font-mono font-bold',
      highlight ? 'text-brand-primary' : 'text-text-secondary',
    )}>
      v{version}
    </p>
  </div>
)

// ── Main modal ─────────────────────────────────────────────────────────────
export const UpdateModal: React.FC<UpdateModalProps> = ({ state, onSkip, onUpdate }) => {
  const canSkip = !state.mandatory

  return (
    <AnimatePresence>
      {/* Full-screen overlay — blocks interaction entirely when mandatory */}
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          onClick={canSkip ? onSkip : undefined}
        />

        {/* Modal card */}
        <motion.div
          key="card"
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1,    y: 0 }}
          exit={{ opacity: 0,   scale: 0.95,  y: 8 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          className="relative z-10 w-full max-w-[420px] bg-bg-surface border border-border/60 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Ambient glow behind card */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-brand-primary/[0.08] rounded-full blur-3xl pointer-events-none" />

          {/* ── Header ── */}
          <div className="px-6 pt-6 pb-5 relative z-10">
            <div className="flex items-start gap-3 mb-5">
              <BouncingArrow />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-text-primary leading-tight">
                    {state.mandatory ? 'Update Required' : 'Update Available'}
                  </h2>
                  {state.mandatory ? (
                    <span className="text-2xs px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-red-400 font-medium shrink-0">
                      Required
                    </span>
                  ) : (
                    <span className="text-2xs px-1.5 py-0.5 rounded-full bg-emerald-500/12 border border-emerald-500/25 text-emerald-400 font-medium shrink-0">
                      New Release
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted mt-0.5 truncate">{state.title}</p>
              </div>
            </div>

            {/* Version comparison */}
            <div className="flex items-center gap-2.5 mb-5">
              <VersionPill label="Current" version={state.currentVersion} />
              <ArrowRight className="w-4 h-4 text-brand-primary/60 shrink-0" />
              <VersionPill label="Latest" version={state.latestVersion} highlight />
            </div>

            {/* Mandatory notice */}
            {state.mandatory && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2.5 rounded-xl border border-red-500/25 bg-red-500/8 px-3.5 py-3 mb-5"
              >
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300 leading-relaxed">
                  The {state.mandatoryAfterDays}-day grace period has ended.
                  You must update Propel to continue.
                </p>
              </motion.div>
            )}

            {/* Changelog */}
            {state.changelog.length > 0 && (
              <div>
                <p className="text-2xs text-text-muted uppercase tracking-widest mb-2.5">
                  What's New
                </p>
                <div className="space-y-2">
                  {state.changelog.map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.08 + i * 0.05 }}
                      className="flex items-start gap-2.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-primary/70 shrink-0 mt-0.5" />
                      <p className="text-xs text-text-secondary leading-snug">{item}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="px-6 py-4 border-t border-border/40 bg-white/[0.01] flex gap-2.5">
            {canSkip && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={onSkip}
              >
                Skip for Now
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              className={cn('flex-1', !canSkip && 'w-full')}
              iconRight={<ExternalLink className="w-3.5 h-3.5" />}
              onClick={onUpdate}
            >
              Update Now
            </Button>
          </div>

          {/* Security footnote */}
          <div className="px-6 pb-4 flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-text-muted shrink-0" />
            <p className="text-2xs text-text-muted">
              Manual update via official website only.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
