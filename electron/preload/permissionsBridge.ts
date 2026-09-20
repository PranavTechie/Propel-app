import { ipcRenderer } from 'electron'

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

const permissionsBridge = {
  getApps: (): Promise<{ ok: boolean; data?: PermAppInfo[]; error?: string }> =>
    ipcRenderer.invoke('permissions:get-apps'),

  openPrivacySettings: (page?: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('permissions:open-privacy-settings', page),

  openTaskManager: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('permissions:open-task-manager'),

  getAppIcon: (iconPath: string): Promise<{ ok: boolean; data?: string }> =>
    ipcRenderer.invoke('permissions:get-app-icon', iconPath),
}

export default permissionsBridge
