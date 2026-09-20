import { ipcMain } from 'electron'
import { getSystemStats, getHWID, getFingerprint, isAdmin, optimizeDrive } from '../native/system'

const APP_VERSION = '1.3'

export function setupIPC(): void {
  ipcMain.handle('system:get-stats', async () => {
    return await getSystemStats()
  })

  ipcMain.handle('system:get-hwid', () => getHWID())
  ipcMain.handle('system:get-fingerprint', () => getFingerprint())

  ipcMain.handle('system:is-admin', async () => {
    return await isAdmin()
  })

  ipcMain.handle('system:optimize-drive', async (_event, driveLetter?: string) => {
    return await optimizeDrive(driveLetter)
  })

  ipcMain.handle('system:get-version', () => APP_VERSION)
}

