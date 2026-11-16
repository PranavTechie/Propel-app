import { ipcMain, IpcMainInvokeEvent } from 'electron'
import {
  runSmartBoostAnalysis,
  runSmartBoostOptimize,
} from '../../services/ai/smartBoostService'
import { getPCAdvisorDiagnosis, pingBackendHealth } from '../../services/ai/pcAdvisorService'

import {
  analyzeStartup,
  setStartupEntryEnabled,
} from '../../services/ai/startupAnalyzerService'
import {
  scanForDuplicates,
  deleteSelectedDuplicates,
} from '../../services/ai/duplicateFinderService'

export function setupAIIPC(): void {
  // ── Smart Boost ────────────────────────────────────────────────────────
  ipcMain.handle('ai:smart-boost-analyze', async () => {
    return runSmartBoostAnalysis()
  })

  ipcMain.handle('ai:get-pc-advisor-diagnosis', async (_event, payload: any, token: string) => {
    return getPCAdvisorDiagnosis(payload, token)
  })

  ipcMain.handle('ai:ping-health', async () => {
    return pingBackendHealth()
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

  // The renderer's entry is untrusted: setStartupEntryEnabled validates it and acts
  // only on the matching entry from a fresh scan (registry value / startup folder file).
  ipcMain.handle('ai:startup-set-enabled', async (_event, entry: unknown, enabled: unknown) => {
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
