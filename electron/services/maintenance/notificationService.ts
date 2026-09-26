import { Notification } from 'electron'
import si from 'systeminformation'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import os from 'os'
import { loadSettings } from './automationStore'
import { getAppIconPath } from '../../main/icon'
import { runAutoClean } from './schedulerService'
import { permissionsService, getStartupEntries } from '../permissions/permissionsService'

// ── Constants ──────────────────────────────────────────────────────────────
const RAM_POLL_MS    = 15_000         // check RAM every 15 seconds
const DISK_POLL_MS   = 60_000         // check Disk every minute
const JUNK_POLL_MS   = 5 * 60_000     // check Junk every 5 minutes
const STARTUP_POLL_MS = 60_000        // check Startup every minute

const COOLDOWN_MS  = 5 * 60_000       // min 5 minutes between disk/ram notifications

let _ramTimer: ReturnType<typeof setInterval> | null = null
let _diskTimer: ReturnType<typeof setInterval> | null = null
let _junkTimer: ReturnType<typeof setInterval> | null = null
let _startupTimer: ReturnType<typeof setInterval> | null = null

let _lastRamNotifiedAt = 0
let _lastDiskNotifiedAt = 0
let _lastJunkNotifiedSize = 0
let _knownStartupApps: Set<string> | null = null

// ── Checkers ───────────────────────────────────────────────────────────────

async function checkRam(): Promise<void> {
  try {
    const settings = await loadSettings()
    if (!settings.ramAlertsEnabled) return

    const mem = await si.mem()
    const usedPct = (mem.used / mem.total) * 100
    if (usedPct < (settings.ramAlertThreshold ?? 85)) return

    const now = Date.now()
    if (now - _lastRamNotifiedAt < COOLDOWN_MS) return
    _lastRamNotifiedAt = now

    if (Notification.isSupported()) {
      new Notification({
        title: 'Propel — High Memory Usage',
        body:  `RAM usage is at ${Math.round(usedPct)}% — optimization recommended.`,
        urgency: 'normal',
        icon: getAppIconPath(),
      }).show()
    }
  } catch { /* skip */ }
}

async function checkDisk(): Promise<void> {
  try {
    const settings = await loadSettings()
    if (!settings.diskAlertsEnabled) return

    const drives = await si.fsSize()
    // Find the main OS drive or any drive that exceeds the threshold
    const mainDrive = drives.find(d => d.mount === 'C:' || d.mount === '/') || drives[0]
    if (!mainDrive) return

    if (mainDrive.use < settings.diskAlertThreshold) return

    const now = Date.now()
    if (now - _lastDiskNotifiedAt < COOLDOWN_MS) return
    _lastDiskNotifiedAt = now

    if (Notification.isSupported()) {
      new Notification({
        title: 'Propel — High Disk Usage',
        body:  `Disk ${mainDrive.mount} usage is at ${Math.round(mainDrive.use)}%.`,
        urgency: 'normal',
        icon: getAppIconPath(),
      }).show()
    }
  } catch { /* skip */ }
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
    
    // Quick size estimate of standard temp dirs
    const dirs = [
      path.join(localAppData, 'Temp'),
      systemTemp,
      'C:\\Windows\\Temp'
    ]

    let totalBytes = 0
    for (const dir of dirs) {
      totalBytes += await getDirSize(dir)
    }

    const totalGb = totalBytes / (1024 * 1024 * 1024)
    
    // If under threshold, clear our known notification state
    if (totalGb < settings.junkAlertThreshold) {
      _lastJunkNotifiedSize = 0
      return
    }

    // If over threshold but we already notified for this rough size (+/- 500MB), skip
    if (_lastJunkNotifiedSize > 0 && Math.abs(totalBytes - _lastJunkNotifiedSize) < 500 * 1024 * 1024) {
      return
    }

    _lastJunkNotifiedSize = totalBytes

    if (Notification.isSupported()) {
      const n = new Notification({
        title: 'Propel — Junk Files Detected',
        body:  `You have ${totalGb.toFixed(1)} GB of temporary files. Click to clean now.`,
        urgency: 'normal',
        icon: getAppIconPath(),
      })
      n.on('click', async () => {
        try {
          const res = await runAutoClean()
          const total = res.tempCleaned + res.browserCleaned
          new Notification({
            title: 'Propel — Cleanup Complete',
            body: `Cleaned ${total} temporary items.`,
            icon: getAppIconPath()
          }).show()
          _lastJunkNotifiedSize = 0 // reset so it triggers again next time it fills up
        } catch { /* skip */ }
      })
      n.show()
    }
  } catch { /* skip */ }
}

async function checkStartup(): Promise<void> {
  try {
    const settings = await loadSettings()
    if (!settings.startupAlertsEnabled) return

    const entries = await getStartupEntries()
    const current = new Set(entries.map(e => e.name.toLowerCase()))

    if (_knownStartupApps === null) {
      // First run: just initialize the baseline
      _knownStartupApps = current
      return
    }

    // Find new apps
    for (const app of current) {
      if (!_knownStartupApps.has(app)) {
        if (Notification.isSupported()) {
          new Notification({
            title: 'Propel — New Startup App',
            body:  `"${app}" has been added to Windows startup.`,
            urgency: 'normal',
            icon: getAppIconPath(),
          }).show()
        }
      }
    }
    _knownStartupApps = current
  } catch { /* skip */ }
}

// ── Event Handlers ─────────────────────────────────────────────────────────

function handlePermissionAccess(acc: any) {
  loadSettings().then(settings => {
    if (!settings.permissionAlertsEnabled) return
    if (!Notification.isSupported()) return

    // "acc" is ActiveAccess: { device: string, app: string }
    const deviceName = acc.device === 'camera' ? 'Camera' 
                     : acc.device === 'microphone' ? 'Microphone'
                     : acc.device === 'location' ? 'Location'
                     : acc.device
    
    new Notification({
      title: 'Propel — Permission Alert',
      body: `"${acc.app}" is accessing your ${deviceName}.`,
      urgency: 'normal',
      icon: getAppIconPath(),
    }).show()
  }).catch(() => {})
}

function handleConsentChanged(change: { device: string, app: string, oldValue: string, newValue: string }) {
  loadSettings().then(settings => {
    if (!settings.permissionAlertsEnabled) return
    if (!Notification.isSupported()) return

    const deviceName = change.device === 'webcam' ? 'Camera'
                     : change.device === 'microphone' ? 'Microphone'
                     : change.device === 'location' ? 'Location'
                     : change.device

    const appName = change.app === 'NonPackaged' ? 'Desktop apps' : `"${change.app}"`
    
    let actionStr = 'was changed'
    if (change.newValue === 'Allow') actionStr = 'was granted'
    if (change.newValue === 'Deny') actionStr = 'was revoked'

    new Notification({
      title: 'Propel — Permission Settings Changed',
      body: `${deviceName} access for ${appName} ${actionStr} in Windows settings.`,
      urgency: 'normal',
      icon: getAppIconPath(),
    }).show()
  }).catch(() => {})
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

export function startNotificationService(): void {
  if (!_ramTimer) {
    _ramTimer = setInterval(() => { checkRam().catch(() => {}) }, RAM_POLL_MS)
    _ramTimer.unref()
  }
  if (!_diskTimer) {
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

  // Hook permissions event
  permissionsService.on('access-started', handlePermissionAccess)
  permissionsService.on('consent-changed', handleConsentChanged)
}

export function stopNotificationService(): void {
  if (_ramTimer) { clearInterval(_ramTimer); _ramTimer = null }
  if (_diskTimer) { clearInterval(_diskTimer); _diskTimer = null }
  if (_junkTimer) { clearInterval(_junkTimer); _junkTimer = null }
  if (_startupTimer) { clearInterval(_startupTimer); _startupTimer = null }

  permissionsService.removeListener('access-started', handlePermissionAccess)
  permissionsService.removeListener('consent-changed', handleConsentChanged)
}

