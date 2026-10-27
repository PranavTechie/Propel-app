import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store/appStore'
import { supabase } from '@/lib/supabase'

const FOCUS_DEBOUNCE_MS = 60 * 1000       // 1 minute
const VISIBLE_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes
const HIDDEN_INTERVAL_MS  = 60 * 60 * 1000 // 1 hour

export function useEntitlementRefresh(): void {
  const session = useAppStore(s => s.session)
  const setEntitlementStatus = useAppStore(s => s.setEntitlementStatus)
  const addToast = useAppStore(s => s.addToast)

  const lastRefreshTimeRef = useRef<number>(Date.now())
  const prevPlanRef = useRef<string | null>(null)

  useEffect(() => {
    if (!session) return

    const doRefresh = async (isFocusTrigger = false) => {
      const now = Date.now()
      if (isFocusTrigger && (now - lastRefreshTimeRef.current) < FOCUS_DEBOUNCE_MS) {
        return // debounced
      }

      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token || session.access_token
        if (!token) return

        const result = await (window as any).propel?.entitlements?.fetch(token)
        // Signed out while the request was in flight: drop the result.
        if (!useAppStore.getState().session) return
        if (!result || !result.ok || !result.data) {
          if (result?.networkError) {
            useAppStore.setState(prev => ({
              entitlementStatus: { ...prev.entitlementStatus, isOffline: true }
            }))
          }
          return
        }

        lastRefreshTimeRef.current = Date.now()
        const currentStoredPlan = useAppStore.getState().entitlementStatus.plan
        const prevPlan = prevPlanRef.current ?? currentStoredPlan
        const newPlan = result.data.plan

        setEntitlementStatus({
          status: 'active',
          plan: result.data.plan,
          source: result.data.source,
          trial_active: result.data.trial_active,
          trial_expires_at: result.data.trial_expires_at,
          subscription_status: result.data.subscription_status,
          limits: result.data.limits,
          features: result.data.features,
          expiresAt: result.data.expiresAt,
          serverTime: result.data.serverTime,
          fetchedAt: Date.now(),
          isOffline: false,
        })

        // Check for plan change while running
        if (prevPlan && prevPlan !== newPlan) {
          addToast({
            type: 'info',
            title: 'Plan Updated',
            description: `Your plan is now ${newPlan}`,
          })

          // When first entitled to PRO/MAX/trial: default scheduleEnabled ON
          if (prevPlan === 'FREE' && newPlan !== 'FREE') {
            try {
              const currentSettings = await (window as any).propel?.maintenance?.getSettings()
              if (currentSettings && !currentSettings.scheduleEnabled) {
                await (window as any).propel?.maintenance?.updateSettings({ scheduleEnabled: true })
              }
            } catch {}
          }

          // Re-sync Windows Task Scheduler immediately
          try {
            await (window as any).propel?.maintenance?.syncScheduler()
          } catch {}
        }

        prevPlanRef.current = newPlan
      } catch (err) {
        console.warn('[EntitlementRefresh] Refresh error:', err)
      }
    }

    // Set initial plan reference
    prevPlanRef.current = useAppStore.getState().entitlementStatus.plan

    // Window focus listener
    const onFocus = () => {
      doRefresh(true).catch(() => {})
    }
    window.addEventListener('focus', onFocus)

    // Dynamic timer based on visibility
    let timer: NodeJS.Timeout | null = null

    const scheduleNext = () => {
      if (timer) clearTimeout(timer)
      const interval = document.visibilityState === 'hidden' ? HIDDEN_INTERVAL_MS : VISIBLE_INTERVAL_MS
      timer = setTimeout(async () => {
        await doRefresh(false)
        scheduleNext()
      }, interval)
    }

    const onVisibilityChange = () => {
      scheduleNext()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    scheduleNext()

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (timer) clearTimeout(timer)
    }
  }, [session, setEntitlementStatus, addToast])
}
