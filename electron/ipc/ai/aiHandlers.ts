import { ipcMain, IpcMainInvokeEvent } from 'electron'
import {
  runSmartBoostAnalysis,
  runSmartBoostOptimize,
} from '../../services/ai/smartBoostService'

import {
  analyzeStartup,
  setStartupEntryEnabled,
} from '../../services/ai/startupAnalyzerService'
import type { StartupEntry } from '../../services/ai/startupAnalyzerService'
import {
  scanForDuplicates,
  deleteSelectedDuplicates,
} from '../../services/ai/duplicateFinderService'

export function setupAIIPC(): void {
  // ── Smart Boost ────────────────────────────────────────────────────────
  ipcMain.handle('ai:smart-boost-analyze', async () => {
    return runSmartBoostAnalysis()
  })

  ipcMain.handle('ai:smart-boost-optimize', async (event: IpcMainInvokeEvent) => {
    return runSmartBoostOptimize((step, pct) => {
      try {
        event.sender.send('ai:smart-boost-progress', { step, pct })
      } catch { /* renderer closed */ }
    })
  })



  // ── Startup Analyzer ──────────────────────────────────────────────────
  ipcMain.handle('ai:startup-analyze', async () => {
    return analyzeStartup()
  })

  ipcMain.handle('ai:startup-set-enabled', async (_event, entry: StartupEntry, enabled: boolean) => {
    return setStartupEntryEnabled(entry, enabled)
  })

  // ── Duplicate Finder ──────────────────────────────────────────────────
  ipcMain.handle(
    'ai:duplicate-scan',
    async (event: IpcMainInvokeEvent, scanRoots: string[] | null, excludedPaths: string[]) => {
      return scanForDuplicates(scanRoots, excludedPaths ?? [], progress => {
        try {
          event.sender.send('ai:duplicate-scan-progress', progress)
        } catch { /* renderer closed */ }
      })
    },
  )

  ipcMain.handle('ai:duplicate-delete', async (_event, filePaths: string[]) => {
    return deleteSelectedDuplicates(filePaths)
  })
}
