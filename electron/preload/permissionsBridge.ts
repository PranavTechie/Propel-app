import { ipcRenderer } from 'electron'

interface ActiveAccess {
  device: 'camera' | 'microphone' | 'screen' | 'admin' | 'clipboard' | 'overlay'
  app: string
  pid?: number
  since: number
}

interface PermAppInfo {
  name: string
  exeName: string
  publisher: string
  iconPath: string
  hasCamera: boolean
  hasMicrophone: boolean
  isStartup: boolean
  isRunning: boolean
  hasNetwork: boolean
  hasOverlay: boolean
  hasAdmin: boolean
  pid?: number
}

interface StartupEntry {
  name: string
  command: string
  source: 'HKCU' | 'HKLM'
}

interface PermEvent {
  id: string
  device: 'camera' | 'microphone' | 'screen' | 'admin' | 'startup' | 'clipboard' | 'overlay'
  app: string
  action: 'started' | 'stopped' | 'detected'
  timestamp: number
}

interface PermissionsSnapshot {
  activeAccesses: ActiveAccess[]
  networkApps: string[]
  isAdminSession: boolean
  clipboardApps: string[]
  overlayApps: string[]
  timestamp: number
}

const permissionsBridge = {
  start: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('permissions:start'),

  stop: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('permissions:stop'),

  getApps: (): Promise<{ ok: boolean; data?: PermAppInfo[]; error?: string }> =>
    ipcRenderer.invoke('permissions:get-apps'),

  getStartup: (): Promise<{ ok: boolean; data?: StartupEntry[]; error?: string }> =>
    ipcRenderer.invoke('permissions:get-startup'),

  getHistory: (): Promise<{ ok: boolean; data?: PermEvent[]; error?: string }> =>
    ipcRenderer.invoke('permissions:get-history'),

  killProcess: (pid: number): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('permissions:kill-process', pid),

  disableStartup: (name: string, source: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('permissions:disable-startup', name, source),

  openPrivacySettings: (page?: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('permissions:open-privacy-settings', page),

  openTaskManager: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('permissions:open-task-manager'),

  getAppIcon: (iconPath: string): Promise<{ ok: boolean; data?: string }> =>
    ipcRenderer.invoke('permissions:get-app-icon', iconPath),

  onUpdate: (cb: (data: PermissionsSnapshot) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: PermissionsSnapshot) => cb(data)
    ipcRenderer.on('permissions:update', handler)
    return () => ipcRenderer.removeListener('permissions:update', handler)
  },
}

export default permissionsBridge
