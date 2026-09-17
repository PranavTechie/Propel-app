import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import os from 'os'

// ── Settings shape ─────────────────────────────────────────────────────────
export interface MaintenanceSettings {
  // Auto cleaning
  scheduleEnabled:            boolean
  scheduleFrequency:          'daily' | 'weekly' | 'monthly'
  recycleBinEnabled:          boolean
  ignoreDownloads:            boolean

  // Browser cache
  browserChrome:              boolean
  browserEdge:                boolean
  browserBrave:               boolean
  browserFirefox:             boolean

  // Startup
  startupEnabled:             boolean

  // Alerts
  ramAlertsEnabled:           boolean
  updateNotificationsEnabled: boolean

  // Safe cleaning
  safeCleaningMode:           boolean

  // Runtime tracking
  lastCleanupAt:              number | null
}

const DEFAULTS: MaintenanceSettings = {
  scheduleEnabled:            false,
  scheduleFrequency:          'weekly',
  recycleBinEnabled:          false,
  ignoreDownloads:            true,
  browserChrome:              false,
  browserEdge:                false,
  browserBrave:               false,
  browserFirefox:             false,
  startupEnabled:             false,
  ramAlertsEnabled:           false,
  updateNotificationsEnabled: true,
  safeCleaningMode:           true,
  lastCleanupAt:              null,
}

function getStorePath(): string {
  const base = process.env.APPDATA ?? os.homedir()
  return path.join(base, 'cm_maintenance.json')
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
