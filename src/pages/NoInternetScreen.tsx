import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff, RefreshCw, Shield, AlertTriangle } from 'lucide-react'
import { useAppStore } from '@/store/appStore'

// ── Animated signal ring ───────────────────────────────────────────────────
const SignalRings: React.FC = () => (
  <div className="relative w-32 h-32 flex items-center justify-center">
    {/* Outermost ring — slowest */}
    <motion.div
      className="absolute inset-0 rounded-full border border-red-500/15"
      animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeOut' }}
    />
    {/* Middle ring */}
    <motion.div
      className="absolute inset-4 rounded-full border border-red-500/20"
      animate={{ scale: [1, 1.35, 1], opacity: [0.7, 0, 0.7] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
    />
    {/* Inner ring */}
    <motion.div
      className="absolute inset-8 rounded-full border border-red-500/30"
      animate={{ scale: [1, 1.2, 1], opacity: [0.8, 0, 0.8] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeOut', delay: 0.8 }}
    />
    {/* Icon container */}
    <div className="relative z-10 w-16 h-16 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center shadow-[0_0_32px_rgba(239,68,68,0.15)]">
      <WifiOff className="w-7 h-7 text-red-400" />
    </div>
  </div>
)

// ── Status dot ────────────────────────────────────────────────────────────
const StatusDot: React.FC<{ retrying: boolean }> = ({ retrying }) => (
  <div className="flex items-center gap-2">
    <motion.div
      className={`w-1.5 h-1.5 rounded-full ${retrying ? 'bg-amber-400' : 'bg-red-400'}`}
      animate={{ opacity: retrying ? [1, 0.3, 1] : 1 }}
      transition={{ duration: 0.8, repeat: retrying ? Infinity : 0 }}
    />
    <span className={`text-xs font-medium ${retrying ? 'text-amber-400' : 'text-red-400'}`}>
      {retrying ? 'Connecting…' : 'Server Unreachable'}
    </span>
  </div>
)

// ── Main Screen ───────────────────────────────────────────────────────────
export const NoInternetScreen: React.FC = () => {
  const setPhase        = useAppStore(s => s.setPhase)
  const [retrying, setRetrying] = useState(false)

  const handleRetry = useCallback(async () => {
    if (retrying) return
    setRetrying(true)
    // Brief visual feedback, then re-run the full startup verification
    // by resetting to 'splash' — SplashScreen remounts and calls verify()
    await new Promise(r => setTimeout(r, 800))
    setPhase('splash')
  }, [retrying, setPhase])

  return (
    <div className="fixed inset-0 bg-bg-base flex items-center justify-center overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/4 rounded-full blur-[120px]" />
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-red-700/3 rounded-full blur-3xl" />
        <div className="absolute inset-0 grid-bg opacity-10" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 flex flex-col items-center text-center max-w-sm px-8"
      >
        {/* Icon */}
        <SignalRings />

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8"
        >
          <h1 className="text-2xl font-bold text-text-primary mb-2">
            Internet Required
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed">
            Propel requires a connection to verify your account entitlement.
          </p>
          <p className="text-sm text-text-muted mt-1 leading-relaxed">
            Connect to the internet and retry.
          </p>
        </motion.div>

        {/* Status pill */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="mt-5 flex items-center gap-3 px-4 py-2 rounded-full border border-border/50 bg-white/[0.03]"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <StatusDot retrying={retrying} />
        </motion.div>

        {/* Retry button */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="mt-8 w-full"
        >
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="w-full h-12 rounded-xl [background:var(--t-btn-bg)] hover:brightness-110 disabled:opacity-50 text-white text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2.5 shadow-glow-sm"
          >
            <AnimatePresence mode="wait">
              {retrying ? (
                <motion.div
                  key="spin"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </motion.div>
              ) : (
                <motion.div
                  key="icon"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2.5"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Retry Connection</span>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 pt-6 border-t border-border/30 flex items-center gap-2"
        >
          <Shield className="w-3 h-3 text-text-muted shrink-0" />
          <p className="text-2xs text-text-muted leading-relaxed">
            Verification uses HMAC-signed requests. License is never cached unsecured.
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
