import { ipcRenderer } from 'electron'
import type { SmartBoostAnalysis, SmartBoostResult } from '../services/ai/smartBoostService'
import type { StartupAnalysis, StartupEntry } from '../services/ai/startupAnalyzerService'
import type { DuplicateScanResult, DeleteDuplicatesResult, DuplicateScanProgress } from '../services/ai/duplicateFinderService'

export const aiBridge = {
  // ── Smart Boost ──────────────────────────────────────────────────────────
  smartBoostAnalyze: (): Promise<SmartBoostAnalysis> =>
    ipcRenderer.invoke('ai:smart-boost-analyze'),

  getPCAdvisorDiagnosis: (payload: any, token: string): Promise<any> =>
    ipcRenderer.invoke('ai:get-pc-advisor-diagnosis', payload, token),

  pingHealth: (): Promise<void> =>
    ipcRenderer.invoke('ai:ping-health'),

  smartBoostOptimize: (): Promise<SmartBoostResult> =>
    ipcRenderer.invoke('ai:smart-boost-optimize'),

  onSmartBoostProgress: (cb: (data: { step: string; pct: number }) => void): void => {
    ipcRenderer.on('ai:smart-boost-progress', (_event, data) => cb(data))
  },



  // ── Startup Analyzer ─────────────────────────────────────────────────────
  analyzeStartup: (): Promise<StartupAnalysis> =>
    ipcRenderer.invoke('ai:startup-analyze'),

  setStartupEntryEnabled: (entry: StartupEntry, enabled: boolean): Promise<boolean> =>
    ipcRenderer.invoke('ai:startup-set-enabled', entry, enabled),

  // ── Duplicate Finder ─────────────────────────────────────────────────────
  scanDuplicates: (scanRoots: string[] | null, excludedPaths: string[]): Promise<DuplicateScanResult> =>
    ipcRenderer.invoke('ai:duplicate-scan', scanRoots, excludedPaths),

  deleteDuplicates: (filePaths: string[]): Promise<DeleteDuplicatesResult> =>
    ipcRenderer.invoke('ai:duplicate-delete', filePaths),

  onDuplicateScanProgress: (cb: (data: DuplicateScanProgress) => void): void => {
    ipcRenderer.on('ai:duplicate-scan-progress', (_event, data) => cb(data))
  },

  removeListeners: (): void => {
    ipcRenderer.removeAllListeners('ai:smart-boost-progress')
    ipcRenderer.removeAllListeners('ai:duplicate-scan-progress')
  },
}
