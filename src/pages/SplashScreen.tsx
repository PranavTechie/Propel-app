import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Zap, CheckCircle2 } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { splashVariants } from '@/animations/variants'
import { supabase } from '@/lib/supabase'

const BOOT_STEPS = [
  'Initializing Propel…',
  'Loading system modules…',
  'Verifying license…',
  'Configuring workspace…',
]



export const SplashScreen: React.FC = () => {
  const setPhase = useAppStore(s => s.setPhase)
  const setSession = useAppStore(s => s.setSession)
  const setEntitlementStatus = useAppStore(s => s.setEntitlementStatus)
  const [stepIndex, setStepIndex] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    // Cycle through steps every 550ms up to step 2 while we wait for the API
    const intervals: ReturnType<typeof setTimeout>[] = []
    intervals.push(setTimeout(() => setStepIndex(1), 550))
    intervals.push(setTimeout(() => setStepIndex(2), 1100))

    const MIN_DISPLAY_MS = 1500  // prevents flicker on fast connections

    const bootstrap = async () => {
      const startedAt = Date.now()
      try {
        setEntitlementStatus({ status: 'checking', plan: 'FREE', source: 'plan', trial_active: false, trial_expires_at: null, subscription_status: '' })
        
        // getSession() auto-refreshes the access token if expired.
        // If the stored refresh_token is also invalid/revoked it returns null — handled below.
        const { data: { session }, error } = await supabase.auth.getSession()

        setStepIndex(3)

        const elapsed = Date.now() - startedAt
        const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed)
        await new Promise(r => setTimeout(r, remaining))
        setDone(true)
        await new Promise(r => setTimeout(r, 300))

        if (error || !session) {
          // This covers TEST F: expired/revoked refresh token — getSession returns null.
          // Show login cleanly; no loop because LoginPage does not call getSession.
          setPhase('login')
          return
        }

        setSession(session)
        const result = await (window as any).propel.entitlements.fetch(session.access_token)
        
        if (result.ok) {
          setEntitlementStatus({
            status: 'active',
            plan: result.data.plan,
            source: result.data.source,
            trial_active: result.data.trial_active,
            trial_expires_at: result.data.trial_expires_at,
            subscription_status: result.data.subscription_status
          })
          setPhase('main')
        } else {
          if (result.networkError) {
             setPhase('no_internet')
          } else {
             setEntitlementStatus({ status: 'error', plan: 'FREE', source: 'plan', trial_active: false, trial_expires_at: null, subscription_status: '' })
             setPhase('login')
          }
        }
      } catch {
        setEntitlementStatus({ status: 'error', plan: 'FREE', source: 'plan', trial_active: false, trial_expires_at: null, subscription_status: '' })
        const elapsed = Date.now() - startedAt
        await new Promise(r => setTimeout(r, Math.max(0, MIN_DISPLAY_MS - elapsed)))
        setPhase('login')
      }
    }

    const timer = setTimeout(bootstrap, 700)
    intervals.push(timer)
    return () => intervals.forEach(clearTimeout)
  }, [setPhase, setEntitlementStatus, setSession])

  return (
    <div className="fixed inset-0 bg-bg-base flex items-center justify-center overflow-hidden z-50">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-[120px]" style={{ background: 'var(--t-app-bloom-1)' }} />
        <div className="absolute top-1/4 left-1/3 w-80 h-80 rounded-full blur-3xl" style={{ background: 'var(--t-app-bloom-2)' }} />
        <div className="absolute bottom-1/4 right-1/3 w-80 h-80 rounded-full blur-3xl" style={{ background: 'var(--t-app-bloom-3)' }} />
      </div>
      <div className="absolute inset-0 grid-bg opacity-30" />

      <motion.div
        variants={splashVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="relative z-10 flex flex-col items-center select-none"
      >
        {/* Logo cluster */}
        <div className="relative mb-10">
          {/* Outer pulse rings */}
          <motion.div
            className="absolute inset-[-20px] rounded-3xl border"
            style={{ borderColor: 'rgb(var(--t-accent) / 0.12)' }}
            animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.1, 0.4] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute inset-[-10px] rounded-3xl border"
            style={{ borderColor: 'rgb(var(--t-accent) / 0.22)' }}
            animate={{ scale: [1, 1.05, 1], opacity: [0.6, 0.2, 0.6] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
          />
          {/* Glow backdrop */}
          <motion.div
            className="absolute inset-0 rounded-3xl blur-xl"
            style={{ background: 'rgb(var(--t-accent) / 0.14)' }}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Icon */}
          <motion.div
            className="relative w-20 h-20 rounded-3xl bg-gradient-brand flex items-center justify-center shadow-glow-lg"
            animate={{ rotate: [0, 3, -3, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <AnimatePresence mode="wait">
              {done ? (
                <motion.div key="check"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  <CheckCircle2 className="w-9 h-9 text-white" />
                </motion.div>
              ) : (
                <motion.div key="shield"
                  initial={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                >
                  <Shield className="w-9 h-9 text-white" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Brand text */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-3xl font-bold gradient-text tracking-tight mb-1.5"
        >
          Propel
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="text-sm text-text-secondary"
        >
          Advanced Windows System Optimizer
        </motion.p>

        {/* Progress track */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-10 w-52"
        >
          <div className="h-px rounded-full overflow-hidden mb-4" style={{ background: 'rgb(var(--t-border) / 0.12)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'var(--t-progress-gradient)' }}
              animate={{
                width: done ? '100%' : `${((stepIndex + 1) / BOOT_STEPS.length) * 100}%`,
              }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>

          {/* Step message */}
          <div className="h-5 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.p
                key={stepIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="text-xs text-text-muted text-center"
              >
                {BOOT_STEPS[stepIndex]}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Step dots */}
          <div className="flex justify-center gap-1.5 mt-4">
            {BOOT_STEPS.map((_, i) => (
              <motion.div
                key={i}
                className="rounded-full"
                animate={{
                  width: i === stepIndex ? 16 : 4,
                  backgroundColor: i <= stepIndex ? 'rgb(var(--t-accent))' : 'rgb(var(--t-border) / 0.18)',
                }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                style={{ height: 4 }}
              />
            ))}
          </div>
        </motion.div>

        {/* Version tag */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-[-72px] flex items-center gap-1.5 text-text-muted"
        >
          <Zap className="w-3 h-3" />
          <span className="text-xs">Version 3.2.0</span>
        </motion.div>
      </motion.div>
    </div>
  )
}
