import { useEffect, useRef } from 'react'
import { useAppStore, selectSetStats, selectPhase } from '@/store/appStore'

const ACTIVE_POLL_MS = 3000
const IDLE_POLL_MS = 12000

export function useSystemStats(enabled = true): void {
  const setStats = useAppStore(selectSetStats)
  const phase = useAppStore(selectPhase)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hiddenRef = useRef(false)

  useEffect(() => {
    if (!enabled || phase !== 'main') return

    const handleVisibility = () => {
      hiddenRef.current = document.hidden
    }
    document.addEventListener('visibilitychange', handleVisibility)

    let pollMs = ACTIVE_POLL_MS

    const fetchStats = async () => {
      try {
        const stats = await window.electronAPI.system.getStats()
        setStats(stats)
      } catch {
        // silently ignore
      }
    }

    const scheduleNext = () => {
      if (timerRef.current) clearInterval(timerRef.current)
      pollMs = hiddenRef.current ? IDLE_POLL_MS : ACTIVE_POLL_MS
      timerRef.current = setInterval(() => {
        fetchStats()
        const nextMs = hiddenRef.current ? IDLE_POLL_MS : ACTIVE_POLL_MS
        if (pollMs !== nextMs) {
          pollMs = nextMs
          if (timerRef.current) clearInterval(timerRef.current)
          timerRef.current = setInterval(() => fetchStats(), pollMs)
        }
      }, pollMs)
    }

    fetchStats()
    scheduleNext()

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [enabled, phase, setStats])
}
