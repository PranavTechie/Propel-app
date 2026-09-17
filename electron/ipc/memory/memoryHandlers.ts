import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { getMemoryDetails } from '../../services/memory/memoryService'
import { getTopMemoryProcesses } from '../../services/memory/processService'
import { runSafeOptimization } from '../../services/memory/optimizerService'
import { setPerformanceMode } from '../../services/memory/performanceModeService'

export function setupMemoryIPC(): void {
  // ── Memory Stats ─────────────────────────────────────────────────────
  ipcMain.handle('memory:get-stats', async () => {
    return getMemoryDetails()
  })

  // ── Top Processes ─────────────────────────────────────────────────────
  ipcMain.handle('memory:get-processes', async (_event, limit: number = 12) => {
    return getTopMemoryProcesses(limit)
  })

  // ── Safe Optimization ────────────────────────────────────────────────
  ipcMain.handle('memory:optimize', async (event: IpcMainInvokeEvent) => {
    return runSafeOptimization(info => {
      try {
        event.sender.send('memory:optimize-progress', info)
      } catch {
        // renderer window closed
      }
    })
  })

  // ── Performance Mode ─────────────────────────────────────────────────
  ipcMain.handle('memory:set-performance-mode', async (_event, enabled: boolean) => {
    return setPerformanceMode(enabled)
  })
}
