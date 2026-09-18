import { ipcMain, BrowserWindow } from 'electron'
import {
  initUpdater,
  checkForUpdate,
  downloadUpdate,
  quitAndInstall,
  getUpdateState,
  onUpdaterEvent,
  type UpdateState,
} from '../../services/updater/updaterService'
import { loadSettings } from '../../services/maintenance/automationStore'

export function setupUpdaterIPC(): void {
  // Initialize autoUpdater and its periodic timers
  initUpdater()

  // Broadcast state changes to all renderer windows
  onUpdaterEvent((state: UpdateState) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('propel:updater:state-changed', state)
      }
    })
  })

  // Handle explicit or automated check
  ipcMain.handle('propel:updater:check', async (_event, options?: { isManual?: boolean }) => {
    const isManual = options?.isManual ?? false

    // If automatic check and notifications are disabled, skip silently
    if (!isManual) {
      const { updateNotificationsEnabled } = await loadSettings()
      if (!updateNotificationsEnabled) {
        return null
      }
    }

    return await checkForUpdate(isManual)
  })

  // Handle manual download trigger (if user requests)
  ipcMain.handle('propel:updater:download', async () => {
    return await downloadUpdate()
  })

  // Handle install & relaunch
  ipcMain.handle('propel:updater:install', () => {
    quitAndInstall()
  })

  // Handle get current state query
  ipcMain.handle('propel:updater:get-state', () => {
    return getUpdateState()
  })
}
