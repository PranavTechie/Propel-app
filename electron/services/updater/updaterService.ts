import { app } from 'electron'
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import { captureServiceWarning } from '../telemetry/serviceCapture'

// ── Constants ──────────────────────────────────────────────────────────────
export const APP_VERSION = '1.3'
const PERIODIC_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours
const INITIAL_CHECK_DELAY_MS = 10_000 // 10 seconds after app launch

// ── Types ──────────────────────────────────────────────────────────────────
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

export type UpdaterEventListener = (state: UpdateState) => void

// ── State ──────────────────────────────────────────────────────────────────
let currentState: UpdateState = {
  available: false,
  status: 'idle',
  currentVersion: APP_VERSION,
  latestVersion: APP_VERSION,
}

let isDownloading = false
let periodicTimer: NodeJS.Timeout | null = null
let initialTimer: NodeJS.Timeout | null = null
let isInitialized = false
const eventListeners: Set<UpdaterEventListener> = new Set()

// ── Helpers ────────────────────────────────────────────────────────────────
function formatDisplayVersion(v: string): string {
  const clean = v.replace(/^v/, '').trim()
  const parts = clean.split('.')
  if (parts.length === 3 && parts[2] === '0') {
    return `${parts[0]}.${parts[1]}`
  }
  return clean
}

function notifyListeners(): void {
  const snapshot: UpdateState = { ...currentState }
  eventListeners.forEach(listener => {
    try {
      listener(snapshot)
    } catch {
      // Listener error must never crash main process
    }
  })
}

// ── AutoUpdater Initialization ─────────────────────────────────────────────
export function initUpdater(): void {
  if (isInitialized) return
  isInitialized = true

  // Configure autoUpdater
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = false
  autoUpdater.allowDowngrade = false

  try {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'pranavop45',
      repo: 'propel-releases',
    })
  } catch {
    // Non-critical fallback if app-update.yml is used
  }

  // Attach event listeners
  autoUpdater.on('checking-for-update', () => {
    currentState.status = 'checking'
    currentState.error = undefined
    notifyListeners()
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    currentState.available = true
    currentState.status = 'available'
    currentState.latestVersion = formatDisplayVersion(info.version)
    currentState.releaseNotes = typeof info.releaseNotes === 'string'
      ? info.releaseNotes
      : Array.isArray(info.releaseNotes)
        ? info.releaseNotes.map(n => typeof n === 'string' ? n : (n as { note?: string })?.note ?? '')
        : undefined
    notifyListeners()

    // Automatically start background download immediately
    if (!isDownloading) {
      startDownloadInternal()
    }
  })

  autoUpdater.on('update-not-available', () => {
    currentState.available = false
    currentState.status = 'not-available'
    notifyListeners()
  })

  autoUpdater.on('download-progress', (progressObj: ProgressInfo) => {
    isDownloading = true
    currentState.status = 'downloading'
    currentState.progress = {
      percent: Math.round(progressObj.percent * 10) / 10,
      bytesPerSecond: Math.round(progressObj.bytesPerSecond),
      transferred: Math.round(progressObj.transferred),
      total: Math.round(progressObj.total),
    }
    notifyListeners()
  })

  autoUpdater.on('update-downloaded', () => {
    isDownloading = false
    currentState.status = 'downloaded'
    currentState.progress = {
      percent: 100,
      bytesPerSecond: 0,
      transferred: currentState.progress?.total ?? 0,
      total: currentState.progress?.total ?? 0,
    }
    notifyListeners()
  })

  autoUpdater.on('error', (err: Error) => {
    isDownloading = false
    currentState.status = 'error'
    currentState.error = err?.message || 'Update check failed'
    captureServiceWarning('Auto-updater error', {
      service: 'updater',
      operation: 'autoUpdater',
      phase: 'event',
      extra: { message: err?.message ?? 'unknown' },
    })
    notifyListeners()
  })

  // Start background timers (startup + periodic 4-hour check)
  startPeriodicTimer()

  // Clean up timers when app quits
  app.on('before-quit', () => {
    stopPeriodicTimer()
  })
}

// ── Public API ─────────────────────────────────────────────────────────────
export function onUpdaterEvent(listener: UpdaterEventListener): () => void {
  eventListeners.add(listener)
  return () => {
    eventListeners.delete(listener)
  }
}

export function getUpdateState(): UpdateState {
  return { ...currentState }
}

export async function checkForUpdate(isManual = false): Promise<UpdateState> {
  // If not packaged (dev mode), avoid autoUpdater failure due to missing dev-app-update.yml
  if (!app.isPackaged) {
    currentState.status = 'not-available'
    currentState.available = false
    notifyListeners()
    return { ...currentState }
  }

  // If already downloaded, return downloaded state
  if (currentState.status === 'downloaded') {
    return { ...currentState }
  }

  // If already downloading, return downloading state
  if (isDownloading || currentState.status === 'downloading') {
    return { ...currentState }
  }

  try {
    currentState.status = 'checking'
    currentState.error = undefined
    notifyListeners()
    await autoUpdater.checkForUpdates()
    return { ...currentState }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    currentState.status = 'error'
    currentState.error = errorMsg

    // Log as warning — NEVER block or crash the application on network failure
    captureServiceWarning('Check for updates failed', {
      service: 'updater',
      operation: 'checkForUpdate',
      phase: 'network',
      extra: { isManual: String(isManual), error: errorMsg },
    })

    notifyListeners()
    return { ...currentState }
  }
}

async function startDownloadInternal(): Promise<void> {
  if (isDownloading || currentState.status === 'downloaded') return
  isDownloading = true
  currentState.status = 'downloading'
  notifyListeners()

  try {
    await autoUpdater.downloadUpdate()
  } catch (err) {
    isDownloading = false
    currentState.status = 'error'
    currentState.error = err instanceof Error ? err.message : String(err)
    captureServiceWarning('Download update failed', {
      service: 'updater',
      operation: 'downloadUpdate',
      phase: 'download',
      extra: { error: currentState.error },
    })
    notifyListeners()
  }
}

export async function downloadUpdate(): Promise<UpdateState> {
  if (!app.isPackaged) {
    return { ...currentState }
  }
  await startDownloadInternal()
  return { ...currentState }
}

export function quitAndInstall(): void {
  if (!app.isPackaged) {
    console.log('[updater] Dev mode: quitAndInstall skipped')
    return
  }
  try {
    // isSilent = false, isForceRunAfter = true
    autoUpdater.quitAndInstall(false, true)
  } catch (err) {
    captureServiceWarning('quitAndInstall failed', {
      service: 'updater',
      operation: 'quitAndInstall',
      phase: 'install',
      extra: { error: err instanceof Error ? err.message : String(err) },
    })
  }
}

// ── Periodic Timer ─────────────────────────────────────────────────────────
function startPeriodicTimer(): void {
  stopPeriodicTimer()

  // Initial silent check 10 seconds after launch
  initialTimer = setTimeout(() => {
    if (app.isPackaged && currentState.status !== 'downloading' && currentState.status !== 'downloaded') {
      checkForUpdate(false).catch(() => { /* silent */ })
    }
  }, INITIAL_CHECK_DELAY_MS)

  // Recurring 4-hour check
  periodicTimer = setInterval(() => {
    if (app.isPackaged && currentState.status !== 'downloading' && currentState.status !== 'downloaded') {
      checkForUpdate(false).catch(() => { /* silent */ })
    }
  }, PERIODIC_CHECK_INTERVAL_MS)
}

function stopPeriodicTimer(): void {
  if (initialTimer) {
    clearTimeout(initialTimer)
    initialTimer = null
  }
  if (periodicTimer) {
    clearInterval(periodicTimer)
    periodicTimer = null
  }
}
