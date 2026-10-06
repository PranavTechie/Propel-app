import { ipcMain, app } from 'electron'
import { loadSettings, updateSettings } from '../../services/maintenance/automationStore'
import type { MaintenanceSettings } from '../../services/maintenance/automationStore'
import { runAutoClean, runScheduledIfDue, syncWindowsTask, getNextCleanupTime, getInstalledBrowserCount } from '../../services/maintenance/schedulerService'
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

      // When scheduleEnabled or scheduleFrequency changes, re-sync the
      // Windows Task Scheduler entry. syncWindowsTask() is idempotent:
      //   - scheduleEnabled=true  → creates/overwrites the daily 2:00 AM task
      //   - scheduleEnabled=false → deletes the task (non-fatal if missing)
      // Frequency changes are intentionally NOT embedded in the Task Scheduler
      // trigger — the task always fires daily at 02:00 AM and the rolling-
      // window due-check inside runScheduledIfDue() handles the actual timing.
      if ('scheduleEnabled' in partial || 'scheduleFrequency' in partial) {
        syncWindowsTask(app.getPath('exe')).catch(() => {})
      }

      return updated
    },
  )

  // ── Trigger immediate cleanup (Run Now button) ───────────────────────────
  ipcMain.handle('propel:maintenance:runNow', async () => {
    return runAutoClean()
  })

  // ── Trigger scheduled cleanup if due (called from second-instance handler) ──
  // This is the handoff path: when the OS task fires and Propel is ALREADY
  // running, the new --scheduled-maintenance process forwards its args to
  // the primary instance which calls this handler instead of showing a window.
  ipcMain.handle('propel:maintenance:runScheduledIfDue', async () => {
    return runScheduledIfDue()
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
      browserProtectionCount: settings.browserMasterEnabled ? await getInstalledBrowserCount() : 0,
    }
  })
}
