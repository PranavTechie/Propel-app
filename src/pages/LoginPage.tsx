import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, ArrowRight, Loader2, Globe, UserPlus } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'

export const LoginPage: React.FC = () => {
  const setPhase = useAppStore(s => s.setPhase)
  const setSession = useAppStore(s => s.setSession)
  const setEntitlementStatus = useAppStore(s => s.setEntitlementStatus)

  const [loading, setLoading] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Listen for the deep link callback from the main process
    window.electronAPI.auth.onCallback(async (url: string) => {
      try {
        setLoading(true)
        setError(null)
        setWaiting(false)

        console.log('[AUTH 2] Callback received')
        const parsedUrl = new URL(url)
        const code = parsedUrl.searchParams.get('code')
        console.log(`[AUTH 3] Code extracted: ${!!code}`)

        if (!code) {
          throw new Error('Authentication code not found.')
        }

        console.log('[AUTH 4] IPC exchange called')
        const data = await (window as any).electronAPI.auth.exchangeAuthCode(code)
        console.log('[AUTH 6] Backend response received')
        
        if (!data.ok || !data.session) {
          console.error('[AUTH ERROR]', data)
          const errorMsg = data.status 
            ? `Authentication exchange failed (HTTP ${data.status})` 
            : 'Unable to reach authentication server'
          throw new Error(errorMsg)
        }

        console.log('[AUTH 7] Supabase setSession started')
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        })

        if (sessionError) throw sessionError

        console.log('[AUTH 8] Authentication completed')
        setSession(data.session)
        
        // Fetch entitlements via IPC
        setEntitlementStatus({ status: 'checking', plan: 'FREE', source: 'plan', trial_active: false, trial_expires_at: null, subscription_status: '' })
        const result = await (window as any).propel.entitlements.fetch(data.session.access_token)
        
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
          setError(result.message || 'Failed to fetch account status.')
          setEntitlementStatus({ status: 'error', plan: 'FREE', source: 'plan', trial_active: false, trial_expires_at: null, subscription_status: '' })
        }
      } catch (err: any) {
        setError(err.message || 'Authentication failed. Please try again.')
      } finally {
        setLoading(false)
      }
    })
  }, [setPhase, setSession, setEntitlementStatus])

  const handleLogIn = () => {
    console.log('[AUTH 1] Log In clicked')
    setError(null)
    setWaiting(true)
    window.electronAPI.shell.openExternal('https://cleanmasterpro.in/auth/desktop')
  }

  const handleSignUp = () => {
    console.log('[AUTH 1] Sign Up clicked')
    setError(null)
    window.electronAPI.shell.openExternal('https://cleanmasterpro.in/signup?source=desktop')
  }

  const handleCancel = () => {
    setWaiting(false)
    setError(null)
  }

  return (
    <div className="fixed inset-0 bg-bg-base flex items-center justify-center overflow-hidden z-40 selection:bg-brand-500/30">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-brand-500/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-brand-500/5 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/3" />
      </div>
      <div className="absolute inset-0 grid-bg opacity-30" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-[400px] p-8 rounded-2xl bg-bg-panel/80 backdrop-blur-xl border border-white/[0.04] shadow-2xl flex flex-col items-center"
      >
        <div className="w-14 h-14 rounded-2xl bg-gradient-brand flex items-center justify-center shadow-glow-lg mb-6">
          <Shield className="w-7 h-7 text-white" />
        </div>

        <h1 className="text-2xl font-semibold text-white mb-2 tracking-tight text-center">Sign in to Propel</h1>
        <p className="text-sm text-t-muted mb-8 text-center max-w-[280px]">
          Access your premium optimization suite and manage your account.
        </p>

        <div className="w-full flex flex-col gap-4">
          <AnimatePresence mode="wait">
            {waiting ? (
              <motion.div
                key="waiting"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex flex-col items-center gap-4 py-4"
              >
                <div className="relative">
                  <Globe className="w-10 h-10 text-brand-400 opacity-20" />
                  <Loader2 className="w-10 h-10 text-brand-400 absolute top-0 left-0 animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-white font-medium mb-1">Waiting for browser…</p>
                  <p className="text-sm text-t-muted">Please complete the sign in process in your web browser.</p>
                </div>
                <div className="flex gap-2 w-full mt-2">
                  <Button variant="ghost" className="flex-1 h-10 text-xs" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button variant="secondary" className="flex-1 h-10 text-xs" onClick={handleLogIn}>
                    Open Browser Again
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="action"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex flex-col gap-3"
              >
                {/* Primary: Log In */}
                <Button
                  id="desktop-login-btn"
                  onClick={handleLogIn}
                  variant="primary"
                  disabled={loading}
                  className="w-full h-11"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>Log In <ArrowRight className="w-4 h-4 ml-1" /></>
                  )}
                </Button>

                {/* Secondary: Sign Up */}
                <Button
                  id="desktop-signup-btn"
                  onClick={handleSignUp}
                  variant="secondary"
                  disabled={loading}
                  className="w-full h-11"
                >
                  <UserPlus className="w-4 h-4 mr-1" /> Sign Up
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="text-red-400 text-sm text-center"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
