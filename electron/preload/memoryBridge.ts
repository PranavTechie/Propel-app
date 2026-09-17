import { ipcRenderer } from 'electron'
import type { MemoryDetails } from '../services/memory/memoryService'
import type { ProcessMemInfo } from '../services/memory/processService'
import type { OptimizationResult, OptimizeProgressInfo } from '../services/memory/optimizerService'
import type { PerformanceModeResult } from '../services/memory/performanceModeService'

export const memoryBridge = {
  getStats: (): Promise<MemoryDetails> =>
    ipcRenderer.invoke('memory:get-stats'),

  getProcesses: (limit?: number): Promise<ProcessMemInfo[]> =>
    ipcRenderer.invoke('memory:get-processes', limit),

  optimize: (): Promise<OptimizationResult> =>
    ipcRenderer.invoke('memory:optimize'),

  setPerformanceMode: (enabled: boolean): Promise<PerformanceModeResult> =>
    ipcRenderer.invoke('memory:set-performance-mode', enabled),

  onOptimizeProgress: (cb: (data: OptimizeProgressInfo) => void): void => {
    ipcRenderer.on('memory:optimize-progress', (_event, data: OptimizeProgressInfo) => cb(data))
  },

  removeListeners: (): void => {
    ipcRenderer.removeAllListeners('memory:optimize-progress')
  },
}
