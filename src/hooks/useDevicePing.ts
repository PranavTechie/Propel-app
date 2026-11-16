import { useEffect, useRef } from 'react'
import { useAppStore, selectSession, selectPhase } from '@/store/appStore'
import { logout, flushPendingDeviceRelease } from '@/services/auth/logout'
import { apiUrl } from '@/lib/api'

const PING_INTERVAL = 6 * 60 * 60 * 1000 // 6 hours

export function useDevicePing() {
  const session = useAppStore(selectSession)
  const phase = useAppStore(selectPhase)
  const setPhase = useAppStore(s => s.setPhase)
  const resetUserSession = useAppStore(s => s.resetUserSession)
  
  const hasPinged = useRef(false)

  useEffect(() => {
    if (phase !== 'main' || !session) return
    if (hasPinged.current) return
    hasPinged.current = true

    let intervalId: ReturnType<typeof setInterval>

    const ping = async () => {
      try {
        // A logout that happened offline queued a device release: retry it now.
        await flushPendingDeviceRelease(session.access_token).catch(() => {})
        const { device_id: deviceId, registered_at } = await window.electronAPI.system.getDeviceUUID()
        const isNewLogin = !registered_at
        const deviceName = (await window.electronAPI.system.getDeviceName().catch(() => '')).slice(0, 100) || 'Windows PC'
        
        const response = await fetch(apiUrl('/devices/ping'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            device_id: deviceId,
            device_name: deviceName,
            os_info: 'Windows',
            register: isNewLogin
          })
        })

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          if (response.status === 403) {
            if (data.code === 'DEVICE_LIMIT_REACHED') {
              setPhase('device_limit')
            } else if (data.code === 'DEVICE_REMOVED') {
              // Full local sign-out (tokens, cached plan, license), not just memory
              await logout({ reason: 'device-removed', releaseDevice: false })
            }
          }
          // Network errors, timeouts, and 5xx must never sign the user out, handled by falling through
        } else {
          // Success
          if (isNewLogin) {
            await window.electronAPI.system.markDeviceRegistered()
          }
        }
      } catch (err) {
        // Network error, ignore. Last cached successful check allows usage.
      }
    }

    ping()
    intervalId = setInterval(ping, PING_INTERVAL)

    return () => clearInterval(intervalId)
  }, [phase, session, setPhase, resetUserSession])
}
