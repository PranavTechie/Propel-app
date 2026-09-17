import { ipcMain, BrowserWindow, shell, Notification, app } from 'electron'
import {
  permissionsService,
  getInstalledApps,
  getStartupEntries,
  killProcess,
  disableStartupEntry,
  type PermissionsSnapshot,
  type ActiveAccess,
} from '../../services/permissions/permissionsService'

// ── Device labels for desktop notifications ─────────────────────────────────
const DEVICE_LABELS: Record<string, string> = {
  camera: 'Camera',
  microphone: 'Microphone',
  screen: 'Screen Capture',
  clipboard: 'Clipboard',
  overlay: 'Screen Overlay',
  admin: 'Admin Privileges',
}

// ── Per-window snapshot listener map (prevents accumulation) ─────────────────
const snapshotListeners = new Map<number, (s: PermissionsSnapshot) => void>()

export function setupPermissionsIPC(): void {
  // ── Desktop notifications whenever a new sensitive access is detected ────
  permissionsService.on('access-started', (acc: ActiveAccess) => {
    if (!Notification.isSupported()) return
    try {
      new Notification({
        title: acc.app,
        body: `Accessing ${DEVICE_LABELS[acc.device] ?? acc.device}`,
      }).show()
    } catch { /* ignore */ }
  })

  // ── Start monitoring ────────────────────────────────────────────────
  ipcMain.handle('permissions:start', async (event) => {
    const senderId = event.sender.id

    // Remove any stale listener for this window before adding a new one
    const prev = snapshotListeners.get(senderId)
    if (prev) permissionsService.off('snapshot', prev)

    permissionsService.start()

    // Forward snapshots to the requesting window
    const snapshotListener = (snapshot: PermissionsSnapshot) => {
      try {
        event.sender.send('permissions:update', snapshot)
      } catch {
        // renderer closed
      }
    }

    snapshotListeners.set(senderId, snapshotListener)
    permissionsService.on('snapshot', snapshotListener)

    // Clean up when renderer is destroyed
    event.sender.once('destroyed', () => {
      permissionsService.off('snapshot', snapshotListener)
      snapshotListeners.delete(senderId)
    })

    return { ok: true }
  })

  // ── Stop monitoring ─────────────────────────────────────────────────
  ipcMain.handle('permissions:stop', async () => {
    permissionsService.stop()
    return { ok: true }
  })

  // ── Get installed apps (one-time scan) ──────────────────────────────
  ipcMain.handle('permissions:get-apps', async () => {
    try {
      const data = await getInstalledApps()
      return { ok: true, data }
    } catch (e: unknown) {
      return { ok: false, error: (e as Error).message }
    }
  })

  // ── Get startup entries ─────────────────────────────────────────────
  ipcMain.handle('permissions:get-startup', async () => {
    try {
      const data = await getStartupEntries()
      return { ok: true, data }
    } catch (e: unknown) {
      return { ok: false, error: (e as Error).message }
    }
  })

  // ── Get permission history ──────────────────────────────────────────
  ipcMain.handle('permissions:get-history', async () => {
    try {
      const data = permissionsService.getHistory()
      return { ok: true, data }
    } catch (e: unknown) {
      return { ok: false, error: (e as Error).message }
    }
  })

  // ── Kill process ────────────────────────────────────────────────────
  ipcMain.handle('permissions:kill-process', async (_event, pid: number) => {
    return killProcess(pid)
  })

  // ── Disable startup entry ───────────────────────────────────────────
  ipcMain.handle('permissions:disable-startup', async (_event, name: string, source: string) => {
    return disableStartupEntry(name, source)
  })

  // ── Open Windows Privacy Settings ───────────────────────────────────
  ipcMain.handle('permissions:open-privacy-settings', async (_event, page?: string) => {
    const pages: Record<string, string> = {
      webcam: 'ms-settings:privacy-webcam',
      microphone: 'ms-settings:privacy-microphone',
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
