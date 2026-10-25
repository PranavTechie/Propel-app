import React, { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { WifiOff, RefreshCw, Shield } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { Button } from '@/components/ui/Button'
import { StatusPill } from '@/components/ui/StatusPill'

// ── Signal rings (static: this screen can stay open, so nothing loops) ─────
const SignalRings: React.FC = () => (
  <div className="relative flex h-32 w-32 items-center justify-center">
    <span className="absolute inset-0 rounded-full border border-line-subtle" />
    <span className="absolute inset-4 rounded-full border border-dashed border-line" />
    <span className="absolute inset-8 rounded-full border border-danger/20" />
    <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full border border-danger/25 bg-danger-soft text-danger-fg shadow-[var(--shadow-1)]">
      <WifiOff className="h-7 w-7" />
    </div>
  </div>
)

// ── Status dot ────────────────────────────────────────────────────────────
const StatusDot: React.FC<{ retrying: boolean }> = ({ retrying }) => (
  <StatusPill tone={retrying ? 'warning' : 'critical'}>
    {retrying ? 'Connecting…' : 'Server Unreachable'}
  </StatusPill>
)

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
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-surface-base">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-60 [mask-image:radial-gradient(circle_at_50%_45%,black,transparent_65%)]" />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative z-10 w-full max-w-[400px] px-6"
      >
        <div className="flex flex-col items-center rounded-panel border border-line bg-surface-raised px-8 py-9 text-center shadow-[var(--shadow-3),var(--highlight-top)]">
          <SignalRings />

          <h1 className="mt-6 font-display text-[24px] font-semibold leading-[30px] tracking-[-.025em] text-fg-1">
            Internet Required
          </h1>
          <p className="mt-2 text-body text-fg-2">
            Propel requires a connection to verify your account entitlement.
          </p>
          <p className="mt-1 text-body text-fg-3">Connect to the internet and retry.</p>

          <div className="mt-5">
            <StatusDot retrying={retrying} />
          </div>

          <Button size="lg" className="mt-7 w-full" loading={retrying} icon={<RefreshCw />} onClick={handleRetry}>
            {retrying ? 'Connecting…' : 'Retry Connection'}
          </Button>

          <div className="mt-7 flex items-center gap-2 border-t border-line-subtle pt-5">
            <Shield className="h-3.5 w-3.5 shrink-0 text-fg-3" />
            <p className="text-caption text-fg-3">
              Verification uses HMAC-signed requests. License is never cached unsecured.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
