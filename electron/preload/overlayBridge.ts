import { ipcRenderer } from 'electron'

export interface OverlayMetrics {
  cpu:     number
  ram:     number
  netDown: number
  netUp:   number
}

export const overlayBridge = {
  open:   (): Promise<boolean> => ipcRenderer.invoke('propel:overlay:open'),
  close:  (): Promise<boolean> => ipcRenderer.invoke('propel:overlay:close'),
  isOpen: (): Promise<boolean> => ipcRenderer.invoke('propel:overlay:isOpen'),

  onMetrics: (cb: (metrics: OverlayMetrics) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, m: OverlayMetrics) => cb(m)
    ipcRenderer.on('overlay:metrics', handler)
    return () => ipcRenderer.removeListener('overlay:metrics', handler)
  },
}
