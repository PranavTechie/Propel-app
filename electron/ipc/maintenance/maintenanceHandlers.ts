import { ipcMain } from 'electron'
import { loadSettings, updateSettings } from '../../services/maintenance/automationStore'
import type { MaintenanceSettings } from '../../services/maintenance/automationStore'
import { runAutoClean, getNextCleanupTime, startScheduler, stopScheduler } from '../../services/maintenance/schedulerService'
import { setStartupEnabled, getStartupEnabled } from '../../services/maintenance/startupService'

export function setupMaintenanceIPC(): void {
  // ── Get full settings (merges live startup state) ───────────────────────
  ipcMain.handle('propel:maintenance:getSettings', async () => {
    const settings = await loadSettings()
    return { ...settings, startupEnabled: getStartupEnabled() }
  })

  // ── Update settings (with side-effects) ─────────────────────────────────
  ipcMain.handle(
    'propel:maintenance:updateSettings',
    async (_event, partial: Partial<MaintenanceSettings>) => {
      const updated = await updateSettings(partial)

      if ('startupEnabled' in partial) {
        setStartupEnabled(partial.startupEnabled ?? false)
      }

      if ('scheduleEnabled' in partial || 'scheduleFrequency' in partial) {
        stopScheduler()
        if (updated.scheduleEnabled) startScheduler()
      }

      return updated
    },
  )

  // ── Trigger immediate cleanup ────────────────────────────────────────────
  ipcMain.handle('propel:maintenance:runNow', async () => {
    return runAutoClean()
  })

  // ── Live status (for status cards) ──────────────────────────────────────
  ipcMain.handle('propel:maintenance:getStatus', async () => {
    const settings = await loadSettings()
    const next = getNextCleanupTime()
    return {
      nextCleanupAt:          next?.getTime() ?? null,
      lastCleanupAt:          settings.lastCleanupAt,
      startupEnabled:         getStartupEnabled(),
      scheduleEnabled:        settings.scheduleEnabled,
      scheduleFrequency:      settings.scheduleFrequency,
      ramAlertsEnabled:       settings.ramAlertsEnabled,
      browserProtectionCount: [
        settings.browserChrome,
        settings.browserEdge,
        settings.browserBrave,
        settings.browserFirefox,
      ].filter(Boolean).length,
    }
  })
}
