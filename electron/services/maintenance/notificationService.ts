import { Notification } from 'electron'
import si from 'systeminformation'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { loadSettings } from './automationStore'
import { getAppIconPath } from '../../main/icon'
import { runAutoClean } from './schedulerService'
import { permissionsService, getStartupEntries } from '../permissions/permissionsService'

// ── Constants ──────────────────────────────────────────────────────────────
const RAM_POLL_MS     = 15_000        // check RAM every 15 seconds
const DISK_POLL_MS    = 60_000        // check Disk every minute
const JUNK_POLL_MS    = 5 * 60_000   // check Junk every 5 minutes
const STARTUP_POLL_MS = 60_000       // check Startup every minute

const COOLDOWN_MS = 5 * 60_000       // min 5 minutes between disk/ram notifications

let _ramTimer: ReturnType<typeof setInterval> | null = null
let _diskTimer: ReturnType<typeof setInterval> | null = null
let _junkTimer: ReturnType<typeof setInterval> | null = null
let _startupTimer: ReturnType<typeof setInterval> | null = null

let _lastRamNotifiedAt  = 0
let _lastDiskNotifiedAt = 0
let _lastJunkNotifiedSize = 0
let _knownStartupApps: Set<string> | null = null

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Normalise a filesystem mount string for comparison.
 * Handles: "C:", "C:/", "C:\", "c:/", "c:\" → "C:"
 */
function normalisedMount(raw: unknown): string {
  return String(raw ?? '')
    .replace(/[/\\]+$/, '')   // strip trailing slashes
    .toUpperCase()
    .trim()
}

/**
 * Select the OS/system drive from a list of fsSize entries.
 * Priority order:
 *   1. Windows C: drive (any case / trailing slash variant)
 *   2. Unix root mount "/"
 *   3. First drive in the list (last-resort fallback)
 */
function selectOsDrive(drives: Awaited<ReturnType<typeof si.fsSize>>): typeof drives[0] | undefined {
  return (
    drives.find(d => normalisedMount(d.mount) === 'C:') ??
    drives.find(d => d.mount === '/') ??
    drives[0]
  )
}

/**
 * Safely fire an Electron Notification, capturing any construction / show error
 * explicitly rather than letting it propagate silently.
 */
function fireNotification(opts: ConstructorParameters<typeof Notification>[0]): boolean {
  try {
    if (!Notification.isSupported()) return false
    const n = new Notification(opts)
    n.show()
    return true
  } catch (err) {
    console.error('[Notification] Failed to create/show notification:', err)
    return false
  }
}

// ── Checkers ───────────────────────────────────────────────────────────────

async function checkRam(): Promise<void> {
  try {
    const settings = await loadSettings()
    const enabled   = settings.ramAlertsEnabled
    const threshold = settings.ramAlertThreshold ?? 85

    if (!enabled) return   // intentionally silent — alerts are off

    const mem      = await si.mem()
    const diskUsage = (mem.used / mem.total) * 100
    const now       = Date.now()
    const cooldownActive  = (now - _lastRamNotifiedAt) < COOLDOWN_MS
    const conditionMet    = diskUsage >= threshold

    console.log(
      `[NotifAudit:RAM] enabled=${enabled} ramUsage=${diskUsage.toFixed(1)}% ` +
      `threshold=${threshold}% conditionMet=${conditionMet} cooldownActive=${cooldownActive}`
    )

    if (!conditionMet || cooldownActive) return

    _lastRamNotifiedAt = now
    const notifSupported = Notification.isSupported()
    const notifTriggered = fireNotification({
      title:   'Propel — High Memory Usage',
      body:    `RAM usage is at ${Math.round(diskUsage)}% — optimization recommended.`,
      urgency: 'normal',
      icon:    getAppIconPath(),
    })

    console.log(
      `[NotifAudit:RAM] notificationSupported=${notifSupported} notificationTriggered=${notifTriggered}`
    )
  } catch (err) {
    console.error('[NotifAudit:RAM] Unexpected error in checkRam:', err)
  }
}

async function checkDisk(): Promise<void> {
  try {
    const settings  = await loadSettings()
    const enabled   = settings.diskAlertsEnabled
    const threshold = settings.diskAlertThreshold

    if (!enabled) return   // intentionally silent — alerts are off

    const drives    = await si.fsSize()
    const mainDrive = selectOsDrive(drives)

    // --- Structured audit log (all gates in one line for easy grepping) ---
    const mount         = mainDrive?.mount ?? '(none)'
    const diskUsage     = mainDrive?.use ?? -1
    const conditionMet  = diskUsage >= threshold
    const now           = Date.now()
    const cooldownActive = (now - _lastDiskNotifiedAt) < COOLDOWN_MS

    console.log(
      `[NotifAudit:Disk] enabled=${enabled} mount=${mount} ` +
      `diskUsage=${diskUsage.toFixed(2)}% threshold=${threshold}% ` +
      `conditionMet=${conditionMet} cooldownActive=${cooldownActive}`
    )

    if (!mainDrive) {
      console.warn('[NotifAudit:Disk] No drive selected — skipping')
      return
    }

    if (!conditionMet || cooldownActive) return

    _lastDiskNotifiedAt = now
    const notifSupported = Notification.isSupported()
    const notifTriggered = fireNotification({
      title:   'Propel — High Disk Usage',
      body:    `Disk ${mainDrive.mount} usage is at ${Math.round(diskUsage)}%.`,
      urgency: 'normal',
      icon:    getAppIconPath(),
    })

    console.log(
      `[NotifAudit:Disk] notificationSupported=${notifSupported} notificationTriggered=${notifTriggered}`
    )
  } catch (err) {
    console.error('[NotifAudit:Disk] Unexpected error in checkDisk:', err)
  }
}

async function getDirSize(dirPath: string): Promise<number> {
  let total = 0
  if (!fsSync.existsSync(dirPath)) return 0
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        total += await getDirSize(full).catch(() => 0)
      } else {
        total += await fs.stat(full).then(s => s.size).catch(() => 0)
      }
    }
  } catch { /* skip */ }
  return total
}

async function checkJunk(): Promise<void> {
  try {
    const settings = await loadSettings()
    if (!settings.junkAlertsEnabled) return

    const localAppData = process.env.LOCALAPPDATA ?? ''
    const systemTemp   = process.env.TEMP ?? ''

    const dirs = [
      path.join(localAppData, 'Temp'),
      systemTemp,
      'C:\\Windows\\Temp',
    ]

    let totalBytes = 0
    for (const dir of dirs) {
      totalBytes += await getDirSize(dir)
    }

    const totalGb = totalBytes / (1024 * 1024 * 1024)

    if (totalGb < settings.junkAlertThreshold) {
      _lastJunkNotifiedSize = 0
      return
    }

    if (_lastJunkNotifiedSize > 0 && Math.abs(totalBytes - _lastJunkNotifiedSize) < 500 * 1024 * 1024) {
      return
    }

    _lastJunkNotifiedSize = totalBytes

    if (!Notification.isSupported()) return

    const n = new Notification({
      title:   'Propel — Junk Files Detected',
      body:    `You have ${totalGb.toFixed(1)} GB of temporary files. Click to clean now.`,
      urgency: 'normal',
      icon:    getAppIconPath(),
    })
    n.on('click', async () => {
      try {
        const res   = await runAutoClean()
        const total = res.tempCleaned + res.browserCleaned
        fireNotification({
          title: 'Propel — Cleanup Complete',
          body:  `Cleaned ${total} temporary items.`,
          icon:  getAppIconPath(),
        })
        _lastJunkNotifiedSize = 0
      } catch { /* skip */ }
    })
    n.show()
  } catch { /* skip */ }
}

async function checkStartup(): Promise<void> {
  try {
    const settings = await loadSettings()
    if (!settings.startupAlertsEnabled) return

    const entries = await getStartupEntries()
    const current = new Set(entries.map(e => e.name.toLowerCase()))

    if (_knownStartupApps === null) {
      _knownStartupApps = current
      return
    }

    for (const app of current) {
      if (!_knownStartupApps.has(app)) {
        fireNotification({
          title:   'Propel — New Startup App',
          body:    `"${app}" has been added to Windows startup.`,
          urgency: 'normal',
          icon:    getAppIconPath(),
        })
      }
    }
    _knownStartupApps = current
  } catch { /* skip */ }
}

// ── Event Handlers ─────────────────────────────────────────────────────────

function handlePermissionAccess(acc: any) {
  loadSettings().then(settings => {
    if (!settings.permissionAlertsEnabled) return

    const deviceName = acc.device === 'camera'     ? 'Camera'
                     : acc.device === 'microphone' ? 'Microphone'
                     : acc.device === 'location'   ? 'Location'
                     : acc.device

    fireNotification({
      title:   'Propel — Permission Alert',
      body:    `"${acc.app}" is accessing your ${deviceName}.`,
      urgency: 'normal',
      icon:    getAppIconPath(),
    })
  }).catch(() => {})
}

function handleConsentChanged(change: { device: string; app: string; oldValue: string; newValue: string }) {
  loadSettings().then(settings => {
    if (!settings.permissionAlertsEnabled) return

    const deviceName = change.device === 'webcam'      ? 'Camera'
                     : change.device === 'microphone'  ? 'Microphone'
                     : change.device === 'location'    ? 'Location'
                     : change.device

    const appName    = change.app === 'NonPackaged' ? 'Desktop apps' : `"${change.app}"`
    const actionStr  = change.newValue === 'Allow' ? 'was granted'
                     : change.newValue === 'Deny'  ? 'was revoked'
                     : 'was changed'

    fireNotification({
      title:   'Propel — Permission Settings Changed',
      body:    `${deviceName} access for ${appName} ${actionStr} in Windows settings.`,
      urgency: 'normal',
      icon:    getAppIconPath(),
    })
  }).catch(() => {})
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

export function startNotificationService(): void {
  if (!_ramTimer) {
    checkRam().catch(err => console.error('[NotifAudit:RAM] initial check failed:', err))
    _ramTimer = setInterval(() => { checkRam().catch(() => {}) }, RAM_POLL_MS)
    _ramTimer.unref()
  }

  if (!_diskTimer) {
    checkDisk().catch(err => console.error('[NotifAudit:Disk] initial check failed:', err))
    _diskTimer = setInterval(() => { checkDisk().catch(() => {}) }, DISK_POLL_MS)
    _diskTimer.unref()
  }

  if (!_junkTimer) {
    _junkTimer = setInterval(() => { checkJunk().catch(() => {}) }, JUNK_POLL_MS)
    _junkTimer.unref()
  }

  if (!_startupTimer) {
    _startupTimer = setInterval(() => { checkStartup().catch(() => {}) }, STARTUP_POLL_MS)
    _startupTimer.unref()
  }

  permissionsService.on('access-started', handlePermissionAccess)
  permissionsService.on('consent-changed', handleConsentChanged)
}

export function stopNotificationService(): void {
  if (_ramTimer)     { clearInterval(_ramTimer);     _ramTimer     = null }
  if (_diskTimer)    { clearInterval(_diskTimer);    _diskTimer    = null }
  if (_junkTimer)    { clearInterval(_junkTimer);    _junkTimer    = null }
  if (_startupTimer) { clearInterval(_startupTimer); _startupTimer = null }

  permissionsService.removeListener('access-started', handlePermissionAccess)
  permissionsService.removeListener('consent-changed', handleConsentChanged)
}
