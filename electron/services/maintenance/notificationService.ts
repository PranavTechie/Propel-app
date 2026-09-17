import { Notification } from 'electron'
import si from 'systeminformation'
import { loadSettings } from './automationStore'
import { getAppIconPath } from '../../main/icon'

// ── Constants ──────────────────────────────────────────────────────────────
const POLL_MS      = 15_000          // check RAM every 15 seconds
const COOLDOWN_MS  = 5 * 60_000     // min 5 minutes between notifications
const RAM_THRESHOLD = 85             // percent

let _timer: ReturnType<typeof setInterval> | null = null
let _lastNotifiedAt = 0

// ── RAM check + notification ───────────────────────────────────────────────
async function checkRam(): Promise<void> {
  try {
    // loadSettings is async — must be awaited or ramAlertsEnabled is always a truthy Promise
    const settings = await loadSettings()
    if (!settings.ramAlertsEnabled) return

    const mem        = await si.mem()
    const usedPct    = (mem.used / mem.total) * 100

    if (usedPct < RAM_THRESHOLD) return

    const now = Date.now()
    if (now - _lastNotifiedAt < COOLDOWN_MS) return

    _lastNotifiedAt = now

    if (Notification.isSupported()) {
      new Notification({
        title: 'Propel — High Memory Usage',
        body:  `RAM usage is at ${Math.round(usedPct)}% — optimization recommended.`,
        urgency: 'normal',
        icon: getAppIconPath(),
      }).show()
    }
  } catch { /* systeminformation / notification failure — non-fatal */ }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────
export function startNotificationService(): void {
  if (_timer) return
  _timer = setInterval(() => { checkRam().catch(() => {}) }, POLL_MS)
  _timer.unref()
}

export function stopNotificationService(): void {
  if (_timer) { clearInterval(_timer); _timer = null }
}
