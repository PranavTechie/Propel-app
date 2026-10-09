import { useEffect, useRef } from 'react'
import { useAppStore, selectSession, selectPhase } from '@/store/appStore'

const PING_INTERVAL = 6 * 60 * 60 * 1000 // 6 hours

const API_BASE = 'https://propel-backend.onrender.com/api' // using prod url

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
        const { device_id: deviceId, registered_at } = await window.electronAPI.system.getDeviceUUID()
        const isNewLogin = !registered_at
        
        // Use localhost in dev if you want, but for now fallback to Render backend
        const baseUrl = process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:5000/api' : API_BASE

        const response = await fetch(`${baseUrl}/devices/ping`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            device_id: deviceId,
            device_name: 'Windows PC',
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
              // Sign out locally
              resetUserSession()
              setPhase('login')
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
