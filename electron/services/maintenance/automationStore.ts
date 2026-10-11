import fs from 'fs/promises'
import fsSync from 'fs'
import { getMaintenanceFilePath } from '../../utils/userData'

// ── Settings shape ─────────────────────────────────────────────────────────
export interface MaintenanceSettings {
  // Auto cleaning
  scheduleEnabled:            boolean
  scheduleFrequency:          'daily' | 'weekly' | 'monthly'
  recycleBinEnabled:          boolean
  ignoreDownloads:            boolean

  // Browser cache
  browserMasterEnabled:       boolean
  browserChrome:              boolean
  browserEdge:                boolean
  browserBrave:               boolean
  browserFirefox:             boolean

  // Startup
  startupEnabled:             boolean

  // Alerts
  ramAlertsEnabled:           boolean
  ramAlertThreshold:          number
  diskAlertsEnabled:          boolean
  diskAlertThreshold:         number
  junkAlertsEnabled:          boolean
  junkAlertThreshold:         number
  startupAlertsEnabled:       boolean
  permissionAlertsEnabled:    boolean
  updateNotificationsEnabled: boolean
  runInBackground:             boolean

  // Safe cleaning
  safeCleaningMode:           boolean

  // Runtime tracking
  lastCleanupAt:              number | null
}

const DEFAULTS: MaintenanceSettings = {
  scheduleEnabled:            true,
  scheduleFrequency:          'weekly',
  recycleBinEnabled:          false,
  ignoreDownloads:            true,
  browserMasterEnabled:       true,
  browserChrome:              false,
  browserEdge:                false,
  browserBrave:               false,
  browserFirefox:             false,
  startupEnabled:             false,
  ramAlertsEnabled:           false,
  ramAlertThreshold:          85,
  diskAlertsEnabled:          false,
  diskAlertThreshold:         90,
  junkAlertsEnabled:          false,
  junkAlertThreshold:         2,
  startupAlertsEnabled:       false,
  permissionAlertsEnabled:    false,
  updateNotificationsEnabled: true,
  runInBackground:             false,
  safeCleaningMode:           true,
  lastCleanupAt:              null,
}

export function getStorePath(): string {
  return getMaintenanceFilePath()
}

export async function loadSettings(): Promise<MaintenanceSettings> {
  try {
    const raw = await fs.readFile(getStorePath(), 'utf8')
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<MaintenanceSettings>) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function loadSettingsSync(): MaintenanceSettings {
  try {
    const raw = fsSync.readFileSync(getStorePath(), 'utf8')
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<MaintenanceSettings>) }
  } catch {
    return { ...DEFAULTS }
  }
}

export async function saveSettings(settings: MaintenanceSettings): Promise<void> {
  try {
    await fs.writeFile(getStorePath(), JSON.stringify(settings, null, 2), 'utf8')
  } catch { /* read-only fs — non-fatal */ }
}

export async function updateSettings(partial: Partial<MaintenanceSettings>): Promise<MaintenanceSettings> {
  const updated = { ...await loadSettings(), ...partial }
  await saveSettings(updated)
  return updated
}
