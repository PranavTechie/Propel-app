import { ipcRenderer } from 'electron'
import type { CategorySummary } from '../ipc/cleaner/cleanerHandlers'
import type { CleanupReport } from '../services/cleaner/cleanupReport'

export type ScanProgressEvent =
  | { type: 'category-start'; categoryId: string; categoryName: string }
  | { type: 'file-found'; categoryId: string; currentPath: string; totalSize: number; fileCount: number }
  | { type: 'category-done'; id: string; name: string; totalSize: number; fileCount: number }
  | { type: 'scan-complete'; categories: CategorySummary[] }

export type CleanProgressEvent =
  | { type: 'file-cleaned'; current: number; total: number; currentFile: string; freed: number }
  | { type: 'clean-complete'; report: CleanupReport }

export const cleanerBridge = {
  scan: (): Promise<CategorySummary[]> =>
    ipcRenderer.invoke('cleaner:scan'),

  clean: (categoryIds: string[]): Promise<CleanupReport> =>
    ipcRenderer.invoke('cleaner:clean', categoryIds),

  getRecycleInfo: (): Promise<{ size: number; fileCount: number }> =>
    ipcRenderer.invoke('cleaner:recycle-info'),

  onScanProgress: (cb: (data: ScanProgressEvent) => void): void => {
    ipcRenderer.on('cleaner:scan-progress', (_event, data: ScanProgressEvent) => cb(data))
  },

  onCleanProgress: (cb: (data: CleanProgressEvent) => void): void => {
    ipcRenderer.on('cleaner:clean-progress', (_event, data: CleanProgressEvent) => cb(data))
  },

  removeListeners: (): void => {
    ipcRenderer.removeAllListeners('cleaner:scan-progress')
    ipcRenderer.removeAllListeners('cleaner:clean-progress')
  },
}
