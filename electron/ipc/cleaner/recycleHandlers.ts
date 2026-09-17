/**
 * recycleHandlers.ts
 * Handles Recycle Bin scan and empty operations separately from the file-based cleaner.
 * Uses Windows Shell COM API via PowerShell for accurate size reporting and safe cleanup.
 */

import { ipcMain } from 'electron'
import { getRecycleBinInfo, emptyRecycleBin } from '../../services/cleaner/recycleCleaner'

export function setupRecycleIPC(): void {
  ipcMain.handle('cleaner:recycle-info', async () => {
    return getRecycleBinInfo()
  })

  ipcMain.handle('cleaner:recycle-empty', async () => {
    return emptyRecycleBin()
  })
}

export { getRecycleBinInfo, emptyRecycleBin }
