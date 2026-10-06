import { shell } from 'electron'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { loadSettings, loadSettingsSync, updateSettings } from './automationStore'

const execFileAsync = promisify(execFile)

// ── Constants ──────────────────────────────────────────────────────────────
const FREQUENCY_MS: Record<string, number> = {
  daily:   24 * 60 * 60 * 1000,
  weekly:  7  * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
}

// Windows Task Scheduler task name — stable across updates
const TASK_NAME = 'Propel Maintenance'

// Concurrent-run lock — prevents duplicate cleanup if the OS double-fires
// the task or if runAutoClean() is called from two paths simultaneously.
let _isRunningCleanup = false

// ── Temp directories ───────────────────────────────────────────────────────
function getTempDirs(): string[] {
  const localAppData = process.env.LOCALAPPDATA ?? ''
  const winDir       = process.env.WINDIR ?? 'C:\\Windows'
  const temp         = process.env.TEMP  ?? os.tmpdir()

  return [
    temp,
    path.join(localAppData, 'Temp'),
    path.join(winDir, 'Temp'),
    path.join(localAppData, 'Microsoft', 'Windows', 'INetCache'),
    path.join(localAppData, 'Microsoft', 'Windows', 'Explorer', 'ThumbCacheToDelete'),
    path.join(localAppData, 'CrashDumps'),
  ].filter(d => d.length > 3)
}

// ── Recursive directory cleaner (silently skips locked/denied files) ───────
async function cleanDir(dirPath: string, safeMode: boolean): Promise<number> {
  let cleaned = 0
  try {
    if (!fs.existsSync(dirPath)) return 0
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name)
      try {
        if (entry.isDirectory()) {
          if (safeMode) {
            cleaned += await cleanDir(full, safeMode)
          } else {
            await fs.promises.rm(full, { recursive: true, force: true })
            cleaned++
          }
        } else {
          if (safeMode) {
            await shell.trashItem(full)
          } else {
            await fs.promises.unlink(full)
          }
          cleaned++
        }
      } catch { /* locked / permission denied — skip */ }
    }
  } catch { /* unreadable dir — skip */ }
  return cleaned
}

// ── Browser cache paths ────────────────────────────────────────────────────
async function getBrowserCachePaths(): Promise<string[]> {
  const localAppData = process.env.LOCALAPPDATA ?? ''
  const appData      = process.env.APPDATA      ?? ''
  const settings     = await loadSettings()
  const paths: string[] = []

  if (settings.browserMasterEnabled === false) return paths

  const chromiumProfiles = async (base: string): Promise<string[]> => {
    if (!fs.existsSync(base)) return []
    try {
      const entries = await fs.promises.readdir(base, { withFileTypes: true })
      return entries
        .filter(d => d.isDirectory() && (d.name === 'Default' || d.name.startsWith('Profile')))
        .map(d => d.name)
    } catch { return [] }
  }

  const baseChrome = path.join(localAppData, 'Google', 'Chrome', 'User Data')
  for (const p of await chromiumProfiles(baseChrome)) {
    paths.push(path.join(baseChrome, p, 'Cache'), path.join(baseChrome, p, 'Code Cache'))
  }

  const baseEdge = path.join(localAppData, 'Microsoft', 'Edge', 'User Data')
  for (const p of await chromiumProfiles(baseEdge)) {
    paths.push(path.join(baseEdge, p, 'Cache'), path.join(baseEdge, p, 'Code Cache'))
  }

  const baseBrave = path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data')
  for (const p of await chromiumProfiles(baseBrave)) {
    paths.push(path.join(baseBrave, p, 'Cache'), path.join(baseBrave, p, 'Code Cache'))
  }

  const baseFirefox = path.join(appData, 'Mozilla', 'Firefox', 'Profiles')
  if (fs.existsSync(baseFirefox)) {
    try {
      const entries = await fs.promises.readdir(baseFirefox)
      for (const profile of entries) {
        paths.push(
          path.join(baseFirefox, profile, 'cache2'),
          path.join(baseFirefox, profile, 'startupCache'),
        )
      }
    } catch { /* skip */ }
  }

  return paths
}

export async function getInstalledBrowserCount(): Promise<number> {
  const localAppData = process.env.LOCALAPPDATA ?? ''
  const appData      = process.env.APPDATA      ?? ''
  
  const bases = [
    path.join(localAppData, 'Google', 'Chrome', 'User Data'),
    path.join(localAppData, 'Microsoft', 'Edge', 'User Data'),
    path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data'),
    path.join(appData, 'Mozilla', 'Firefox', 'Profiles')
  ]
  
  let count = 0
  for (const b of bases) {
    if (fs.existsSync(b)) count++
  }
  return count
}

// ── Recycle bin ────────────────────────────────────────────────────────────
async function emptyRecycleBin(): Promise<boolean> {
  try {
    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', 'Clear-RecycleBin -Force -ErrorAction SilentlyContinue'],
      { timeout: 15_000, windowsHide: true },
    )
    return true
  } catch { return false }
}

// ── Schedule check — rolling-window semantics preserved exactly ────────────
// This is the ONLY place that decides whether a cleanup should run.
// The Windows Task Scheduler is only a daily wake-up/check mechanism.
// The actual decision of "is it due?" is still based on lastCleanupAt + freqMs.
function isDue(settings: ReturnType<typeof loadSettingsSync>): boolean {
  if (!settings.scheduleEnabled) return false
  if (!settings.lastCleanupAt)   return true   // never run — run immediately
  const freqMs = FREQUENCY_MS[settings.scheduleFrequency] ?? FREQUENCY_MS.weekly
  return Date.now() - settings.lastCleanupAt >= freqMs
}

// ── Main cleanup routine ───────────────────────────────────────────────────
// Protected by _isRunningCleanup lock against concurrent execution.
// Called from:
//   1. runNow IPC (explicit user "Run Now" button)
//   2. runScheduledIfDue() — OS task scheduler path
export async function runAutoClean(): Promise<{
  tempCleaned:       number
  browserCleaned:    number
  recycleBinCleared: boolean
}> {
  let tempCleaned = 0, browserCleaned = 0, recycleBinCleared = false
  const settings = await loadSettings()
  const safeMode = settings.safeCleaningMode

  for (const dir of getTempDirs()) {
    tempCleaned += await cleanDir(dir, safeMode)
  }
  for (const dir of await getBrowserCachePaths()) {
    browserCleaned += await cleanDir(dir, safeMode)
  }
  if (settings.recycleBinEnabled) {
    recycleBinCleared = await emptyRecycleBin()
  }

  await updateSettings({ lastCleanupAt: Date.now() })
  return { tempCleaned, browserCleaned, recycleBinCleared }
}

// ── Scheduled entry point (called from main/index.ts on --scheduled-maintenance) ──
// Double-protection:
//   1. Check scheduleEnabled + isDue() — preserves rolling-window semantics
//   2. _isRunningCleanup lock — prevents concurrent double-execution
// Returns true if cleanup was actually executed.
export async function runScheduledIfDue(): Promise<boolean> {
  const settings = loadSettingsSync()
  if (!isDue(settings)) return false
  if (_isRunningCleanup) return false  // already running in this process

  _isRunningCleanup = true
  try {
    await runAutoClean()
    return true
  } finally {
    _isRunningCleanup = false
  }
}

// ── Windows Task Scheduler — create / update / remove ─────────────────────
// Creates a DAILY trigger at 02:00 AM for the current user (no admin required).
// The 2:00 AM trigger is a wake-up check only — actual execution depends
// on isDue() inside runScheduledIfDue(), preserving rolling-interval semantics.
//
// /f overwrites any existing task with the same name (idempotent).
// /rl LIMITED ensures it runs at the current user's permission level — no UAC.
// /it means "run only when logged in" — consistent with a per-user Electron app.
async function createWindowsTask(executablePath: string): Promise<void> {
  // Safely quote the executable path to handle spaces (e.g. "C:\Program Files\Propel\Propel.exe")
  const quoted = `"${executablePath}" --scheduled-maintenance`

  await execFileAsync(
    'schtasks.exe',
    [
      '/create',
      '/tn', TASK_NAME,
      '/tr', quoted,
      '/sc', 'daily',
      '/st', '02:00',
      '/rl', 'LIMITED',   // run at standard user privilege — no UAC
      '/it',              // only run when user is logged in
      '/f',               // overwrite silently if already exists
    ],
    { timeout: 10_000, windowsHide: true },
  )
}

async function removeWindowsTask(): Promise<void> {
  try {
    await execFileAsync(
      'schtasks.exe',
      ['/delete', '/tn', TASK_NAME, '/f'],
      { timeout: 10_000, windowsHide: true },
    )
  } catch {
    // Task may not exist yet — non-fatal
  }
}

// ── Public API for scheduler lifecycle (called from IPC handler + main) ───
// syncWindowsTask() is idempotent — safe to call on every settings change.
// It replaces the old startScheduler()/stopScheduler() pair.
export async function syncWindowsTask(executablePath: string): Promise<void> {
  const settings = loadSettingsSync()
  if (settings.scheduleEnabled) {
    await createWindowsTask(executablePath)
  } else {
    await removeWindowsTask()
  }
}

// Kept for uninstall cleanup (called from main on app before-quit if needed)
export { removeWindowsTask }

// ── Next cleanup time (unchanged — used by UI status cards) ──────────────
export function getNextCleanupTime(): Date | null {
  const settings = loadSettingsSync()
  if (!settings.scheduleEnabled) return null
  if (!settings.lastCleanupAt)   return new Date()
  const freqMs = FREQUENCY_MS[settings.scheduleFrequency] ?? FREQUENCY_MS.weekly
  return new Date(settings.lastCleanupAt + freqMs)
}

// ── Legacy no-ops kept so existing import sites don't need changes ────────
// maintenanceHandlers.ts previously called startScheduler/stopScheduler —
// those calls are replaced in the handler itself, but if any other code
// still imports these they will silently no-op rather than crash.
export function startScheduler(): void { /* replaced by syncWindowsTask */ }
export function stopScheduler():  void { /* replaced by syncWindowsTask */ }
