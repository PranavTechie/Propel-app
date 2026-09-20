import fs from 'fs'
import path from 'path'
import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { loadSettings, loadSettingsSync, updateSettings } from './automationStore'

const execFileAsync = promisify(execFile)

// ── Constants ──────────────────────────────────────────────────────────────
const HOUR_MS = 60 * 60 * 1000
const FREQUENCY_MS: Record<string, number> = {
  daily:   24 * 60 * 60 * 1000,
  weekly:  7  * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
}

let _timer: ReturnType<typeof setInterval> | null = null

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

  const chromiumProfiles = async (base: string): Promise<string[]> => {
    if (!fs.existsSync(base)) return []
    try {
      const entries = await fs.promises.readdir(base, { withFileTypes: true })
      return entries
        .filter(d => d.isDirectory() && (d.name === 'Default' || d.name.startsWith('Profile')))
        .map(d => d.name)
    } catch { return [] }
  }

  if (settings.browserChrome) {
    const base = path.join(localAppData, 'Google', 'Chrome', 'User Data')
    for (const p of await chromiumProfiles(base)) {
      paths.push(path.join(base, p, 'Cache'), path.join(base, p, 'Code Cache'))
    }
  }
  if (settings.browserEdge) {
    const base = path.join(localAppData, 'Microsoft', 'Edge', 'User Data')
    for (const p of await chromiumProfiles(base)) {
      paths.push(path.join(base, p, 'Cache'), path.join(base, p, 'Code Cache'))
    }
  }
  if (settings.browserBrave) {
    const base = path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data')
    for (const p of await chromiumProfiles(base)) {
      paths.push(path.join(base, p, 'Cache'), path.join(base, p, 'Code Cache'))
    }
  }
  if (settings.browserFirefox) {
    const base = path.join(appData, 'Mozilla', 'Firefox', 'Profiles')
    if (fs.existsSync(base)) {
      try {
        const entries = await fs.promises.readdir(base)
        for (const profile of entries) {
          paths.push(
            path.join(base, profile, 'cache2'),
            path.join(base, profile, 'startupCache'),
          )
        }
      } catch { /* skip */ }
    }
  }
  return paths
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

// ── Main cleanup routine ───────────────────────────────────────────────────
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

// ── Schedule check ─────────────────────────────────────────────────────────
function isDue(settings: ReturnType<typeof loadSettingsSync>): boolean {
  if (!settings.scheduleEnabled) return false
  if (!settings.lastCleanupAt)   return true
  const freqMs = FREQUENCY_MS[settings.scheduleFrequency] ?? FREQUENCY_MS.weekly
  return Date.now() - settings.lastCleanupAt >= freqMs
}

// ── Scheduler lifecycle ────────────────────────────────────────────────────
export function startScheduler(): void {
  if (_timer) return

  // Check immediately on first start (catches overdue scheduled runs)
  const initial = loadSettingsSync()
  if (isDue(initial)) runAutoClean().catch(() => {})

  _timer = setInterval(() => {
    if (isDue(loadSettingsSync())) runAutoClean().catch(() => {})
  }, HOUR_MS)

  _timer.unref()  // don't prevent app quit
}

export function stopScheduler(): void {
  if (_timer) { clearInterval(_timer); _timer = null }
}

// ── Next cleanup time ─────────────────────────────────────────────────────
export function getNextCleanupTime(): Date | null {
  const settings = loadSettingsSync()
  if (!settings.scheduleEnabled) return null
  if (!settings.lastCleanupAt)   return new Date()
  const freqMs = FREQUENCY_MS[settings.scheduleFrequency] ?? FREQUENCY_MS.weekly
  return new Date(settings.lastCleanupAt + freqMs)
}
