import { ipcMain, shell, app } from 'electron'
import { getInstalledApps } from '../../services/permissions/permissionsService'

export function setupPermissionsIPC(): void {
  // ── Get installed apps (one-time scan) ──────────────────────────────
  ipcMain.handle('permissions:get-apps', async () => {
    try {
      const data = await getInstalledApps()
      return { ok: true, data }
    } catch (e: unknown) {
      return { ok: false, error: (e as Error).message }
    }
  })

  // ── Open Windows Privacy Settings ───────────────────────────────────
  ipcMain.handle('permissions:open-privacy-settings', async (_event, page?: string) => {
    const pages: Record<string, string> = {
      webcam: 'ms-settings:privacy-webcam',
      microphone: 'ms-settings:privacy-microphone',
      location: 'ms-settings:privacy-location',
      screen: 'ms-settings:privacy-broadfilesystemaccess',
      startup: 'ms-settings:startupapps',
    }
    const url = pages[page ?? ''] ?? 'ms-settings:privacy'
    await shell.openExternal(url)
    return { ok: true }
  })

  // ── Open Task Manager ───────────────────────────────────────────────
  ipcMain.handle('permissions:open-task-manager', async () => {
    const { spawn } = await import('child_process')
    spawn('taskmgr.exe', [], { detached: true, stdio: 'ignore' }).unref()
    return { ok: true }
  })

  // ── Get app icon (extracts real .exe icon via Electron native API) ──
  ipcMain.handle('permissions:get-app-icon', async (_event, iconPath: string) => {
    if (!iconPath || typeof iconPath !== 'string') return { ok: false }
    try {
      const img = await app.getFileIcon(iconPath, { size: 'large' })
      return { ok: true, data: img.toDataURL() }
    } catch {
      return { ok: false }
    }
  })
}

