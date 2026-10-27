import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/store/appStore'
import { logout } from '@/services/auth/logout'

/**
 * Ends on the Login screen when Supabase reports the session is gone
 * (refresh token revoked/expired on the server). Uses the single logout, so
 * the cached plan and tokens are cleared too. No loop: logout is idempotent
 * and the Login screen never emits SIGNED_OUT.
 */
export function useSessionGuard(): void {
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT') return
      if (useAppStore.getState().phase !== 'main') return
      void logout({ reason: 'session-ended', releaseDevice: false })
    })
    return () => data.subscription.unsubscribe()
  }, [])
}
