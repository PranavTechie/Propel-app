import { ipcMain } from 'electron'
import { checkForUpdate, recordSkip } from '../../services/updater/updaterService'
import { loadSettings } from '../../services/maintenance/automationStore'

export function setupUpdaterIPC(): void {
  ipcMain.handle('propel:updater:check', async () => {
    // Respect user preference — if notifications are disabled, return null silently
    const { updateNotificationsEnabled } = loadSettings()
    if (!updateNotificationsEnabled) return null
    return checkForUpdate()
  })

  ipcMain.handle('propel:updater:skip', (_event, latestVersion: string) => {
    recordSkip(latestVersion)
  })
}
