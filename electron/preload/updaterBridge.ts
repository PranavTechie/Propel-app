import { ipcRenderer } from 'electron'

// Mirrors UpdateState in electron/services/updater/updaterService.ts
// Defined here separately to keep preload thin (no main-process imports)
export interface UpdateState {
  available: boolean
  currentVersion: string
  latestVersion: string
  title: string
  changelog: string[]
  websiteUrl: string
  mandatory: boolean
  mandatoryAfterDays: number
  firstDetectedAt?: number
}

export const updaterBridge = {
  check: (): Promise<UpdateState | null> =>
    ipcRenderer.invoke('propel:updater:check'),

  skip: (latestVersion: string): Promise<void> =>
    ipcRenderer.invoke('propel:updater:skip', latestVersion),
}
