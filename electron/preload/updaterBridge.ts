import { ipcRenderer, type IpcRendererEvent } from 'electron'

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdateProgress {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

export interface UpdateState {
  available: boolean
  status: UpdateStatus
  currentVersion: string
  latestVersion: string
  releaseNotes?: string | string[]
  progress?: UpdateProgress
  error?: string
}

export const updaterBridge = {
  check: (options?: { isManual?: boolean }): Promise<UpdateState | null> =>
    ipcRenderer.invoke('propel:updater:check', options),

  download: (): Promise<UpdateState> =>
    ipcRenderer.invoke('propel:updater:download'),

  install: (): Promise<void> =>
    ipcRenderer.invoke('propel:updater:install'),

  getState: (): Promise<UpdateState> =>
    ipcRenderer.invoke('propel:updater:get-state'),

  onStateChanged: (callback: (state: UpdateState) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, state: UpdateState): void => {
      callback(state)
    }
    ipcRenderer.on('propel:updater:state-changed', handler)
    return () => {
      ipcRenderer.removeListener('propel:updater:state-changed', handler)
    }
  },
}
