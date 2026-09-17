import { ipcRenderer } from 'electron'

export interface MaintenanceSettings {
  scheduleEnabled:            boolean
  scheduleFrequency:          'daily' | 'weekly' | 'monthly'
  recycleBinEnabled:          boolean
  ignoreDownloads:            boolean
  browserChrome:              boolean
  browserEdge:                boolean
  browserBrave:               boolean
  browserFirefox:             boolean
  startupEnabled:             boolean
  ramAlertsEnabled:           boolean
  updateNotificationsEnabled: boolean
  safeCleaningMode:           boolean
  lastCleanupAt:              number | null
}

export interface MaintenanceStatus {
  nextCleanupAt:          number | null
  lastCleanupAt:          number | null
  startupEnabled:         boolean
  scheduleEnabled:        boolean
  scheduleFrequency:      'daily' | 'weekly' | 'monthly'
  ramAlertsEnabled:       boolean
  browserProtectionCount: number
}

export interface CleanResult {
  tempCleaned:       number
  browserCleaned:    number
  recycleBinCleared: boolean
}

export const maintenanceBridge = {
  getSettings:    (): Promise<MaintenanceSettings> =>
    ipcRenderer.invoke('propel:maintenance:getSettings'),

  updateSettings: (partial: Partial<MaintenanceSettings>): Promise<MaintenanceSettings> =>
    ipcRenderer.invoke('propel:maintenance:updateSettings', partial),

  runNow:         (): Promise<CleanResult> =>
    ipcRenderer.invoke('propel:maintenance:runNow'),

  getStatus:      (): Promise<MaintenanceStatus> =>
    ipcRenderer.invoke('propel:maintenance:getStatus'),
}
