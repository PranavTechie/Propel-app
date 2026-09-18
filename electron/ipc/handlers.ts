import { ipcMain } from 'electron'
import { getSystemStats } from '../native/system'

const APP_VERSION = '1.2'

export function setupIPC(): void {
  ipcMain.handle('system:get-stats', async () => {
    return await getSystemStats()
  })

  ipcMain.handle('system:get-version', () => APP_VERSION)
}

